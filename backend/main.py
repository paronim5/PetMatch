from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.api import api_router
from app.core.logging import logger
from sqlalchemy import text
from datetime import date, timedelta
from app.infrastructure.database import Database
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.limiter import limiter
from prometheus_fastapi_instrumentator import Instrumentator

# TRUNCATE TABLE users cascade; delete all users
app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

# Prometheus metrics
Instrumentator().instrument(app).expose(app)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Mount static files
import os
try:
    if not os.path.exists("static/uploads"):
        os.makedirs("static/uploads", exist_ok=True)
    app.mount("/static", StaticFiles(directory="static"), name="static")
except Exception as e:
    logger.error(f"Failed to mount static files: {e}")

# Set all CORS enabled origins
if settings.BACKEND_CORS_ORIGINS:
    # Strip trailing slashes because browsers send Origin headers without them
    origins = [str(origin).rstrip("/") for origin in settings.BACKEND_CORS_ORIGINS]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    # Dev-safe fallback: allow any origin so PUT/GET from Vite dev work
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=".*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

@app.get("/health")
def health_check():
    return {"status": "healthy"}

app.include_router(api_router, prefix=settings.API_V1_STR)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        logger.info(f"Request finished: {request.method} {request.url.path} - Status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request failed: {request.method} {request.url.path} - Error: {e}")
        raise

@app.on_event("startup")
async def startup_event():
    logger.info("Starting up PetMatch Backend...")
    logger.info(f"Allowed CORS Origins: {settings.BACKEND_CORS_ORIGINS}")
    
    # Check database connectivity
    try:
        db = Database()
        # Try to connect and run a simple query
        with db.engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info("Database connection successful.")
    except Exception as e:
        logger.error(f"FATAL: Could not connect to database: {e}")
        # We continue to let the app start, but it will likely fail later
    
    logger.info("Backend is ready to receive requests.")
    try:
        today = date.today()
        first_day = today.replace(day=1)
        next_month = (first_day + timedelta(days=32)).replace(day=1)
        partition_name = f"messages_p_{first_day.year}_{first_day.month:02d}"
        ddl_messages_month = text(f"""
        CREATE TABLE IF NOT EXISTS {partition_name}
        PARTITION OF messages
        FOR VALUES FROM ('{first_day.isoformat()}') TO ('{next_month.isoformat()}');
        """)
        ddl_messages_default = text("""
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r' AND c.relname = 'messages_default'
          ) THEN
            CREATE TABLE messages_default PARTITION OF messages DEFAULT;
          END IF;
        END $$;
        """)
        db = Database()
        with db.engine.begin() as conn:
            conn.execute(ddl_messages_month)
            conn.execute(ddl_messages_default)
        logger.info(f"Ensured messages partition: {partition_name}")
    except Exception as e:
        logger.warning(f"Could not ensure messages partition: {e}")
    try:
        today = date.today()
        first_day = today.replace(day=1)
        next_month = (first_day + timedelta(days=32)).replace(day=1)
        partition_name = f"notifications_p_{first_day.year}_{first_day.month:02d}"
        ddl_notifications_month = text(f"""
        CREATE TABLE IF NOT EXISTS {partition_name}
        PARTITION OF notifications
        FOR VALUES FROM ('{first_day.isoformat()}') TO ('{next_month.isoformat()}');
        """)
        ddl_notifications_default = text("""
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_class c
            JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind = 'r' AND c.relname = 'notifications_default'
          ) THEN
            CREATE TABLE notifications_default PARTITION OF notifications DEFAULT;
          END IF;
        END $$;
        """)
        db = Database()
        with db.engine.begin() as conn:
            conn.execute(ddl_notifications_month)
            conn.execute(ddl_notifications_default)
        logger.info(f"Ensured notifications partition: {partition_name}")
    except Exception as e:
        logger.warning(f"Could not ensure notifications partition: {e}")

@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down PetMatch Backend...")

@app.get("/")
def root():
    return {"message": "Welcome to PetMatch API"}

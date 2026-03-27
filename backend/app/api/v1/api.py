from fastapi import APIRouter
from app.api.v1.endpoints import auth, users, matching, notifications, chat, ws, subscription, validation

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(matching.router, prefix="/matching", tags=["matching"])
api_router.include_router(subscription.router, prefix="/subscription", tags=["subscription"])
api_router.include_router(notifications.router, prefix="/notifications", tags=["notifications"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(validation.router, tags=["validation"])
api_router.include_router(ws.router, tags=["websocket"])

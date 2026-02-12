# Build stage
FROM python:3.11-slim as builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .

# FIX: Added oauthlib and requests-oauthlib directly here
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels \
    -r requirements.txt \
    oauthlib \
    requests-oauthlib \
    gunicorn \
    uvicorn

# Final stage
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libhdf5-dev \
    libgl1 \
    libglib2.0-0 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy wheels and install
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .

RUN pip install --no-cache /wheels/*

# Set Keras Home for model caching
ENV KERAS_HOME=/app/.keras

# Pre-download MobileNetV2 model to avoid download on first request
# We do this as root, then chown to app
RUN mkdir -p /app/.keras && \
    python -c "import os; os.environ['KERAS_HOME']='/app/.keras'; from tensorflow.keras.applications.mobilenet_v2 import MobileNetV2; MobileNetV2(weights='imagenet', include_top=True)" && \
    chmod -R 777 /app/.keras

# Create a non-root user first
RUN addgroup --system app && adduser --system --group app

# Copy application code
COPY . .

# Create static directory and set permissions
RUN mkdir -p static/uploads && \
    chown -R app:app /app && \
    chmod -R 755 static

USER app

EXPOSE 8000

CMD ["gunicorn", "main:app", "--workers", "1", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000", "--timeout", "120", "--access-logfile", "-", "--error-logfile", "-"]

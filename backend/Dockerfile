# ── Stage 1: build Python wheels for the runtime requirements ────────────────
FROM python:3.11-slim AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels \
    -r requirements.txt \
    oauthlib \
    requests-oauthlib \
    gunicorn \
    uvicorn

# ── Stage 2: convert MobileNetV2 → ONNX (heavy; not in final image) ──────────
FROM python:3.11-slim AS model-converter

WORKDIR /tmp

# Install TF + tf2onnx only for model conversion
RUN pip install --no-cache-dir \
    "tensorflow-cpu>=2.15.0,<2.16.0" \
    "tf2onnx>=1.16.0"

COPY convert_model.py .
RUN python convert_model.py

# ── Stage 3: lean runtime image ───────────────────────────────────────────────
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Limit CPU threads used by numpy / onnxruntime on a single-core instance
ENV OMP_NUM_THREADS=1
ENV OPENBLAS_NUM_THREADS=1
ENV MKL_NUM_THREADS=1

# Runtime system libs (opencv-python-headless does not need libgl1)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    libglib2.0-0 \
    libgomp1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install application wheels
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache /wheels/*

# Copy pre-built ONNX model and class labels
COPY --from=model-converter /tmp/mobilenetv2.onnx /app/mobilenetv2.onnx
COPY --from=model-converter /tmp/imagenet_class_index.json /app/imagenet_class_index.json

# Create non-root user
RUN addgroup --system app && adduser --system --group app

# Copy application code
COPY . .

RUN mkdir -p static/uploads && \
    chown -R app:app /app && \
    chmod -R 755 static

USER app

EXPOSE 8000

CMD ["gunicorn", "main:app", \
     "--workers", "1", \
     "--worker-class", "uvicorn.workers.UvicornWorker", \
     "--bind", "0.0.0.0:8000", \
     "--timeout", "120", \
     "--access-logfile", "-", \
     "--error-logfile", "-"]

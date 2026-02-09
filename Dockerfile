# ==========================================
# Stage 1: Scheduler Build (Python 3.9)
# ==========================================
FROM python:3.9-slim AS scheduler-build

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# ==========================================
# Stage 2: Scheduler Runtime (Python 3.9)
# ==========================================
FROM python:3.9-slim AS scheduler

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=scheduler-build /opt/venv /opt/venv
COPY DB/ /app/DB/

RUN useradd --create-home --shell /usr/sbin/nologin app \
    && chown -R app:app /app
USER app

# ==========================================
# Stage 3: Backend Build (Python 3.11)
# ==========================================
FROM python:3.11-slim AS backend-build

ENV PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# ==========================================
# Stage 4: Backend Runtime (Python 3.11)
# ==========================================
FROM python:3.11-slim AS backend

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=backend-build /opt/venv /opt/venv
COPY API/backend/ /app/

RUN useradd --create-home --shell /usr/sbin/nologin app \
    && chown -R app:app /app
USER app

# ==========================================
# Stage 5: Frontend Build (Node 20)
# ==========================================
FROM node:20-alpine AS frontend-build

WORKDIR /app

COPY API/frontend/package*.json ./
RUN npm ci

COPY API/frontend/ .

ARG VITE_API_URL=http://3.35.171.253:8001
ENV VITE_API_URL=$VITE_API_URL

RUN npx vite build

# ==========================================
# Stage 6: Frontend Serve (Nginx)
# ==========================================
FROM nginx:alpine AS frontend

COPY API/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-build /app/dist /usr/share/nginx/html

EXPOSE 8005
CMD ["nginx", "-g", "daemon off;"]

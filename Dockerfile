FROM python:3.11-slim

LABEL maintainer="CrowNest <studio@crownest.sk>"
LABEL description="CrowForge Backend — Local AI Workspace Server"

WORKDIR /app

# Install dependencies (server-only, no local LLM)
COPY requirements-server.txt .
RUN pip install --no-cache-dir -r requirements-server.txt

# Copy backend source
COPY backend/ ./backend/
COPY start-server.py .

# Create data directory for SQLite persistence
RUN mkdir -p /data

# Default environment
ENV CROWFORGE_DEPLOYMENT_MODE=host
ENV CROWFORGE_HOST_PORT=8000
ENV CROWFORGE_DB_PATH=/data/crowforge.db
ENV CROWFORGE_LOG_LEVEL=INFO

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

CMD ["python", "start-server.py"]

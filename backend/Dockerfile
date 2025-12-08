# backend/Dockerfile

FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    ffmpeg \
    ca-certificates \
    curl \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# [SECURITY] Create a non-root user with ID 1000
# This matches the 'chown 1000:1000' command you ran on the server
RUN useradd -m -u 1000 tuttyuser

# [STABILITY] Create data folders and assign ownership
RUN mkdir -p /app/uploads /app/logs && \
    chown -R tuttyuser:tuttyuser /app

COPY --chown=tuttyuser:tuttyuser . .

# [SECURITY] Switch to the secure user
USER tuttyuser

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--proxy-headers", "--forwarded-allow-ips", "*"]
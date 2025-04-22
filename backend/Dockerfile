# backend/Dockerfile

FROM python:3.9-slim

WORKDIR /app

# Install system dependencies including ffmpeg and ca-certificates
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    ffmpeg \
    ca-certificates \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Ensure SSL certificates are correctly set
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt
ENV REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

# Copy and install Python dependencies
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

EXPOSE 8000

# Update CMD to use multiple Uvicorn workers
# Development mode (uncomment for development):
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--reload"]

# Production mode
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--proxy-headers", "--forwarded-allow-ips", "*"]
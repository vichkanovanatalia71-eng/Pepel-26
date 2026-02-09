#!/bin/bash
# Deploy MedTrack to Google Cloud Run
# Usage: bash deploy.sh YOUR_MONGO_PASSWORD

if [ -z "$1" ]; then
  echo "Usage: bash deploy.sh YOUR_MONGO_PASSWORD"
  echo "Example: bash deploy.sh mySecretPass123"
  exit 1
fi

MONGO_PASS="$1"

# Create Dockerfile if it doesn't exist
if [ ! -f "Dockerfile" ]; then
  echo "Creating Dockerfile..."
  cat > Dockerfile << 'DOCKERFILE'
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps
COPY frontend/ ./
RUN REACT_APP_BACKEND_URL="" npm run build

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt .
RUN pip install --no-cache-dir $(grep -v emergentintegrations requirements.txt) && pip install --no-cache-dir aiofiles
COPY backend/ .
COPY --from=frontend-build /app/frontend/build ./static
EXPOSE 8080
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
DOCKERFILE
fi

# Create .dockerignore if it doesn't exist
if [ ! -f ".dockerignore" ]; then
  echo "Creating .dockerignore..."
  cat > .dockerignore << 'IGNORE'
node_modules
frontend/node_modules
frontend/build
.git
__pycache__
*.pyc
.env
test_reports
tests
memory
IGNORE
fi

echo "Starting deployment..."

gcloud run deploy medtrack \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 1Gi \
  --timeout 300 \
  --set-env-vars "MONGO_URL=mongodb+srv://romankolontaj_db_user:${MONGO_PASS}@cluster0.qdqmfpm.mongodb.net/?appName=Cluster0,DB_NAME=medtrack,CORS_ORIGINS=*,EMERGENT_LLM_KEY="

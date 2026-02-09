#!/bin/bash
# Deploy MedTrack to Google Cloud Run
# Usage: bash deploy.sh YOUR_MONGO_PASSWORD

if [ -z "$1" ]; then
  echo "Usage: bash deploy.sh YOUR_MONGO_PASSWORD"
  echo "Example: bash deploy.sh mySecretPass123"
  exit 1
fi

MONGO_PASS="$1"

gcloud run deploy medtrack \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --memory 512Mi \
  --timeout 300 \
  --set-env-vars "MONGO_URL=mongodb+srv://romankolontaj_db_user:${MONGO_PASS}@cluster0.qdqmfpm.mongodb.net/?appName=Cluster0,DB_NAME=medtrack,CORS_ORIGINS=*,EMERGENT_LLM_KEY="

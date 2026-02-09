# Stage 1: Build frontend
FROM node:20-slim AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --legacy-peer-deps && npm install ajv@8.17.1 --legacy-peer-deps
COPY frontend/ ./
RUN REACT_APP_BACKEND_URL="" npm run build

# Stage 2: Backend + serve static frontend
FROM python:3.11-slim
WORKDIR /app

# Install system deps for reportlab fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Install Python deps
COPY backend/requirements.txt .
RUN pip install --no-cache-dir $(grep -v emergentintegrations requirements.txt) && \
    pip install --no-cache-dir aiofiles

# Copy backend code
COPY backend/ .

# Copy built frontend
COPY --from=frontend-build /app/frontend/build ./static

EXPOSE 8080

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]

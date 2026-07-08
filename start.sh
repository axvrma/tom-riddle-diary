#!/bin/bash

set -e # Exit on error

# Configuration
OLLAMA_MODEL="llama3.2-vision"
OLLAMA_API_URL="http://localhost:11434/api/tags"

echo "=========================================================="
echo "  Preparing to start Tom Riddle's Diary..."
echo "=========================================================="

# 1. Check for required commands
for cmd in docker curl; do
    if ! command -v $cmd &> /dev/null; then
        echo "❌ Error: '$cmd' is not installed or not in PATH."
        if [ "$cmd" = "docker" ]; then
            echo "   Please install Docker (Docker Engine or Docker Desktop)."
        fi
        exit 1
    fi
done

# 2. Check if docker compose works
if ! docker compose version &> /dev/null; then
    echo "❌ Error: 'docker compose' is not available. Please ensure you have a recent version of Docker installed."
    exit 1
fi

# 3. Check if docker daemon is running
if ! docker info &> /dev/null; then
    echo "❌ Error: Docker daemon is not running. Please start your Docker service (e.g., systemctl start docker) or Docker Desktop."
    exit 1
fi

echo "✅ Docker is installed and running."

echo "Starting containers..."
docker compose up -d

echo ""
echo "⏳ Waiting for Ollama backend to become ready..."

# Wait up to 60 seconds for Ollama
MAX_RETRIES=30
RETRY_COUNT=0

while ! curl -s $OLLAMA_API_URL > /dev/null; do
    if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
        echo "❌ Error: Ollama failed to start within the expected time."
        echo "   Please check logs using: docker logs ollama-backend"
        exit 1
    fi
    echo "   Ollama API is not ready yet. Retrying in 2 seconds... ($((RETRY_COUNT+1))/$MAX_RETRIES)"
    sleep 2
    RETRY_COUNT=$((RETRY_COUNT+1))
done

echo "✅ Ollama is ready!"

echo ""
echo "🔍 Checking for model: $OLLAMA_MODEL"

# 4. Check if the model exists in Ollama
if docker exec ollama-backend ollama list | grep -q "$OLLAMA_MODEL"; then
    echo "✅ Model $OLLAMA_MODEL is already installed."
else
    echo "⬇️  Model not found locally. Pulling $OLLAMA_MODEL..."
    echo "   (This may take several minutes depending on your internet connection)"
    
    # Using pull instead of run so it just downloads quietly without entering an interactive shell
    if ! docker exec ollama-backend ollama pull $OLLAMA_MODEL; then
        echo "❌ Error: Failed to pull the model."
        exit 1
    fi
    echo "✅ Model downloaded successfully."
fi

echo ""
echo "=========================================================="
echo "✨ Tom Riddle's Diary is active. ✨"
echo "Access the diary at: http://localhost:3000"
echo "To view backend logs: docker logs -f ollama-backend"
echo "To stop the servers:  docker compose down"
echo "=========================================================="

#!/bin/bash
# Intellecta RAG Backend - Qdrant Setup Script
# Pulls and runs Qdrant Docker container

echo "=========================================="
echo "  Setting up Qdrant Vector Database"
echo "=========================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q '^intellecta-qdrant$'; then
    echo "Qdrant container already exists."
    
    # Check if it's running
    if docker ps --format '{{.Names}}' | grep -q '^intellecta-qdrant$'; then
        echo "Qdrant is already running."
    else
        echo "Starting existing Qdrant container..."
        docker start intellecta-qdrant
    fi
else
    echo "Pulling Qdrant image..."
    docker pull qdrant/qdrant:latest
    
    echo "Creating Qdrant container..."
    docker run -d \
        --name intellecta-qdrant \
        -p 6333:6333 \
        -p 6334:6334 \
        -v $(pwd)/qdrant_storage:/qdrant/storage:z \
        qdrant/qdrant:latest
    
    echo "Qdrant container created and started."
fi

# Wait for Qdrant to be ready
echo "Waiting for Qdrant to be ready..."
for i in {1..30}; do
    if curl -s http://localhost:6333/collections > /dev/null 2>&1; then
        echo "Qdrant is ready!"
        echo ""
        echo "Qdrant REST API: http://localhost:6333"
        echo "Qdrant gRPC:     http://localhost:6334"
        echo "Dashboard:       http://localhost:6333/dashboard"
        exit 0
    fi
    sleep 1
done

echo "Warning: Qdrant did not become ready in time. Check Docker logs."
docker logs intellecta-qdrant


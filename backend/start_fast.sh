#!/bin/bash
# Intellecta RAG Backend - Fast Mode Startup Script
# Uses LLaMA 3.2 8B with basic prompts for faster responses

echo "=========================================="
echo "  Intellecta RAG Backend - Fast Mode"
echo "=========================================="

# Set environment variables
export FAST_MODE=true
export AUTO_LOAD_DATASETS=false

# Check if Qdrant is running
echo "Checking Qdrant connection..."
if ! curl -s http://localhost:6333/collections > /dev/null 2>&1; then
    echo "Warning: Qdrant is not running. Start it with ./setup_qdrant.sh"
fi

# Check if Ollama is running
echo "Checking Ollama connection..."
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "Warning: Ollama is not running. Start it with: ollama serve"
fi

# Activate virtual environment if exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# Start the backend
echo "Starting FastAPI server in Fast Mode..."
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload


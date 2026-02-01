# Intellecta RAG Backend - Fast Mode Startup Script (PowerShell)
# Uses LLaMA 3.2 8B with basic prompts for faster responses

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Intellecta RAG Backend - Fast Mode" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Set environment variables
$env:FAST_MODE = "true"
$env:AUTO_LOAD_DATASETS = "false"

# Check if Qdrant is running
Write-Host "Checking Qdrant connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:6333/collections" -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "Qdrant is running." -ForegroundColor Green
} catch {
    Write-Host "Warning: Qdrant is not running. Start it with .\setup_qdrant.ps1" -ForegroundColor Red
}

# Check if Ollama is running
Write-Host "Checking Ollama connection..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:11434/api/tags" -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "Ollama is running." -ForegroundColor Green
} catch {
    Write-Host "Warning: Ollama is not running. Start it with: ollama serve" -ForegroundColor Red
}

# Activate virtual environment if exists
if (Test-Path "venv\Scripts\Activate.ps1") {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
}

# Start the backend
Write-Host ""
Write-Host "Starting FastAPI server in Fast Mode..." -ForegroundColor Green
Write-Host "API will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:8000/docs" -ForegroundColor Cyan
Write-Host ""

python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload


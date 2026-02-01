# Intellecta RAG Backend - Qdrant Setup Script (PowerShell)
# Pulls and runs Qdrant Docker container

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  Setting up Qdrant Vector Database" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# Check if Docker is installed
try {
    docker --version | Out-Null
} catch {
    Write-Host "Error: Docker is not installed. Please install Docker Desktop first." -ForegroundColor Red
    exit 1
}

# Check if container already exists
$existingContainer = docker ps -a --format '{{.Names}}' | Where-Object { $_ -eq 'intellecta-qdrant' }

if ($existingContainer) {
    Write-Host "Qdrant container already exists." -ForegroundColor Yellow
    
    # Check if it's running
    $runningContainer = docker ps --format '{{.Names}}' | Where-Object { $_ -eq 'intellecta-qdrant' }
    
    if ($runningContainer) {
        Write-Host "Qdrant is already running." -ForegroundColor Green
    } else {
        Write-Host "Starting existing Qdrant container..." -ForegroundColor Yellow
        docker start intellecta-qdrant
    }
} else {
    Write-Host "Pulling Qdrant image..." -ForegroundColor Yellow
    docker pull qdrant/qdrant:latest
    
    Write-Host "Creating Qdrant container..." -ForegroundColor Yellow
    
    # Create storage directory
    $storagePath = Join-Path $PSScriptRoot "qdrant_storage"
    if (-not (Test-Path $storagePath)) {
        New-Item -ItemType Directory -Path $storagePath | Out-Null
    }
    
    docker run -d `
        --name intellecta-qdrant `
        -p 6333:6333 `
        -p 6334:6334 `
        -v "${storagePath}:/qdrant/storage" `
        qdrant/qdrant:latest
    
    Write-Host "Qdrant container created and started." -ForegroundColor Green
}

# Wait for Qdrant to be ready
Write-Host "Waiting for Qdrant to be ready..." -ForegroundColor Yellow

for ($i = 1; $i -le 30; $i++) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:6333/collections" -UseBasicParsing -ErrorAction SilentlyContinue
        Write-Host ""
        Write-Host "Qdrant is ready!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Qdrant REST API: http://localhost:6333" -ForegroundColor Cyan
        Write-Host "Qdrant gRPC:     http://localhost:6334" -ForegroundColor Cyan
        Write-Host "Dashboard:       http://localhost:6333/dashboard" -ForegroundColor Cyan
        exit 0
    } catch {
        Start-Sleep -Seconds 1
    }
}

Write-Host "Warning: Qdrant did not become ready in time. Check Docker logs." -ForegroundColor Red
docker logs intellecta-qdrant


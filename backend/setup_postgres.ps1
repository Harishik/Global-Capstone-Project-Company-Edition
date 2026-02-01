# Setup PostgreSQL for Intellecta RAG Backend

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  INTELLECTA - PostgreSQL Setup" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan

# Check if Docker is running
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Host "Error: Docker is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host "`n[1/4] Pulling PostgreSQL 16 image..." -ForegroundColor Yellow
docker pull postgres:16-alpine

Write-Host "`n[2/4] Stopping existing container if running..." -ForegroundColor Yellow
docker stop intellecta-postgres 2>$null
docker rm intellecta-postgres 2>$null

Write-Host "`n[3/4] Creating data volume..." -ForegroundColor Yellow
docker volume create intellecta-postgres-data 2>$null

Write-Host "`n[4/4] Starting PostgreSQL container..." -ForegroundColor Yellow
docker run -d `
    --name intellecta-postgres `
    -e POSTGRES_USER=postgres `
    -e POSTGRES_PASSWORD=postgres `
    -e POSTGRES_DB=intellecta `
    -p 5432:5432 `
    -v intellecta-postgres-data:/var/lib/postgresql/data `
    --restart unless-stopped `
    postgres:16-alpine

# Wait for PostgreSQL to be ready
Write-Host "`nWaiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $pgReady = docker exec intellecta-postgres pg_isready -U postgres 2>$null
    if ($pgReady -match "accepting connections") {
        break
    }
    Start-Sleep -Seconds 1
    $attempt++
    Write-Host "." -NoNewline
}

Write-Host ""

# Final check
$pgRunning = docker exec intellecta-postgres pg_isready -U postgres 2>$null
if ($pgRunning -match "accepting connections") {
    Write-Host "`n============================================" -ForegroundColor Green
    Write-Host "  PostgreSQL is running!" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Connection Details:" -ForegroundColor Cyan
    Write-Host "  Host:     localhost"
    Write-Host "  Port:     5432"
    Write-Host "  Database: intellecta"
    Write-Host "  User:     postgres"
    Write-Host "  Password: postgres"
    Write-Host ""
    Write-Host "Connection String:" -ForegroundColor Cyan
    Write-Host "  postgresql://postgres:postgres@localhost:5432/intellecta"
    Write-Host ""
} else {
    Write-Host "Error: PostgreSQL failed to start" -ForegroundColor Red
    docker logs intellecta-postgres
    exit 1
}

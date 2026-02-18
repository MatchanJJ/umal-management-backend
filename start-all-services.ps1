# UMAL Management System - Start All Services
# This script starts all required services on different ports

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "   UMAL Management System Startup" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Port Configuration:" -ForegroundColor Green
Write-Host "  - Laravel Backend:  http://localhost:8000" -ForegroundColor White
Write-Host "  - NLP API Service:  http://localhost:8001" -ForegroundColor White
Write-Host "  - API Docs:         http://localhost:8001/docs`n" -ForegroundColor White

# Check if npm build is needed
Write-Host "[1/3] Checking frontend assets..." -ForegroundColor Yellow
if (!(Test-Path "public/build/manifest.json")) {
    Write-Host "      Building frontend assets..." -ForegroundColor Gray
    npm run build | Out-Null
    Write-Host "      ✓ Assets built successfully" -ForegroundColor Green
} else {
    Write-Host "      ✓ Assets already built" -ForegroundColor Green
}

# Start NLP Service in background
Write-Host "`n[2/3] Starting NLP API Service on port 8001..." -ForegroundColor Yellow
$nlpJob = Start-Job -ScriptBlock {
    Set-Location C:\Users\Mark\Projects\umal-management-backend\nlp-service
    uvicorn main:app --reload --port 8001 --host 0.0.0.0
}
Start-Sleep -Seconds 2
Write-Host "      ✓ NLP Service started (Job ID: $($nlpJob.Id))" -ForegroundColor Green

# Start Laravel Backend
Write-Host "`n[3/3] Starting Laravel Backend on port 8000..." -ForegroundColor Yellow
Write-Host "      Press Ctrl+C to stop all services`n" -ForegroundColor Gray

# Start Laravel in foreground
php -S localhost:8000 -t public

# Cleanup when Laravel stops
Write-Host "`nStopping services..." -ForegroundColor Yellow
Stop-Job $nlpJob
Remove-Job $nlpJob
Write-Host "All services stopped.`n" -ForegroundColor Green

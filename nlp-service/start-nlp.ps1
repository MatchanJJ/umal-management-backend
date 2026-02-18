# Run NLP Service on Port 8001
# Use this instead of manually typing the uvicorn command

Write-Host "Starting AssignAI NLP Service on port 8001..." -ForegroundColor Cyan
Write-Host "API Documentation: http://localhost:8001/docs`n" -ForegroundColor Green

uvicorn main:app --reload --port 8001 --host 0.0.0.0

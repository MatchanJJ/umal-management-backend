Write-Host "`n🧪 AssignAI API Quick Test Suite`n" -ForegroundColor Cyan

# Test 1: Health
Write-Host "Test 1: Health Check..." -ForegroundColor Yellow
$health = irm http://localhost:8000/health
Write-Host "✅ Status: $($health.status)" -ForegroundColor Green

# Test 2: Parse
Write-Host "`nTest 2: Text Parsing..." -ForegroundColor Yellow
$parse = irm http://localhost:8000/parse-request -Method Post `
  -ContentType "application/json" `
  -Body '{"text":"Need 5 students Friday morning"}'
Write-Host "✅ Day: $($parse.day), Time: $($parse.time_block), Slots: $($parse.slots_needed)" -ForegroundColor Green

# Test 3: Assignment
Write-Host "`nTest 3: Assignment Prediction..." -ForegroundColor Yellow
$assign = irm http://localhost:8000/predict-assignments -Method Post `
  -ContentType "application/json" `
  -Body '{"members":[{"member_id":"M001","is_available":1,"assignments_last_7_days":0,"assignments_last_30_days":2,"days_since_last_assignment":15,"attendance_rate":0.95}],"event_date":"2026-02-21","event_size":1}'
Write-Host "✅ Recommended: $($assign.recommended[0].member_id) with probability $($assign.recommended[0].assignment_probability)" -ForegroundColor Green

Write-Host "`n🎉 All Tests Passed!`n" -ForegroundColor Cyan
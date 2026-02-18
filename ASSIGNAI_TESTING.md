# AssignAI Testing Guide

This guide will help you test the complete AssignAI implementation.

---

## 🚀 Prerequisites

Before testing, ensure:

1. **NLP Service is Running**
   ```powershell
   cd nlp-service
   .\start-nlp.ps1
   # or manually:
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

2. **Laravel Service is Running**
   ```powershell
   php artisan serve --host=127.0.0.1 --port=9000
   ```

3. **Database is Seeded**
   ```powershell
   php artisan migrate:fresh --seed
   ```

4. **You're logged in as Admin or Adviser**

---

## 🧪 Test Scenarios

### Test 1: Health Check

**Verify NLP service is accessible**

```powershell
# Test NLP service health
curl http://localhost:8000/health

# Expected Response:
# {"status":"healthy","models_loaded":true}
```

```powershell
# Test AssignAI API health
curl -X GET http://localhost:9000/api/assignai/health `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -H "Accept: application/json"

# Expected Response:
# {"nlp_service":"connected","status":"healthy"}
```

---

### Test 2: Event View - "Assign Using AI" Button

1. **Navigate to Event Page**
   - Go to `http://localhost:9000/events`
   - Click on any event to view details
   - You should see event schedules and assigned volunteers

2. **Click "Assign Using AI" Button**
   - Locate the blue button with 🤖 icon (top-right, next to "Edit")
   - Only visible to Admin/Adviser users
   - Click the button

3. **Expected Result**
   - Modal opens with gradient blue header
   - Shows "Analyzing member availability..." loading state
   - After 2-3 seconds, displays recommended members with:
     - Checkbox (pre-selected)
     - Member name and email
     - Match percentage badge (green/yellow/gray)
     - Explanation text
     - Feature details (assignments, last assignment, attendance)

4. **Interact with Recommendations**
   - ✅ Check/uncheck members
   - 🔄 Click "Regenerate" to get new suggestions (excludes unchecked members)
   - ✅ Click "Finalize Assignments" to save
   - ❌ Click "Cancel" to close without saving

5. **Verify Success**
   - After finalization, alert shows: "Successfully assigned X volunteer(s)!"
   - Page reloads automatically
   - Assigned volunteers appear in event schedule section

---

### Test 3: Standalone AssignAI Page

1. **Navigate to AssignAI**
   - Click "🤖 AssignAI" in the navigation bar (top menu)
   - Or go to `http://localhost:9000/assignai`

2. **Enter Natural Language Prompt**
   - Try example prompts:
     - "Need 5 volunteers for Friday morning campus tour"
     - "Assign 3 people for tomorrow afternoon event"
     - "Looking for volunteers next Monday morning"
   - Click "Get Recommendations" or press Ctrl+Enter

3. **Scenario A: Event Exists**
   - Green success banner appears: "Event Found!"
   - Shows event title, date, and time
   - Displays recommended members (same format as modal)
   - Actions:
     - Select/deselect members
     - Click "Finalize Assignments" → Redirects to event page
     - Click "Clear" to reset and try another prompt

4. **Scenario B: Event Not Found**
   - Yellow warning banner appears: "No Event Found"
   - Shows parsed request details (day, time block, slots needed)
   - Displays "Suggested Event Details" box with:
     - Date
     - Start/end time
     - Volunteer count
   - "➕ Create Event" button → Redirects to event creation form

---

### Test 4: API Endpoint Testing (PowerShell)

#### Test Parse Endpoint
```powershell
$body = @{
    prompt = "Need 5 volunteers Friday morning"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:9000/api/assignai/parse" `
    -Method POST `
    -Headers @{
        "Content-Type" = "application/json"
        "Accept" = "application/json"
        "X-CSRF-TOKEN" = "YOUR_CSRF_TOKEN"
    } `
    -Body $body

$response | ConvertTo-Json -Depth 10
```

**Expected Output:**
```json
{
  "parsed_request": {
    "day": "Friday",
    "time_block": "Morning",
    "slots_needed": 5
  }
}
```

#### Test Suggest Endpoint
```powershell
$body = @{
    prompt = "Need 5 volunteers for Friday morning"
    event_id = 1
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:9000/api/assignai/suggest" `
    -Method POST `
    -Headers @{
        "Content-Type" = "application/json"
        "Accept" = "application/json"
        "X-CSRF-TOKEN" = "YOUR_CSRF_TOKEN"
    } `
    -Body $body

$response | ConvertTo-Json -Depth 10
```

**Expected Output:**
```json
{
  "success": true,
  "event_exists": true,
  "event": {...},
  "suggested_members": [
    {
      "member": {...},
      "probability": 0.87,
      "should_assign": true,
      "explanation": "Selected due to...",
      "features": {...}
    }
  ],
  "coverage": true,
  "shortfall": 0
}
```

#### Test Finalize Endpoint
```powershell
$body = @{
    event_id = 1
    member_ids = @(3, 7, 9)
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:9000/api/assignai/finalize" `
    -Method POST `
    -Headers @{
        "Content-Type" = "application/json"
        "Accept" = "application/json"
        "X-CSRF-TOKEN" = "YOUR_CSRF_TOKEN"
    } `
    -Body $body

$response | ConvertTo-Json
```

**Expected Output:**
```json
{
  "success": true,
  "message": "Successfully assigned 3 volunteers",
  "assigned_count": 3,
  "event_id": 1
}
```

---

### Test 5: Edge Cases

#### Test 5A: Empty Event
- Create event with no volunteer assignments
- Use AssignAI to assign volunteers
- Verify assignments are created

#### Test 5B: Fully Staffed Event
- Use event that already has all required volunteers
- Try AssignAI
- Should still suggest members (for backup/replacement)

#### Test 5C: No Available Members
- Mark all members as unavailable for specific time slot
- Try AssignAI for that time
- Should show "No recommendations available"

#### Test 5D: Invalid Prompts
- Test with ambiguous prompts:
  - "volunteers" (no day, time, or count)
  - "Friday" (no time or count)
  - "5 volunteers" (no day or time)
- Verify graceful error handling

#### Test 5E: Future Dates
- "Need volunteers next Monday"
- "Assign people for Friday next week"
- Verify correct date resolution

---

## 🐛 Troubleshooting

### Modal Doesn't Open
**Symptom:** Clicking "Assign Using AI" does nothing

**Fix:**
1. Check browser console for errors
2. Verify Alpine.js is loaded:
   ```javascript
   // In browser console:
   typeof Alpine
   // Should return: "object"
   ```
3. Ensure CSRF token is present:
   ```javascript
   document.querySelector('meta[name="csrf-token"]').content
   // Should return: token string
   ```

---

### "Failed to fetch recommendations"
**Symptom:** Modal opens but shows error immediately

**Fix:**
1. Check if NLP service is running:
   ```powershell
   curl http://localhost:8000/health
   ```
2. Check Laravel logs:
   ```powershell
   Get-Content storage/logs/laravel.log -Tail 50
   ```
3. Verify API routes are registered:
   ```powershell
   php artisan route:list | Select-String "assignai"
   ```

---

### "No recommendations available"
**Symptom:** Successfully fetches but shows empty results

**Possible Causes:**
1. No members in database
   ```powershell
   php artisan tinker
   # Then run:
   \App\Models\Member::count()
   ```

2. No availability data
   ```powershell
   php artisan db:seed --class=MemberAvailabilitySeeder
   ```

3. All members have class conflicts
   - Check member schedules
   - Verify event date/time doesn't conflict with classes

---

### ML Model Issues
**Symptom:** "Model file not found" error

**Fix:**
```powershell
cd nlp-service
python train_assignment_model.py
# This creates:
# - assignai_model.pkl
# - assignai_model_scaler.pkl
# - assignai_model_metadata.pkl
```

---

### CORS Errors
**Symptom:** Browser console shows "CORS policy" error

**Fix:**
1. NLP service already has CORS enabled in `main.py`
2. If issue persists, check `config/cors.php` in Laravel
3. Ensure requests include proper headers

---

## ✅ Success Criteria

All these should work without errors:

- [ ] NLP service responds to `/health` endpoint
- [ ] Laravel API `/api/assignai/health` returns "connected"
- [ ] "Assign Using AI" button appears on event pages (admin/adviser only)
- [ ] Modal opens when button is clicked
- [ ] Recommendations load within 5 seconds
- [ ] Can check/uncheck members
- [ ] "Finalize" creates volunteer assignments in database
- [ ] "Regenerate" excludes unchecked members
- [ ] Standalone AssignAI page accessible via navigation
- [ ] Natural language prompts are parsed correctly
- [ ] Event not found scenario shows creation suggestion
- [ ] Event found scenario shows recommendations
- [ ] Finalization redirects to event page
- [ ] Assignments appear in event schedule section

---

## 📊 Performance Benchmarks

Expected response times:

- **NLP Parsing:** < 500ms
- **ML Prediction:** < 1000ms (for 50 members)
- **Total Recommendation Time:** < 3 seconds
- **Finalization:** < 500ms

If slower, check:
- Database indexing (events, members, availability)
- NLP service performance (CPU usage)
- Network latency (localhost should be fast)

---

## 🎯 Next Steps After Testing

Once all tests pass:

1. **Production Deployment**
   - Deploy NLP service (Docker recommended)
   - Configure environment variables
   - Set up process manager (e.g., Supervisor, PM2)

2. **Performance Optimization**
   - Cache ML predictions for frequently requested event types
   - Index database tables (member_availability, volunteer_assignments)
   - Consider Redis for session management

3. **User Training**
   - Create admin/adviser documentation
   - Provide example prompts
   - Explain fairness principles

4. **Monitoring**
   - Log API usage (AssignAI requests)
   - Track assignment success rate
   - Monitor member workload distribution

---

**Happy Testing! 🎉**

If you encounter issues not covered here, check:
- `storage/logs/laravel.log` (Laravel errors)
- Browser console (JavaScript errors)
- NLP service terminal (Python errors)

# AssignAI Implementation Guide

**Agentic NLP-Based Volunteer Assignment with Human-in-the-Loop**

---

## 🎯 What's Been Implemented

### ✅ Backend Components

1. **`AssignAIService.php`** - Core orchestration logic
   - Natural language parsing via NLP microservice
   - Event resolution (find existing or suggest creation)
   - Member eligibility calculation
   - ML-based assignment prediction
   - Human approval workflow
   
2. **`AssignAIController.php`** - HTTP API endpoints
   - `/api/assignai/suggest` - Get recommendations from prompt
   - `/api/assignai/finalize` - Approve and save assignments
   - `/api/assignai/regenerate` - Get new suggestions
   - `/api/assignai/explain` - Understand why member was recommended
   - `/api/assignai/health` - Check NLP service status

3. **`Member.php` Model** - ML feature calculation
   - `assignmentsInLastDays()`
   - `daysSinceLastAssignment()`
   - `attendanceRate()`
   - `isAvailableOn()`
   - `toMLFeatures()` - Main feature export

4. **API Routes** - Registered in `routes/api.php`

---

## 🔄 System Flow

```
1. Admin/Adviser types: "Need 5 volunteers Friday morning"
           ↓
2. AssignAI Service → NLP Service (parse text)
   Result: {day: "Friday", time_block: "Morning", slots_needed: 5}
           ↓
3. Event Resolution
   - Search for existing event on Friday morning
   - If found → Load event
   - If not found → Suggest event creation
           ↓
4. Member Feature Calculation
   - Query all eligible members
   - Calculate ML features from database
   - Send to NLP prediction service
           ↓
5. ML-Based Ranking
   - NLP service returns top N recommendations
   - Sorted by fairness + availability
           ↓
6. Human Review
   - Show recommendations + explanations
   - Admin/Adviser can:
     * Accept → Finalize assignments
     * Regenerate → Get new suggestions
     * Cancel → No action
           ↓
7. Finalization
   - Create volunteer_assignments records
   - Send notifications (optional)
```

---

## 📡 API Usage Examples

### Example 1: Get Recommendations (Inside Event View)

```javascript
// From event page - user clicks "Assign Using AI" button
fetch('/api/assignai/suggest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    prompt: "Need 5 volunteers for this event",
    event_id: 12 // Current event ID
  })
})
.then(res => res.json())
.then(data => {
  if (data.success) {
    // Show recommendations
    data.suggested_members.forEach(rec => {
      console.log(`${rec.member.full_name}: ${(rec.probability * 100).toFixed(0)}%`);
      console.log(`  Reason: ${rec.explanation}`);
    });
  }
});
```

**Response:**
```json
{
  "success": true,
  "event_exists": true,
  "event": {...},
  "suggested_members": [
    {
      "member": {
        "id": 3,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@university.edu.ph"
      },
      "probability": 0.87,
      "should_assign": true,
      "explanation": "Selected due to high availability and balanced participation."
    }
  ],
  "coverage": true,
  "shortfall": 0,
  "explanation": "Balanced assignment considering availability, participation history, and fairness principles."
}
```

---

### Example 2: Get Recommendations (Standalone AssignAI Tab)

```javascript
// From dedicated AssignAI page - user types natural language
fetch('/api/assignai/suggest', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    prompt: "Need 3 volunteers tomorrow afternoon"
    // No event_id - system will search for matching event
  })
})
.then(res => res.json())
.then(data => {
  if (data.event_exists) {
    // Event found - show recommendations
    showRecommendations(data);
  } else {
    // No event found - suggest creation
    showEventCreationPrompt(data.event_suggestions);
  }
});
```

**Response (Event Not Found):**
```json
{
  "success": false,
  "event_exists": false,
  "message": "No event found for this schedule. Please create the event first.",
  "parsed_request": {
    "day": "Wednesday",
    "time_block": "Afternoon",
    "slots_needed": 3
  },
  "event_suggestions": {
    "date": "2026-02-19",
    "start_time": "14:00:00",
    "end_time": "17:00:00",
    "volunteer_count": 3,
    "title": "Event on Wednesday Afternoon"
  },
  "action": "create_event"
}
```

---

### Example 3: Finalize Assignments (Human Approval)

```javascript
// User approves recommendations
const approvedMemberIds = [3, 7, 9, 10, 15];

fetch('/api/assignai/finalize', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    event_id: 12,
    member_ids: approvedMemberIds
  })
})
.then(res => res.json())
.then(data => {
  console.log(data.message); // "Successfully assigned 5 volunteers"
  // Refresh event page to show assignments
});
```

---

### Example 4: Regenerate Suggestions

```javascript
// User wants different recommendations (exclude some members)
fetch('/api/assignai/regenerate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    event_id: 12,
    excluded_member_ids: [3, 7] // Don't suggest these again
  })
})
.then(res => res.json())
.then(data => {
  // Show new recommendations
  showRecommendations(data);
});
```

---

### Example 5: Get Explanation

```javascript
// User clicks "Why was this person recommended?"
fetch('/api/assignai/explain', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    member_id: 3,
    event_date: "2026-02-21",
    event_size: 5
  })
})
.then(res => res.json())
.then(explanation => {
  console.log(explanation);
  // Show explanation modal
});
```

**Response:**
```json
{
  "member_id": 3,
  "assignment_probability": 0.87,
  "factors": {
    "is_available": "Available",
    "recent_assignments_7d": "0 events",
    "recent_assignments_30d": "2 events",
    "days_since_last": "15 days ago",
    "attendance_rate": "95%"
  },
  "recommendation": "ASSIGN"
}
```

---

## 🎨 Frontend Implementation (Vue/React/Blade)

### Option 1: Add Button to Event View

```blade
<!-- resources/views/events/show.blade.php -->
<div class="event-actions">
    <button onclick="openAssignAI({{ $event->id }})" class="btn btn-primary">
        🤖 Assign Using AI
    </button>
</div>

<div id="assignai-panel" class="modal">
    <div class="modal-content">
        <h3>AssignAI Recommendations</h3>
        <div id="recommendations"></div>
        <div class="actions">
            <button onclick="acceptRecommendations()">✅ Accept</button>
            <button onclick="regenerate()">🔄 Regenerate</button>
            <button onclick="closePanel()">❌ Cancel</button>
        </div>
    </div>
</div>

<script>
function openAssignAI(eventId) {
    fetch('/api/assignai/suggest', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({
            prompt: `Assign volunteers for this event`,
            event_id: eventId
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            displayRecommendations(data);
            document.getElementById('assignai-panel').style.display = 'block';
        }
    });
}

function displayRecommendations(data) {
    const container = document.getElementById('recommendations');
    container.innerHTML = '';
    
    data.suggested_members.forEach(rec => {
        const div = document.createElement('div');
        div.className = 'recommendation-item';
        div.innerHTML = `
            <input type="checkbox" checked value="${rec.member.id}" />
            <span><strong>${rec.member.full_name}</strong></span>
            <span class="probability">${(rec.probability * 100).toFixed(0)}%</span>
            <p class="explanation">${rec.explanation}</p>
        `;
        container.appendChild(div);
    });
}

function acceptRecommendations() {
    const checkedBoxes = document.querySelectorAll('#recommendations input:checked');
    const memberIds = Array.from(checkedBoxes).map(cb => parseInt(cb.value));
    
    fetch('/api/assignai/finalize', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({
            event_id: {{ $event->id }},
            member_ids: memberIds
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.success) {
            alert('Assignments finalized!');
            location.reload();
        }
    });
}
</script>
```

---

### Option 2: Dedicated AssignAI Page

```blade
<!-- resources/views/assignai/index.blade.php -->
<div class="assignai-page">
    <h1>🤖 AssignAI - Intelligent Volunteer Assignment</h1>
    
    <div class="prompt-section">
        <label>Describe your volunteer needs in natural language:</label>
        <textarea id="prompt" rows="3" placeholder="e.g., Need 5 volunteers Friday morning for campus tour">
        </textarea>
        <button onclick="getRecommendations()">Get Recommendations</button>
    </div>
    
    <div id="results" style="display: none;">
        <!-- Dynamically populated -->
    </div>
</div>

<script>
function getRecommendations() {
    const prompt = document.getElementById('prompt').value;
    
    fetch('/api/assignai/suggest', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]').content
        },
        body: JSON.stringify({ prompt })
    })
    .then(res => res.json())
    .then(data => {
        if (data.event_exists) {
            displayRecommendations(data);
        } else {
            displayEventCreationPrompt(data);
        }
    });
}

function displayEventCreationPrompt(data) {
    document.getElementById('results').innerHTML = `
        <div class="alert warning">
            <h3>No Event Found</h3>
            <p>No event exists for ${data.parsed_request.day} ${data.parsed_request.time_block}.</p>
            <button onclick="createEvent(${JSON.stringify(data.event_suggestions)})">
                ➕ Create Event
            </button>
        </div>
    `;
    document.getElementById('results').style.display = 'block';
}
</script>
```

---

## 🔧 Configuration

### Add to `.env`:
```env
NLP_SERVICE_URL=http://localhost:8000
NLP_SERVICE_TIMEOUT=30
```

### Add to `config/services.php`:
```php
'nlp' => [
    'url' => env('NLP_SERVICE_URL', 'http://localhost:8000'),
    'timeout' => env('NLP_SERVICE_TIMEOUT', 30),
],
```

---

## 🧪 Testing the API

### Test 1: Health Check
```bash
curl -X GET http://localhost:9000/api/assignai/health \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test 2: Get Recommendations
```bash
curl -X POST http://localhost:9000/api/assignai/suggest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "prompt": "Need 5 volunteers Friday morning"
  }'
```

### Test 3: Finalize
```bash
curl -X POST http://localhost:9000/api/assignai/finalize \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "event_id": 1,
    "member_ids": [3, 7, 9]
  }'
```

---

## 🚀 Deployment Checklist

- [ ] NLP service running (`uvicorn main:app --reload`)
- [ ] Laravel service running (`php artisan serve`)
- [ ] Database migrations up to date
- [ ] Member availability data populated
- [ ] API routes registered ✅
- [ ] Web routes registered ✅
- [ ] Middleware configured (auth, role-based) ✅
- [ ] Frontend components created ✅
- [ ] Navigation links added ✅
- [ ] Alpine.js included in layout ✅
- [ ] Test all API endpoints
- [ ] Test event resolution logic
- [ ] Test human approval workflow

---

## 📁 Files Created/Modified

### Backend
- ✅ `app/Services/AssignAIService.php` - Core orchestration logic
- ✅ `app/Http/Controllers/AssignAIController.php` - HTTP API endpoints
- ✅ `app/Models/Member.php` - Added ML feature calculation methods
- ✅ `routes/api.php` - API routes for AssignAI
- ✅ `routes/web.php` - Web route for AssignAI page
- ✅ `bootstrap/app.php` - Enabled API routing

### Frontend
- ✅ `resources/views/components/assignai-modal.blade.php` - Reusable modal component
- ✅ `resources/views/assignai/index.blade.php` - Standalone AssignAI page
- ✅ `resources/views/events/show.blade.php` - Added "Assign Using AI" button
- ✅ `resources/views/layouts/app.blade.php` - Added Alpine.js & navigation link

---

## 🎯 Key Features

✅ **Natural Language Understanding** - Admins type requests naturally  
✅ **Event Resolution** - Finds existing events or suggests creation  
✅ **Fair Assignment** - ML model considers workload distribution  
✅ **Explainable AI** - Shows why each member was recommended  
✅ **Human-in-the-Loop** - Requires approval before finalizing  
✅ **Regeneration** - Can exclude members and get new suggestions  
✅ **Stateless** - NLP service is independent and replaceable  

---

**The AssignAI system is now ready for integration!** 🎉

Continue reading [ASSIGNAI_TESTING.md](ASSIGNAI_TESTING.md) for comprehensive testing guide.

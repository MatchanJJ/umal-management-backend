# AssignAI - Refactored System

**Fair Volunteer Assignment System with NLP + ML**

## 🎯 What Changed

### ❌ Removed: Role-Based Assignment
- **Old**: System extracted "role" (Campus Tour, Ushering, etc.) from requests
- **New**: All members can perform all tasks - no role classification

### ✅ Added: ML-Based Fair Assignment
- **New Model**: RandomForest/XGBoost predicts which members to assign
- **Fairness-Focused**: Based on availability, recent assignments, attendance
- **Features**: 
  - `is_available` (1/0)
  - `assignments_last_7_days`
  - `assignments_last_30_days`
  - `days_since_last_assignment`
  - `attendance_rate` (0.6-1.0)
  - `event_size`, `event_date`

---

## 📁 New File Structure

```
umal-management-backend/
├── generate_assignment_dataset.py   # Generate ML training data
├── train_assignment_model.py        # Train fairness model
├── assignai_assignment_dataset.csv  # Generated dataset
├── assignai_model.pkl              # Trained model
├── assignai_model_scaler.pkl       # Feature scaler
├── assignai_model_metadata.pkl     # Model metadata
│
nlp-service/
├── main.py                         # FastAPI (updated)
├── parser.py                       # Text parsing (role removed)
├── assignment_predictor.py         # NEW: ML-based assignment
├── train_index.py                  # Embedding index builder
├── requirements.txt                # Updated dependencies
└── index/                          # Embeddings for text parsing
```

---

## 🚀 Quick Start (Refactored System)

### 1. Generate Assignment Dataset

```bash
cd C:\Users\Mark\Projects\umal-management-backend
python generate_assignment_dataset.py
```

**Output**: `assignai_assignment_dataset.csv` (200 rows)

### 2. Train ML Model

```bash
python train_assignment_model.py
```

**Output**:
- `assignai_model.pkl` (RandomForest or XGBoost)
- `assignai_model_scaler.pkl`
- `assignai_model_metadata.pkl`

### 3. Start NLP Service

```bash
cd nlp-service
uvicorn main:app --reload
```

**Service**: http://localhost:8000  
**Docs**: http://localhost:8000/docs

---

## 📡 Updated API Endpoints

### **1. Parse Text (No Role)**

**POST** `/parse-request`

```json
{
  "text": "Need 5 students Friday morning"
}
```

**Response:**
```json
{
  "day": "Friday",
  "time_block": "Morning",
  "slots_needed": 5,
  "confidence": 0.89,
  "top_match": "..."
}
```

### **2. Predict Fair Assignments (NEW)**

**POST** `/predict-assignments`

```json
{
  "members": [
    {
      "member_id": "M001",
      "is_available": 1,
      "assignments_last_7_days": 0,
      "assignments_last_30_days": 2,
      "days_since_last_assignment": 15,
      "attendance_rate": 0.95
    },
    {
      "member_id": "M002",
      "is_available": 1,
      "assignments_last_7_days": 2,
      "assignments_last_30_days": 5,
      "days_since_last_assignment": 3,
      "attendance_rate": 0.85
    }
  ],
  "event_date": "2026-02-21",
  "event_size": 2
}
```

**Response:**
```json
{
  "recommended": [
    {
      "member_id": "M001",
      "assignment_probability": 0.87,
      "should_assign": true,
      ...
    }
  ],
  "all_candidates": [...],
  "event_size": 2,
  "coverage": true,
  "shortfall": 0
}
```

### **3. Explain Assignment (NEW)**

**POST** `/explain-assignment`

```json
{
  "member": {...},
  "event_date": "2026-02-21",
  "event_size": 3
}
```

**Response:**
```json
{
  "member_id": "M001",
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

## 🔄 Laravel Integration (Updated)

### **Step 1: Parse Admin Input**

```php
$nlpService = app(NLPService::class);

$parsed = $nlpService->parseRequest("Need 5 people Friday morning");
// Result: ['day' => 'Friday', 'time_block' => 'Morning', 'slots_needed' => 5]
// NO 'role' field anymore
```

### **Step 2: Get Available Members from Database**

```php
$members = Member::where('is_active', true)
    ->get()
    ->map(function ($member) use ($eventDate) {
        return [
            'member_id' => $member->id,
            'is_available' => $member->isAvailableOn($eventDate) ? 1 : 0,
            'assignments_last_7_days' => $member->assignmentsInLastDays(7),
            'assignments_last_30_days' => $member->assignmentsInLastDays(30),
            'days_since_last_assignment' => $member->daysSinceLastAssignment(),
            'attendance_rate' => $member->attendanceRate(),
        ];
    });
```

### **Step 3: Get ML-Based Recommendations**

```php
$response = Http::post('http://localhost:8000/predict-assignments', [
    'members' => $members->toArray(),
    'event_date' => $eventDate,
    'event_size' => $parsed['slots_needed']
]);

$recommendations = $response->json();

// Assign top N candidates
foreach ($recommendations['recommended'] as $candidate) {
    VolunteerAssignment::create([
        'event_id' => $event->id,
        'member_id' => $candidate['member_id'],
        'assigned_by' => auth()->id(),
        'assignment_score' => $candidate['assignment_probability']
    ]);
}
```

---

## 🎯 Assignment Logic

The ML model considers:

1. **Availability** (highest priority)
   - Only available members can be assigned

2. **Recent Activity** (fairness)
   - Fewer assignments in last 7/30 days → Higher priority
   - More days since last assignment → Higher priority

3. **Reliability**
   - Higher attendance rate → Higher priority

4. **Event Context**
   - Event size affects selection
   - Day of week patterns

---

## 📊 Model Performance

After training, you'll see:

```
Train Accuracy: 0.95
Test Accuracy:  0.93

Classification Report:
              precision    recall  f1-score

Not Assigned     0.96      0.94      0.95
Assigned         0.89      0.92      0.90

Feature Importance:
1. is_available                 0.4521
2. days_since_last_assignment   0.2134
3. assignments_last_7_days      0.1789
4. attendance_rate              0.0923
```

---

## 🧪 Testing

### Test Dataset Generation
```bash
python generate_assignment_dataset.py
```

### Test Model Training
```bash
python train_assignment_model.py
```

### Test Assignment Predictor
```bash
cd nlp-service
python assignment_predictor.py
```

### Test Full Service
```bash
# Terminal 1: Start service
uvicorn main:app --reload

# Terminal 2: Test
irm http://localhost:8000/predict-assignments -Method Post `
  -ContentType "application/json" `
  -Body '{...}'
```

---

## 🔧 Troubleshooting

### scikit-learn build error
```bash
# Use pre-built wheel
python -m pip install --only-binary :all: scikit-learn
```

### Model not found
```bash
# Train the model first
python generate_assignment_dataset.py
python train_assignment_model.py
```

### Low assignment accuracy
- Check class balance in dataset
- Adjust feature importance
- Retrain with more data

---

## 📝 Migration Checklist

- [x] Remove role-based logic from parser
- [x] Create assignment dataset generator
- [x] Train ML fairness model
- [x] Create assignment predictor service
- [x] Update FastAPI endpoints
- [ ] Update Laravel NLPService client
- [ ] Add member assignment tracking in DB
- [ ] Implement attendance rate calculation
- [ ] Test end-to-end flow
- [ ] Deploy models to production

---

## 🎓 Key Concepts

**Old System**: Text → Role/Day/Time/Slots → Manual Assignment

**New System**: 
1. Text → Day/Time/Slots (NLP)
2. Member Data → ML Model → Fair Recommendations
3. Laravel assigns top N candidates

**Benefits**:
- ✅ Fair distribution (no overworking members)
- ✅ No role bias (all members equal)
- ✅ Data-driven decisions
- ✅ Explainable recommendations
- ✅ Attendance tracking incentive

---

**Built for fairness and transparency** 🎯

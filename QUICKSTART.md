# ⚡ Quick Setup Guide - Refactored AssignAI

## 🎯 Complete Setup (5 Steps)

### Step 1: Generate Training Data (Old + New)
```powershell
# Generate NLP text dataset (for parsing day/time/slots)
python .\generate_dataset.py

# Generate ML assignment dataset (for fair assignment)
python .\generate_assignment_dataset.py
```

### Step 2: Train Models
```powershell
# Build text parsing index
cd nlp-service
python train_index.py

# Train assignment ML model
cd ..
python train_assignment_model.py
```

### Step 3: Install NLP Service Dependencies
```powershell
cd nlp-service
python -m pip install -r requirements.txt
```

### Step 4: Start the Service
```powershell
cd nlp-service
uvicorn main:app --reload
```

### Step 5: Test It
Open browser: http://localhost:8000/docs

---

## 📡 Test Commands (PowerShell)

### Parse Natural Language (No Role)
```powershell
$body = @{
    text = "Need 5 students Friday morning"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/parse-request" `
  -Method Post -ContentType "application/json" -Body $body
```

### Predict Fair Assignments  
```powershell
$body = @{
    members = @(
        @{
            member_id = "M001"
            is_available = 1
            assignments_last_7_days = 0
            assignments_last_30_days = 2
            days_since_last_assignment = 15
            attendance_rate = 0.95
        },
        @{
            member_id = "M002"
            is_available = 1
            assignments_last_7_days = 2
            assignments_last_30_days = 5
            days_since_last_assignment = 3
            attendance_rate = 0.85
        }
    )
    event_date = "2026-02-21"
    event_size = 2
} | ConvertTo-Json -Depth 10

Invoke-RestMethod -Uri "http://localhost:8000/predict-assignments" `
  -Method Post -ContentType "application/json" -Body $body
```

---

## 🔍 Verify Setup

### Check Health
```powershell
irm http://localhost:8000/health
```

**Expected:**
```json
{
  "status": "healthy",
  "model": "all-MiniLM-L6-v2",
  "index_size": 450,
  "assignment_model_loaded": true
}
```

---

## 📂 Files You Should Have

```
✅ assignai_training_dataset.csv       (450 rows - text parsing)
✅ assignai_assignment_dataset.csv     (200 rows - ML assignments)
✅ assignai_model.pkl                  (Trained ML model)
✅ assignai_model_scaler.pkl           (Feature scaler)
✅ assignai_model_metadata.pkl         (Model info)
✅ nlp-service/index/embeddings.npy    (Text embeddings)
✅ nlp-service/index/dataset.pkl       (Text dataset)
```

---

## 🚨 Common Issues

### scikit-learn won't install
```powershell
# Skip it for now - service will work without assignment predictor
python -m pip install fastapi uvicorn sentence-transformers pandas numpy
```

### Model not loaded warning
```
⚠️ Assignment model not found
```
**Fix**: Run `python train_assignment_model.py`

### Index not found error
```
FileNotFoundError: Index not found!
```
**Fix**: 
```powershell
cd nlp-service
python train_index.py
```

---

## ✅ Success Indicators

1. Generate dataset: `✅ Dataset saved: assignai_assignment_dataset.csv`
2. Train model: `✅ Model saved: assignai_model.pkl`
3. Start service: `Service ready! Access API docs at: http://localhost:8000/docs`
4. Health check: `"assignment_model_loaded": true`

---

## 🎯 What's Different

| Feature | Old System | New System |
|---------|-----------|------------|
| Role extraction | ✅ 7 roles | ❌ Removed |
| Task assignment | Manual | 🤖 ML-based |
| Fairness | Not tracked | ✅ Core feature |
| Assignment logic | Role matching | Availability + History |
| Explainability | None | ✅ Explain endpoint |

---

**Need help? Check REFACTOR_README.md for details**

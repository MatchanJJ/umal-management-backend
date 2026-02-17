# AssignAI NLP Service

**Lightweight Semantic NLP Microservice for Volunteer Scheduling**

A FastAPI-based service that converts natural language volunteer requests into structured scheduling data using semantic similarity with sentence-transformers.

---

## 🎯 Overview

This service parses admin requests like:

```
"Need 5 students Friday morning for campus tour."
```

Into structured output:

```json
{
  "role": "Campus Tour",
  "day": "Friday",
  "time_block": "Morning",
  "slots_needed": 5,
  "confidence": 0.87
}
```

---

## 🏗️ Architecture

- **Model**: `all-MiniLM-L6-v2` (fast, lightweight, CPU-friendly)
- **Method**: Semantic similarity-based classification (no heavy training)
- **Framework**: FastAPI for REST API
- **Integration**: Designed to be called by Laravel backend

---

## 📋 Prerequisites

- Python 3.8+
- pip
- Training dataset: `assignai_training_dataset.csv` (in parent directory)

---

## 🚀 Setup Instructions

### 1. Install Dependencies

```bash
cd nlp-service
python -m pip install -r requirements.txt
```

This will install:
- FastAPI & Uvicorn (API server)
- sentence-transformers (semantic embeddings)
- pandas & numpy (data handling)
- scikit-learn (similarity calculations)

### 2. Build the Embedding Index

**First, ensure your dataset exists:**
```bash
# Check if dataset exists in parent directory
ls ../assignai_training_dataset.csv
```

**Then build the index:**
```bash
python train_index.py
```

This will:
- Load the training dataset (450 examples)
- Encode all text into embeddings using MiniLM
- Save embeddings and dataset to `./index/` directory

**Output:**
```
============================================================
AssignAI NLP Index Builder
============================================================
Loading model: all-MiniLM-L6-v2
Loading dataset from: ../assignai_training_dataset.csv
Loaded 450 training examples
Encoding dataset into embeddings...
[Progress bar...]
Generated embeddings with shape: (450, 384)
Saved embeddings to: ./index/embeddings.npy
Saved dataset to: ./index/dataset.pkl
============================================================
Index built successfully!
============================================================
```

### 3. Start the Service

```bash
uvicorn main:app --reload
```

**Or:**
```bash
python main.py
```

The service will be available at: **http://localhost:8000**

API Documentation: **http://localhost:8000/docs**

---

## 📡 API Endpoints

### **POST** `/parse-request`

Parse a single volunteer request.

**Request:**
```json
{
  "text": "Need 4 ushers Friday morning"
}
```

**Response:**
```json
{
  "role": "Ushering",
  "day": "Friday",
  "time_block": "Morning",
  "slots_needed": 4,
  "confidence": 0.92,
  "top_match": "Need 5 volunteers on Friday morning for Ushering."
}
```

---

### **POST** `/parse-batch`

Parse multiple requests in batch.

**Request:**
```json
{
  "texts": [
    "Need 3 ushers Monday afternoon",
    "Looking for 5 volunteers for campus tour Wednesday morning"
  ]
}
```

**Response:**
```json
[
  {
    "role": "Ushering",
    "day": "Monday",
    "time_block": "Afternoon",
    "slots_needed": 3,
    "confidence": 0.89,
    "top_match": "..."
  },
  {
    "role": "Campus Tour",
    "day": "Wednesday",
    "time_block": "Morning",
    "slots_needed": 5,
    "confidence": 0.91,
    "top_match": "..."
  }
]
```

---

### **GET** `/health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "model": "all-MiniLM-L6-v2",
  "index_size": 450,
  "canonical_roles": [
    "Career Guidance",
    "Ushering",
    "Campus Tour",
    "Photoshoot Appearance",
    "Video Appearance",
    "Program Assistance",
    "Event Setup"
  ]
}
```

---

### **GET** `/roles`

List all canonical volunteer roles.

---

### **GET** `/days`

List valid days (Monday-Saturday).

---

### **POST** `/role-similarity`

Debug endpoint: Get similarity scores for each role.

**Request:**
```json
{
  "text": "Need people to guide visitors around campus"
}
```

**Response:**
```json
{
  "text": "Need people to guide visitors around campus",
  "role_scores": {
    "Career Guidance": 0.65,
    "Ushering": 0.71,
    "Campus Tour": 0.89,
    "Photoshoot Appearance": 0.42,
    "Video Appearance": 0.38,
    "Program Assistance": 0.67,
    "Event Setup": 0.51
  },
  "predicted_role": "Campus Tour"
}
```

---

## 🧪 Testing

### Test the parser standalone:

```bash
python parser.py
```

This will run test cases and show parsing results.

### Test via API (using curl):

```bash
curl -X POST "http://localhost:8000/parse-request" \
  -H "Content-Type: application/json" \
  -d '{"text": "Need 5 students Friday morning for campus tour"}'
```

### Interactive API testing:

Visit **http://localhost:8000/docs** for Swagger UI with interactive testing.

---

## 🎯 Canonical Roles

The system recognizes these 7 volunteer roles:

1. **Career Guidance** - Talking to SHS students about programs
2. **Ushering** - Managing guests and visitors
3. **Campus Tour** - Guiding visitors around campus
4. **Photoshoot Appearance** - Appearing in promotional photos
5. **Video Appearance** - Appearing in promotional videos
6. **Program Assistance** - Helping with event flow and activities
7. **Event Setup** - Preparing and organizing event spaces

---

## 🔧 How It Works

### 1. **Training Phase** (train_index.py)
   - Loads 450 training examples
   - Encodes each text into 384-dimensional embeddings
   - Saves embeddings + dataset to disk

### 2. **Inference Phase** (parser.py)
   - Encodes incoming request
   - Finds 5 most similar training examples (cosine similarity)
   - Extracts fields:
     - **Role**: Most common role among top matches
     - **Day**: Keyword matching + fallback to top matches
     - **Time**: Regex patterns (AM/PM/morning/afternoon)
     - **Slots**: Number extraction + fallback to average

### 3. **API Layer** (main.py)
   - FastAPI service exposing REST endpoints
   - CORS enabled for Laravel integration
   - Health checks and debugging endpoints

---

## 🔗 Laravel Integration

### Example PHP/Laravel HTTP Client Usage:

```php
use Illuminate\Support\Facades\Http;

$response = Http::post('http://localhost:8000/parse-request', [
    'text' => 'Need 5 volunteers Friday morning for campus tour'
]);

$data = $response->json();
// $data['role'] => "Campus Tour"
// $data['day'] => "Friday"
// $data['time_block'] => "Morning"
// $data['slots_needed'] => 5
```

---

## 📊 Performance

- **Model Size**: ~80MB (MiniLM)
- **Inference Time**: ~10-50ms per request (CPU)
- **Memory Usage**: ~200MB
- **Scalability**: Stateless, can run multiple instances

---

## 🛠️ Development

### Project Structure:

```
nlp-service/
├── main.py              # FastAPI service
├── parser.py            # Semantic parser logic
├── train_index.py       # Index builder
├── requirements.txt     # Dependencies
├── README.md           # This file
└── index/              # Generated index (after training)
    ├── embeddings.npy
    └── dataset.pkl
```

### Rebuild Index:
```bash
python train_index.py
```

### Run Tests:
```bash
python parser.py
```

### Production Deployment:
```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## 🚨 Troubleshooting

### Index not found error:
```
FileNotFoundError: Index not found!
```
**Solution:** Run `python train_index.py` first.

### Dataset not found error:
```
FileNotFoundError: [Errno 2] No such file or directory: '../assignai_training_dataset.csv'
```
**Solution:** Ensure the dataset CSV is in the parent directory or update the path in `train_index.py`.

### Low confidence scores:
- Check if input text is similar to training data
- Use `/role-similarity` endpoint to debug role classification
- Consider adding more training examples

---

## 📝 Notes

- This is a **deterministic semantic parser**, not a generative AI
- No OpenAI APIs or large LLMs required
- Runs entirely on CPU with fast inference
- Stateless design allows horizontal scaling
- CORS is configured for `*` - restrict in production

---

## 🎓 Next Steps

1. **Authentication**: Add API key authentication for production
2. **Monitoring**: Integrate logging and metrics
3. **Caching**: Add Redis for frequently parsed requests
4. **Feedback Loop**: Collect misparsed examples for dataset improvement
5. **Docker**: Containerize for easier deployment

---

## 📄 License

Part of the AssignAI project - University Multimedia Arts Laboratory (UMAL)

---

**Built with ❤️ for intelligent volunteer scheduling**

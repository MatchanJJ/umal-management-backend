"""
AssignAI NLP Microservice
FastAPI service for parsing volunteer scheduling requests and fair assignment prediction.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import os

from train_index import EmbeddingIndexer
from parser import VolunteerRequestParser
from assignment_predictor import AssignmentPredictor


# Request/Response Models
class ParseRequest(BaseModel):
    """Input model for parse endpoint."""
    text: str = Field(..., description="Natural language volunteer request", min_length=1)
    top_k: Optional[int] = Field(5, description="Number of similar examples to consider", ge=1, le=20)


class ParseResponse(BaseModel):
    """Output model for parse endpoint (NO role - all members can do all tasks)."""
    day: Optional[str] = Field(None, description="Day of the week")
    time_block: Optional[str] = Field(None, description="Morning or Afternoon")
    slots_needed: int = Field(..., description="Number of volunteers needed")
    confidence: float = Field(..., description="Confidence score (0-1)")
    top_match: str = Field(..., description="Most similar training example")


class MemberData(BaseModel):
    """Member data for assignment prediction"""
    member_id: str
    is_available: int = Field(..., ge=0, le=1, description="1=available, 0=not available")
    assignments_last_7_days: int = Field(0, ge=0)
    assignments_last_30_days: int = Field(0, ge=0)
    days_since_last_assignment: int = Field(30, ge=0)
    attendance_rate: float = Field(0.8, ge=0.0, le=1.0)


class AssignmentRequest(BaseModel):
    """Request for fair assignment prediction"""
    members: List[MemberData] = Field(..., min_items=1)
    event_date: str = Field(..., description="Event date (YYYY-MM-DD)")
    event_size: int = Field(..., ge=1, description="Number of volunteers needed")


class AssignmentResponse(BaseModel):
    """Response with recommended assignments"""
    recommended: List[Dict]
    all_candidates: List[Dict]
    event_size: int
    coverage: bool
    shortfall: int


class BatchParseRequest(BaseModel):
    """Input model for batch parse endpoint."""
    texts: List[str] = Field(..., description="List of natural language requests", min_items=1, max_items=50)


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model: str
    index_size: int
    assignment_model_loaded: bool


# Initialize FastAPI app
app = FastAPI(
    title="AssignAI NLP Service",
    description="Semantic NLP parser for volunteer scheduling requests",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add CORS middleware for Laravel backend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure this properly in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global parser and predictor instances
parser: Optional[VolunteerRequestParser] = None
assignment_predictor: Optional[AssignmentPredictor] = None


@app.on_event("startup")
async def startup_event():
    """Load models and index on startup."""
    global parser, assignment_predictor
    
    print("=" * 60)
    print("AssignAI NLP Service Starting...")
    print("=" * 60)
    
    try:
        # Check if index exists
        if not os.path.exists('./index/embeddings.npy'):
            raise FileNotFoundError(
                "Index not found! Please run 'python train_index.py' first to build the index."
            )
        
        # Load index for text parsing
        print("Loading embedding index...")
        indexer = EmbeddingIndexer()
        embeddings, dataset = indexer.load_index('./index')
        
        # Initialize parser
        print("Initializing parser...")
        parser = VolunteerRequestParser(embeddings, dataset)
        
        # Load assignment predictor (optional, won't fail startup if missing)
        try:
            print("Loading assignment predictor...")
            assignment_predictor = AssignmentPredictor(
                model_path='../assignai_model.pkl',
                scaler_path='../assignai_model_scaler.pkl'
            )
        except FileNotFoundError:
            print("⚠️  Assignment model not found. Run:")
            print("   1. python generate_assignment_dataset.py")
            print("   2. python train_assignment_model.py")
            print("   Assignment prediction endpoints will be unavailable.")
            assignment_predictor = None
        
        print("=" * 60)
        print("Service ready! Access API docs at: http://localhost:8000/docs")
        print("=" * 60)
        
    except Exception as e:
        print(f"ERROR: Failed to initialize service: {e}")
        raise


@app.get("/", response_model=Dict)
async def root():
    """Root endpoint with service info."""
    return {
        "service": "AssignAI NLP Service",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    if parser is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    return HealthResponse(
        status="healthy",
        model="all-MiniLM-L6-v2",
        index_size=len(parser.dataset),
        assignment_model_loaded=assignment_predictor is not None
    )


@app.post("/parse-request", response_model=ParseResponse)
async def parse_request(request: ParseRequest):
    """
    Parse a natural language volunteer request into structured fields.
    
    NO role extraction - all members can perform all tasks.
    Focus on day, time, and number of volunteers needed.
    
    Example:
    ```json
    {
        "text": "Need 5 students Friday morning"
    }
    ```
    
    Returns:
    ```json
    {
        "day": "Friday",
        "time_block": "Morning",
        "slots_needed": 5,
        "confidence": 0.87,
        "top_match": "Need 4 volunteers Friday morning."
    }
    ```
    """
    if parser is None:
        raise HTTPException(status_code=503, detail="Parser not initialized")
    
    try:
        result = parser.parse(request.text, top_k=request.top_k)
        return ParseResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parsing failed: {str(e)}")


@app.post("/parse-batch", response_model=List[ParseResponse])
async def parse_batch(request: BatchParseRequest):
    """
    Parse multiple volunteer requests in batch.
    
    Example:
    ```json
    {
        "texts": [
            "Need 3 volunteers Monday afternoon",
            "Looking for 5 people Wednesday morning"
        ]
    }
    ```
    """
    if parser is None:
        raise HTTPException(status_code=503, detail="Parser not initialized")
    
    try:
        results = parser.batch_parse(request.texts)
        return [ParseResponse(**result) for result in results]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch parsing failed: {str(e)}")


@app.post("/predict-assignments", response_model=AssignmentResponse)
async def predict_assignments(request: AssignmentRequest):
    """
    Predict fair volunteer assignments using ML model.
    
    Based on availability, participation history, and fairness principles.
    NO role-based assignment - all members can do all tasks.
    
    Example:
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
            }
        ],
        "event_date": "2026-02-21",
        "event_size": 3
    }
    ```
    
    Returns top N candidates ranked by fairness and availability.
    """
    if assignment_predictor is None:
        raise HTTPException(
            status_code=503,
            detail="Assignment predictor not loaded. Please train the model first."
        )
    
    try:
        # Convert Pydantic models to dicts
        members_data = [member.dict() for member in request.members]
        
        # Get recommendations
        result = assignment_predictor.recommend_assignments(
            members_data,
            request.event_date,
            request.event_size
        )
        
        return AssignmentResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Assignment prediction failed: {str(e)}")


@app.post("/explain-assignment")
async def explain_assignment(member: MemberData, event_date: str, event_size: int):
    """
    Explain why a specific member was/wasn't recommended for assignment.
    
    Useful for transparency and debugging.
    """
    if assignment_predictor is None:
        raise HTTPException(status_code=503, detail="Assignment predictor not loaded")
    
    try:
        explanation = assignment_predictor.explain_prediction(
            member.dict(),
            event_date,
            event_size
        )
        return explanation
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Explanation failed: {str(e)}")


@app.get("/days")
async def list_days():
    """List valid days of the week."""
    if parser is None:
        raise HTTPException(status_code=503, detail="Parser not initialized")
    
    return {
        "days": parser.DAYS,
        "count": len(parser.DAYS)
    }


if __name__ == "__main__":
    import uvicorn
    
    print("\nStarting AssignAI NLP Service...")
    print("Make sure you've built the index first: python train_index.py\n")
    print("NLP API will run on: http://localhost:8001")
    print("API Documentation at: http://localhost:8001/docs\n")
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level="info"
    )

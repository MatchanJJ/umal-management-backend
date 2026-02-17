"""
AssignAI NLP Microservice
FastAPI service for parsing volunteer scheduling requests using semantic similarity.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict
import os

from train_index import EmbeddingIndexer
from parser import VolunteerRequestParser


# Request/Response Models
class ParseRequest(BaseModel):
    """Input model for parse endpoint."""
    text: str = Field(..., description="Natural language volunteer request", min_length=1)
    top_k: Optional[int] = Field(5, description="Number of similar examples to consider", ge=1, le=20)


class ParseResponse(BaseModel):
    """Output model for parse endpoint."""
    role: str = Field(..., description="Extracted volunteer role")
    day: Optional[str] = Field(None, description="Day of the week")
    time_block: Optional[str] = Field(None, description="Morning or Afternoon")
    slots_needed: int = Field(..., description="Number of volunteers needed")
    confidence: float = Field(..., description="Confidence score (0-1)")
    top_match: str = Field(..., description="Most similar training example")


class BatchParseRequest(BaseModel):
    """Input model for batch parse endpoint."""
    texts: List[str] = Field(..., description="List of natural language requests", min_items=1, max_items=50)


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    model: str
    index_size: int
    canonical_roles: List[str]


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

# Global parser instance
parser: Optional[VolunteerRequestParser] = None


@app.on_event("startup")
async def startup_event():
    """Load model and index on startup."""
    global parser
    
    print("=" * 60)
    print("AssignAI NLP Service Starting...")
    print("=" * 60)
    
    try:
        # Check if index exists
        if not os.path.exists('./index/embeddings.npy'):
            raise FileNotFoundError(
                "Index not found! Please run 'python train_index.py' first to build the index."
            )
        
        # Load index
        print("Loading embedding index...")
        indexer = EmbeddingIndexer()
        embeddings, dataset = indexer.load_index('./index')
        
        # Initialize parser
        print("Initializing parser...")
        parser = VolunteerRequestParser(embeddings, dataset)
        
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
        canonical_roles=parser.CANONICAL_ROLES
    )


@app.post("/parse-request", response_model=ParseResponse)
async def parse_request(request: ParseRequest):
    """
    Parse a natural language volunteer request into structured fields.
    
    Example:
    ```json
    {
        "text": "Need 5 students Friday morning for campus tour"
    }
    ```
    
    Returns:
    ```json
    {
        "role": "Campus Tour",
        "day": "Friday",
        "time_block": "Morning",
        "slots_needed": 5,
        "confidence": 0.87,
        "top_match": "Need 4 volunteers Friday morning for campus tour."
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
            "Need 3 ushers Monday afternoon",
            "Looking for 5 volunteers for campus tour Wednesday morning"
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


@app.post("/role-similarity")
async def get_role_similarity(request: ParseRequest):
    """
    Get similarity scores for each canonical role.
    
    Useful for debugging and understanding role classification.
    """
    if parser is None:
        raise HTTPException(status_code=503, detail="Parser not initialized")
    
    try:
        scores = parser.get_role_similarity(request.text)
        return {
            "text": request.text,
            "role_scores": scores,
            "predicted_role": max(scores, key=scores.get)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.get("/roles")
async def list_roles():
    """List all canonical volunteer roles."""
    if parser is None:
        raise HTTPException(status_code=503, detail="Parser not initialized")
    
    return {
        "roles": parser.CANONICAL_ROLES,
        "count": len(parser.CANONICAL_ROLES)
    }


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
    
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )

"""
AssignAI NLP Microservice
FastAPI service for semantic constraint parsing (T5-small fine-tuned).
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict

from semantic_parser import SemanticParser


# ─── Pydantic Models ────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    semantic_parser_type: str = "none"  # 't5-fine-tuned' | 'fallback' | 'none'


class ChatEventContext(BaseModel):
    date: str = Field(..., description="Event date (YYYY-MM-DD)")
    time_block: Optional[str] = Field(None, description="Morning or Afternoon")
    event_size: int = Field(1, ge=1)


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_history: List[ChatMessage] = Field(default_factory=list)
    event_context: ChatEventContext
    previous_merged_constraints: Optional[Dict] = Field(
        None,
        description="Merged constraints from the previous turn. When provided, used as the "
                    "base instead of re-parsing all history, making each turn O(1)."
    )


class ChatResponse(BaseModel):
    parsed_constraints: Dict
    merged_constraints: Dict
    natural_reply: str
    is_confirming: bool = False


# ─── App Setup ───────────────────────────────────────────────────────────────

app = FastAPI(
    title="AssignAI NLP Service",
    description="Semantic constraint parser for volunteer scheduling",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

semantic_parser: Optional[SemanticParser] = None


# ─── Startup ─────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def startup_event():
    global semantic_parser

    print("=" * 60)
    print("AssignAI NLP Service Starting...")
    print("=" * 60)

    try:
        print("Initializing semantic parser (T5-based primary)...")
        semantic_parser = SemanticParser()

        parser_type = "t5-fine-tuned" if semantic_parser.is_fine_tuned else "fallback (rule-based)"
        print(f"✅ Semantic parser ready — mode: {parser_type}")
        print("=" * 60)
        print("Service ready! Docs: http://localhost:8001/docs")
        print("=" * 60)

    except Exception as e:
        print(f"ERROR: Failed to initialize service: {e}")
        raise


# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/", response_model=Dict)
async def root():
    return {
        "service": "AssignAI NLP Service",
        "version": "2.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health", response_model=HealthResponse)
async def health_check():
    if semantic_parser is None:
        raise HTTPException(status_code=503, detail="Service not initialized")

    return HealthResponse(
        status="healthy",
        semantic_parser_type=(
            "t5-fine-tuned" if (semantic_parser and semantic_parser.is_fine_tuned)
            else "fallback" if semantic_parser
            else "none"
        ),
    )


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Multi-turn constraint chat for AssignAI.

    Parses natural language into a multi-group constraint object and merges
    it with the conversation history.

    Supported constraints:
    - "2 females from CCE and 1 veteran male from CEE"
    - "3 freshie CCE members, no class conflicts"
    - "prioritize attendance"
    """
    if semantic_parser is None:
        raise HTTPException(status_code=503, detail="Semantic parser not initialized")

    try:
        parsed = semantic_parser.parse(request.message)

        if request.previous_merged_constraints is not None:
            # O(1) path: frontend echoes back the last merged state; just merge
            # the current turn on top of it — no need to re-parse history.
            base = request.previous_merged_constraints
        else:
            # Fallback (first turn or legacy clients): re-parse all history user
            # turns and accumulate into a fresh base.
            base: Dict = {
                "groups": [],
                "global": {"conflict_ok": None, "priority_rules": []},
                "is_confirming": False,
            }
            for turn in request.conversation_history:
                if turn.role == "user":
                    turn_parsed = semantic_parser.parse(turn.content)
                    base = semantic_parser.merge(base, turn_parsed)

        merged = semantic_parser.merge(base, parsed)
        natural_reply = semantic_parser.generate_reply(merged)

        return ChatResponse(
            parsed_constraints=parsed,
            merged_constraints=merged,
            natural_reply=natural_reply,
            is_confirming=bool(parsed.get("is_confirming", False)),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat parsing failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True, log_level="info")

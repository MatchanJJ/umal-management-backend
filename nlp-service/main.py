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
    date: Optional[str] = Field(None, description="Event date (YYYY-MM-DD)")
    time_block: Optional[str] = Field(None, description="Morning or Afternoon")
    event_size: Optional[int] = Field(1, ge=1)


class ChatMessage(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    conversation_history: Optional[List[ChatMessage]] = None
    event_context: Optional[ChatEventContext] = None
    previous_merged_constraints: Optional[Dict] = None


class ChatResponse(BaseModel):
    parsed_constraints: Dict
    merged_constraints: Dict
    natural_reply: str
    is_confirming: bool = False
    response_type: str = "constraint"  # "constraint" or "answer"


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


# ─── Helper Functions ────────────────────────────────────────────────────────

def classify_intent(message: str) -> str:
    """
    Lightweight heuristic to determine if a message is a constraint query or general question.
    Returns: 'constraint' or 'question'
    """
    msg_lower = message.lower()
    
    # Strong constraint indicators
    constraint_keywords = [
        'cce', 'cte', 'cee', 'cae', 'ccje', 'cbae', 'che', 'chse', 'case', 'cafe',  # colleges
        'from', 'male', 'female', 'freshie', 'veteran', 'new member', 'old member',
        'prioritize', 'priority', 'no class conflict', 'conflict', 'attendance first',
        'get me', 'i need', 'i want', 'assign', 'kumuha', 'kailangan'
    ]
    
    # Check for numbers (often indicates "X volunteers from...")
    has_number = any(c.isdigit() for c in message)
    
    # Check for constraint keywords
    has_constraint_keyword = any(keyword in msg_lower for keyword in constraint_keywords)
    
    # Strong question indicators
    question_indicators = [
        'what', 'how', 'who', 'when', 'where', 'why', 'which',
        'show me', 'list', 'tell me', 'explain', 'help',
        'what is', 'how many', 'who are'
    ]
    
    has_question_word = any(indicator in msg_lower for indicator in question_indicators)
    
    # Decision logic
    if has_constraint_keyword or has_number:
        return 'constraint'
    elif has_question_word:
        return 'question'
    else:
        # Default to constraint for ambiguous cases (original behavior)
        return 'constraint'


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
    Multi-turn chat for AssignAI with multi-task support.

    Handles both:
    1. Constraint parsing: "2 females from CCE and 1 veteran male from CEE"
    2. General Q&A: "What is UMAL?", "Show me CCE members"
    
    The system automatically routes between constraint parsing and conversational Q&A.
    """
    if semantic_parser is None:
        raise HTTPException(status_code=503, detail="Semantic parser not initialized")

    try:
        # Classify intent
        intent = classify_intent(request.message)
        
        if intent == 'constraint':
            # ─── Constraint Parsing Path ───
            parsed = semantic_parser.parse(request.message)

            if request.previous_merged_constraints is not None:
                # O(1) path: frontend echoes back the last merged state
                base = request.previous_merged_constraints
            else:
                # Fallback: re-parse all history
                base: Dict = {
                    "groups": [],
                    "global": {"conflict_ok": None, "priority_rules": []},
                    "is_confirming": False,
                }
                history = request.conversation_history or []
                for turn in history:
                    if turn.role == "user":
                        turn_parsed = semantic_parser.parse(turn.content)
                        base = semantic_parser.merge(base, turn_parsed)

            merged = semantic_parser.merge(base, parsed)
            
            # Use T5 for dynamic reply generation if model is ready
            if semantic_parser.is_fine_tuned:
                natural_reply = semantic_parser.generate_reply_from_json(merged)
            else:
                natural_reply = semantic_parser.generate_reply(merged)

            return ChatResponse(
                parsed_constraints=parsed,
                merged_constraints=merged,
                natural_reply=natural_reply,
                is_confirming=bool(parsed.get("is_confirming", False)),
                response_type="constraint",
            )
        
        else:
            # ─── General Q&A Path ───
            qa_response = semantic_parser.answer_question(request.message)
            
            if qa_response["type"] == "query":
                # Return the raw query directive for Laravel to parse
                return ChatResponse(
                    parsed_constraints={},
                    merged_constraints={},
                    natural_reply=qa_response['content'],  # Pass through unchanged
                    is_confirming=False,
                    response_type="query",  # Needs data from Laravel
                )
            elif qa_response["type"] == "redirect":
                # Model detected this should be handled as constraint
                # Recursively call with constraint handling
                parsed = semantic_parser.parse(request.message)
                merged = parsed  # First turn, no merge needed
                natural_reply = semantic_parser.generate_reply_from_json(merged) if semantic_parser.is_fine_tuned else semantic_parser.generate_reply(merged)
                
                return ChatResponse(
                    parsed_constraints=parsed,
                    merged_constraints=merged,
                    natural_reply=natural_reply,
                    is_confirming=False,
                    response_type="constraint",
                )
            elif qa_response["type"] == "error":
                # Error in Q&A generation
                return ChatResponse(
                    parsed_constraints={},
                    merged_constraints={},
                    natural_reply=qa_response["content"],
                    is_confirming=False,
                    response_type="answer",  # Just an answer, no recommendations
                )
            else:
                # Normal answer
                return ChatResponse(
                    parsed_constraints={},
                    merged_constraints={},
                    natural_reply=qa_response["content"],
                    is_confirming=False,
                    response_type="answer",  # Just an answer, no recommendations
                )
                
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat processing failed: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True, log_level="info")

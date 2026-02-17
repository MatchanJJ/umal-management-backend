You are helping build the NLP layer of a system called **AssignAI: An Agentic NLP-Based Volunteer Scheduling and Assignment System**.

Your task is to implement a **lightweight semantic NLP model** that converts natural language admin requests into structured scheduling data.

This NLP module will run as a **Python microservice** that will later be called by a Laravel backend. Do NOT build Laravel code — only the NLP service.

---

## PROJECT GOAL

Admins describe volunteer needs using natural language such as:

"Need 5 students Friday morning for campus tour."
"Looking for ushers this Wednesday afternoon."
"Assign 3 volunteers for SHS career talk on Monday AM."

The NLP system must extract structured fields:

{
"role": "...",
"day": "...",
"time_block": "Morning | Afternoon",
"slots_needed": integer
}

This output will be consumed by Laravel for scheduling decisions.

---

## DOMAIN ROLES (STRICT VOCABULARY)

The organization only supports these roles:

* Career Guidance (talking to SHS students / university promotion)
* Ushering
* Campus Tour
* Photoshoot Appearance
* Video Appearance
* Program Assistance
* Event Setup

The model must map varied language INTO these canonical labels.

Example:
"guide visitors" → Campus Tour
"help manage program flow" → Program Assistance

---

## MODEL REQUIREMENTS

Use:

* sentence-transformers
* model: all-MiniLM-L6-v2

Reason:
Fast, lightweight, CPU-friendly, ideal for semantic similarity.

Do NOT use large LLMs.

---

## DATASET

Load the provided CSV dataset containing columns:

text, role, day, time_block, slots_needed

Use it to build a semantic matching system (NOT heavy training).

We are NOT fine-tuning from scratch.
We are encoding and using similarity-based classification.

---

## IMPLEMENTATION TASKS

1. Load MiniLM model using SentenceTransformer.
2. Encode all dataset "text" entries into embeddings.
3. Store embeddings in memory (or FAISS if desired).
4. For a new request:

   * Encode the input sentence
   * Find most similar dataset examples
   * Infer structured labels from nearest matches.
5. Return extracted fields as JSON.

---

## BUILD AN API

Create a FastAPI service:

POST /parse-request

Input:
{
"text": "Need 4 ushers Friday morning"
}

Output:
{
"role": "Ushering",
"day": "Friday",
"time_block": "Morning",
"slots_needed": 4
}

---

## EXTRACTION RULES

slots_needed:

* Extract numbers using regex.
* Default to 1 if not specified.

day:

* Detect Monday–Saturday keywords.

time_block:

* Map AM/morning → Morning
* PM/afternoon → Afternoon

role:

* Determined via semantic similarity using embeddings.

---

## DO NOT:

* Do not build a chatbot.
* Do not generate text.
* Do not use OpenAI APIs.
* Do not fine-tune large transformers.
* Do not add authentication yet.

This is a deterministic semantic parser, not a generative AI.

---

## DELIVERABLES

Produce:

1. train_index.py → builds embedding index
2. parser.py → performs similarity lookup
3. main.py → FastAPI service
4. requirements.txt
5. Clear instructions to run locally.

The service must run via:

uvicorn main:app --reload

---

## ARCHITECTURE CONTEXT

This service will later be called by:

Next.js → Laravel → FastAPI NLP → PostgreSQL scheduling logic

## So keep it modular and stateless.

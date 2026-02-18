# AssignAI — Agentic NLP Volunteer Assignment Feature

## Primary Goal

Implement the **AssignAI Agentic NLP Module** to assist Adviser/Admin users in assigning volunteers to events by interpreting natural language requests and generating intelligent assignment recommendations based on predefined scheduling and fairness criteria.

---

## Feature Overview

AssignAI acts as a **decision-support assistant**, not an automatic enforcer.

It will:

1. Interpret user prompts (via NLP).
2. Identify the target event and requirements.
3. Analyze member availability and workload.
4. Recommend volunteers.
5. Allow Adviser/Admin to approve or reject the recommendations.

---

## Feature 1 — AssignAI Button Inside Event View

### Add a new action when viewing an event:

**Button:** `Assign Using AI`

### Behavior:

* Opens AssignAI panel (modal or side panel).
* Automatically loads:

  * Event Date
  * Event Time
  * Required Volunteer Count (if already defined)

### AssignAI will:

Analyze members based on:

* Availability (Morning/Afternoon)
* No class conflict (if applicable)
* Fair distribution of assignments
* Participation history

### Adviser/Admin Options:

* **Accept Suggestions** → System finalizes assignments.
* **Regenerate** → AI recalculates suggestions.
* **Cancel** → No assignment made.

---

## Feature 2 — Dedicated “AssignAI” Tab

Create a standalone navigation tab:

**Menu:** `AssignAI`

This allows Adviser/Admin to interact with AssignAI *even before opening an event.*

---

## Feature 3 — Natural Language Prompt Interface

Inside AssignAI tab, provide an input box.

### Example Prompts:

```
Need 5 volunteers for March 12 afternoon
Assign students for campus tour tomorrow morning
We need 3 volunteers this Friday
```

---

## Feature 4 — NLP Interpretation Layer

The system must extract structured data from prompts:

| Field           | Example             |
| --------------- | ------------------- |
| event_date      | 2026-03-12          |
| time_slot       | Morning / Afternoon |
| volunteer_count | 5                   |

---

## Feature 5 — Event Resolution Logic

After NLP extraction:

### Case A — Matching Event Exists

* Load that event.
* Run assignment recommendation.
* Show suggested volunteers.

### Case B — Event Does Not Exist

Show message:

> “No event found for this schedule. Please create the event first.”

Provide button:

* ➡ `Create Event`
* Redirect to Event Creation Form (pre-filled with parsed data).

---

## Feature 6 — AI Recommendation Engine

AssignAI suggests volunteers using:

* Availability match
* Fair workload distribution
* Recent participation avoidance
* Attendance reliability

**No role matching required** — all members are capable.

---

## Feature 7 — Human-in-the-Loop Approval (Agentic Behavior)

AssignAI **does not auto-assign**.

Instead it provides:

* Suggested volunteers
* Reasoning explanation:

  ```
  Selected due to availability and balanced participation.
  ```

Admin/Adviser must confirm before assignment is finalized.

---

## Why This Is “Agentic NLP”

The system:

1. Understands human language (NLP).
2. Reasons over constraints (availability, fairness).
3. Generates decisions autonomously.
4. Requests human confirmation before execution.

---

## Acceptance Criteria

* ✔ Adviser can assign volunteers using AI from Event Page
* ✔ AssignAI Tab allows prompt-driven assignment
* ✔ System detects whether an event exists
* ✔ Suggestions are explainable and editable
* ✔ No automatic assignments without approval
* ✔ Works with existing Member Availability + Event schema
* ✔ Fully modular (Python microservice callable from Laravel)

---

## Technical Implementation Notes

### Architecture

* **Laravel Backend**

  * UI
  * Event Management
  * Member Management
  * Final Assignment Persistence

* **Python Microservice**

  * NLP Parsing Layer
  * Assignment Recommendation Engine

---

### API Contract

#### Request

```
POST /assignai/suggest
Content-Type: application/json

{
  "prompt": "Need 4 volunteers tomorrow afternoon"
}
```

#### Response

```
{
  "event_id": 12,
  "suggested_members": [3,7,9,10],
  "explanation": "Balanced assignment and availability match"
}
```

---

## System Flow Summary

1. Adviser inputs request (button or AssignAI tab).
2. NLP parses natural language → structured event data.
3. System checks if event exists.
4. Assignment model evaluates eligible members.
5. AI generates recommendations + explanation.
6. Adviser/Admin approves or rejects.
7. Laravel stores final assignments.

---

## Integration Goal

The AssignAI module must remain:

* **Stateless**
* **API-driven**
* **Replaceable / scalable**
* **Independent from Laravel core logic**

This ensures future upgrades (better NLP or models) can be integrated without rewriting the main system.

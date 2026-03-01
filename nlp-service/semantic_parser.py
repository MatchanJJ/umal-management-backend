"""
Semantic Parser — Runtime Inference
=====================================
Uses the fine-tuned T5-small model to convert natural language volunteer
constraints into the structured multi-group schema.

If the fine-tuned model is not yet available (first run), falls back
gracefully to the regex + cosine ConstraintParser.

Schema output:
{
  "groups": [
    {"count": 2, "college": "CCE", "gender": "F", "new_old": "new"},
    {"count": 1, "college": "CEE", "gender": "M", "new_old": "old"}
  ],
  "global": {
    "conflict_ok": false,
    "priority_rules": ["attendance_first"]
  },
  "is_confirming": false
}
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

MODEL_DIR = Path(__file__).parent / "semantic_model"
TOK_DIR   = Path(__file__).parent / "semantic_tokenizer"

PREFIX      = "parse constraint: "
MAX_IN_LEN  = 128
MAX_OUT_LEN = 256

VALID_COLLEGES  = {"CCE", "CTE", "CEE", "CAE", "CCJE", "CBAE", "CHE", "CHSE", "CASE", "CAFE"}
VALID_GENDERS   = {"M", "F"}
VALID_NEW_OLD   = {"new", "old"}
VALID_PRIORITY  = {"male_first", "female_first", "new_first", "old_first", "attendance_first"}
VALID_HEIGHT_RULES = {"male_taller_than_female", "female_taller_than_male", "tallest_first", "shortest_first"}

EMPTY_RESULT: Dict[str, Any] = {
    "groups":       [],
    "global":       {"conflict_ok": None, "priority_rules": [], "height_rule": None},
    "is_confirming": False,
}

# ─────────────────────────────────────────────────────────────────────────────
# Validator — clean/repair model output
# ─────────────────────────────────────────────────────────────────────────────

def _validate_group(g: Any) -> Optional[Dict]:
    if not isinstance(g, dict):
        return None
    out: Dict[str, Any] = {}
    if isinstance(g.get("count"), int) and g["count"] > 0:
        out["count"] = g["count"]
    if g.get("college") in VALID_COLLEGES:
        out["college"] = g["college"]
    if g.get("gender") in VALID_GENDERS:
        out["gender"] = g["gender"]
    if g.get("new_old") in VALID_NEW_OLD:
        out["new_old"] = g["new_old"]
    if isinstance(g.get("height_min"), int) and 100 <= g["height_min"] <= 250:
        out["height_min"] = g["height_min"]
    if isinstance(g.get("height_max"), int) and 100 <= g["height_max"] <= 250:
        out["height_max"] = g["height_max"]
    return out if out else None


def _validate(raw: Dict) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "groups":        [],
        "global":        {"conflict_ok": None, "priority_rules": []},
        "is_confirming": False,
    }

    # groups — validate and deduplicate identical entries
    seen_keys: List[tuple] = []
    for g in raw.get("groups", []):
        vg = _validate_group(g)
        if vg is None:
            continue
        key = tuple(sorted(vg.items()))
        if key not in seen_keys:
            seen_keys.append(key)
            result["groups"].append(vg)

    # global
    glob = raw.get("global", {})
    if isinstance(glob, dict):
        if isinstance(glob.get("conflict_ok"), bool):
            result["global"]["conflict_ok"] = glob["conflict_ok"]
        rules = [r for r in glob.get("priority_rules", []) if r in VALID_PRIORITY]
        result["global"]["priority_rules"] = rules
        if glob.get("height_rule") in VALID_HEIGHT_RULES:
            result["global"]["height_rule"] = glob["height_rule"]

    # is_confirming
    if raw.get("is_confirming") is True:
        result["is_confirming"] = True

    return result


# ─────────────────────────────────────────────────────────────────────────────
# Main class
# ─────────────────────────────────────────────────────────────────────────────

class SemanticParser:
    """
    T5-small based semantic parser for volunteer assignment constraints.
    Falls back to legacy ConstraintParser if fine-tuned model is absent.
    """

    def __init__(self):
        self._model     = None
        self._tokenizer = None
        self._device    = None
        self._fallback  = None
        self._ready     = False

        self._load()

    def _load(self):
        if MODEL_DIR.exists() and TOK_DIR.exists():
            try:
                import torch
                from transformers import T5ForConditionalGeneration, T5TokenizerFast

                print("[SemanticParser] Loading fine-tuned T5-small model…")
                self._tokenizer = T5TokenizerFast.from_pretrained(str(TOK_DIR))
                self._model     = T5ForConditionalGeneration.from_pretrained(str(MODEL_DIR))
                self._device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
                self._model.to(self._device)
                self._model.eval()
                self._ready = True
                print(f"[SemanticParser] T5 ready on {self._device} ✓")
            except Exception as e:
                print(f"[SemanticParser] T5 load failed ({e}), falling back to ConstraintParser")
                self._init_fallback()
        else:
            print("[SemanticParser] Fine-tuned model not found — using ConstraintParser fallback")
            print("  Run: python generate_semantic_data.py && python fine_tune_semantic.py")
            self._init_fallback()

    def _init_fallback(self):
        try:
            from parser import ConstraintParser
            self._fallback = ConstraintParser()
        except Exception as e:
            print(f"[SemanticParser] Fallback ConstraintParser also failed: {e}")

    @property
    def is_fine_tuned(self) -> bool:
        return self._ready

    # ─────────────────────────────────────────────────────────────────────────
    # Public API
    # ─────────────────────────────────────────────────────────────────────────

    def parse(self, text: str) -> Dict[str, Any]:
        """
        Parse natural language into structured constraint dict.
        Always returns a valid schema even on failure.
        """
        if self._ready:
            return self._parse_t5(text)
        if self._fallback:
            return self._parse_legacy(text)
        return dict(EMPTY_RESULT)

    def merge(self, base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge two parsed constraint dicts across turns.

        Group merge strategy:
        - MODIFIER turn  (no college in any override group, base is non-empty):
            Apply gender / new_old / height fields to EVERY existing base group.
            e.g. "all female pls" → patches each base group with gender=F.
        - SPECIFICATION turn (any override group has a college, or base is empty):
            Replace groups entirely with the override groups.
            e.g. "2 from CCE and 1 from CASE" → new group list.

        Global:
        - conflict_ok: later non-None wins
        - priority_rules / height_rule: accumulated (unique), later wins for height_rule
        - is_confirming: current turn only
        """
        merged: Dict[str, Any] = {
            "groups":        list(base.get("groups", [])),
            "global":        {
                "conflict_ok":    base.get("global", {}).get("conflict_ok"),
                "priority_rules": list(base.get("global", {}).get("priority_rules", [])),
                "height_rule":    base.get("global", {}).get("height_rule"),
            },
            "is_confirming": False,
        }

        override_groups = override.get("groups", [])
        if override_groups:
            base_groups = merged["groups"]

            # A "specification" override has at least one group with a college set.
            # A "modifier" override only carries attribute patches (gender, new_old, height).
            is_modifier = (
                bool(base_groups)
                and not any(g.get("college") for g in override_groups)
            )

            if is_modifier:
                # Build a patch dict from all override groups' attribute-only fields.
                # Never patch "count" from a modifier turn — the user didn't re-specify a
                # number, so T5 just emits the default 1, which would overwrite the real count.
                patch: Dict[str, Any] = {}
                for og in override_groups:
                    for key in ("gender", "new_old", "height_min", "height_max"):
                        if og.get(key) is not None:
                            patch[key] = og[key]

                if patch:
                    merged["groups"] = [dict(g, **patch) for g in base_groups]
                # else: empty patch — leave base groups untouched
            else:
                # Full replacement — new college-scoped groups
                merged["groups"] = override_groups

        og = override.get("global", {})
        if og.get("conflict_ok") is not None:
            merged["global"]["conflict_ok"] = og["conflict_ok"]

        for rule in og.get("priority_rules", []):
            if rule not in merged["global"]["priority_rules"]:
                merged["global"]["priority_rules"].append(rule)

        if og.get("height_rule") in VALID_HEIGHT_RULES:
            merged["global"]["height_rule"] = og["height_rule"]

        if override.get("is_confirming"):
            merged["is_confirming"] = True

        return merged

    def generate_reply(self, merged: Dict[str, Any]) -> str:
        """Human-readable summary of current accumulated constraints."""
        parts = []

        groups = merged.get("groups", [])
        if groups:
            group_descs = []
            for g in groups:
                desc_parts = []
                if g.get("count"):
                    desc_parts.append(str(g["count"]))
                if g.get("new_old") == "new":
                    desc_parts.append("new")
                elif g.get("new_old") == "old":
                    desc_parts.append("experienced")
                if g.get("gender") == "M":
                    desc_parts.append("male")
                elif g.get("gender") == "F":
                    desc_parts.append("female")
                if g.get("college"):
                    desc_parts.append(g["college"])
                if g.get("height_min"):
                    desc_parts.append(f">={g['height_min']}cm")
                if g.get("height_max"):
                    desc_parts.append(f"<={g['height_max']}cm")
                group_descs.append(" ".join(desc_parts) if desc_parts else "volunteer(s)")
            parts.append("groups: " + ", ".join(group_descs))

        glob = merged.get("global", {})
        if glob.get("conflict_ok") is False:
            parts.append("no class conflicts")
        elif glob.get("conflict_ok") is True:
            parts.append("class conflict OK")

        for rule in glob.get("priority_rules", []):
            label = {
                "male_first":       "males first",
                "female_first":     "females first",
                "new_first":        "new members first",
                "old_first":        "veterans first",
                "attendance_first": "highest attendance first",
            }.get(rule, rule)
            parts.append(label)

        hr = glob.get("height_rule")
        if hr == "male_taller_than_female":
            parts.append("male taller than female")
        elif hr == "female_taller_than_male":
            parts.append("female taller than male")
        elif hr == "tallest_first":
            parts.append("tallest members first")
        elif hr == "shortest_first":
            parts.append("shortest members first")

        if not parts:
            return "Got it! I'll recommend the best available volunteers based on fairness, availability, and workload balance."

        return f"Understood — I'll look for {'; '.join(parts)}. Fetching recommendations now…"

    def generate_reply_from_json(self, constraints: Dict[str, Any]) -> str:
        """
        Use T5 to dynamically convert JSON constraints to natural language.
        Falls back to template-based generation if model not ready.
        """
        if not self._ready:
            return self.generate_reply(constraints)  # Fallback to templates
        
        try:
            # Clean constraints to match training data format:
            # 1. Remove is_confirming (not in Task B training)
            # 2. Remove null/empty global fields (height_rule, empty lists, etc.)
            clean_constraints = {}
            
            # Copy groups as-is
            if 'groups' in constraints:
                clean_constraints['groups'] = constraints['groups']
            
            # Clean global object - only include non-null, non-empty values
            if 'global' in constraints:
                clean_global = {}
                for key, value in constraints['global'].items():
                    # Include if: not None, not empty list, not 'height_rule' (not in training)
                    if value is not None and not (isinstance(value, list) and len(value) == 0) and key != 'height_rule':
                        clean_global[key] = value
                        
                # Only include global if it has content
                if clean_global:
                    clean_constraints['global'] = clean_global
                    
            json_str = json.dumps(clean_constraints, ensure_ascii=False)
            prompt = f"generate reply: {json_str}"
            # Use deterministic decoding (temp=0) to prevent hallucination
            response = self._generate_text(prompt, max_tokens=128, temperature=0.0)
            # Basic sanity check - if response is too short or looks like JSON, fall back
            if len(response) < 10 or response.strip().startswith('{'):
                return self.generate_reply(constraints)
            return response
        except Exception as e:
            print(f"[SemanticParser] Reply generation failed ({e}), using template")
            return self.generate_reply(constraints)

    def answer_question(self, question: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Use T5 to answer general organization questions.
        Returns dict with 'type' and 'content' keys.
        
        Response types:
        - 'answer': Direct text answer
        - 'query': Needs data from Laravel (e.g., [QUERY:members:college=CCE])
        - 'error': Failed to generate response
        """
        if not self._ready:
            return {
                "type": "error",
                "content": "Q&A capability requires the fine-tuned model. Please run training."
            }
        
        try:
            prompt = f"answer question: {question}"
            # Lower temperature for more consistent Q&A responses
            response = self._generate_text(prompt, max_tokens=150, temperature=0.3)
            
            # Check if model is requesting data
            if response.startswith("[QUERY:"):
                return {
                    "type": "query",
                    "content": response
                }
            
            # Check if model indicates it's a constraint (might be misrouted)
            if response.startswith("[INTENT:constraint]"):
                return {
                    "type": "redirect",
                    "content": "constraint_parsing"
                }
            
            return {
                "type": "answer",
                "content": response
            }
        except Exception as e:
            print(f"[SemanticParser] Q&A failed ({e})")
            return {
                "type": "error",
                "content": f"I encountered an error processing your question: {str(e)}"
            }

    def _generate_text(self, prompt: str, max_tokens: int = 128, temperature: float = 0.7) -> str:
        """
        Generic T5 text generation for multi-task inference.
        Used by both reply generation and Q&A methods.
        """
        import torch
        
        enc = self._tokenizer(
            prompt,
            return_tensors="pt",
            max_length=MAX_IN_LEN,
            truncation=True,
        ).to(self._device)
        
        with torch.no_grad():
            out = self._model.generate(
                **enc,
                max_new_tokens=max_tokens,
                num_beams=1,  # Pure greedy decoding (was 3)
                temperature=temperature,
                do_sample=temperature > 0,
                early_stopping=True,
            )
        
        return self._tokenizer.decode(out[0], skip_special_tokens=True).strip()

    # ─────────────────────────────────────────────────────────────────────────
    # Internal
    # ─────────────────────────────────────────────────────────────────────────

    def _parse_t5(self, text: str) -> Dict[str, Any]:
        import torch
        # Add task-specific prefix for multi-task T5
        prompt = f"parse constraint: {text}"
        enc = self._tokenizer(
            prompt,
            return_tensors="pt",
            max_length=MAX_IN_LEN,
            truncation=True,
        ).to(self._device)
        with torch.no_grad():
            out = self._model.generate(
                **enc,
                max_new_tokens=MAX_OUT_LEN,
                num_beams=4,
                early_stopping=True,
            )
        decoded = self._tokenizer.decode(out[0], skip_special_tokens=True).strip()

        # How many groups does the raw text imply? (count the "count": occurrences)
        implied_groups = len(re.findall(r'"count"\s*:', decoded))

        # Strategy 1: valid JSON already
        try:
            validated = _validate(json.loads(decoded))
            # If JSON collapsed multi-groups, fall through to better strategies
            if implied_groups <= len(validated.get("groups", [])) or implied_groups == 0:
                return validated
        except json.JSONDecodeError:
            pass

        # Strategy 2: regex extraction — most reliable for multi-group flat arrays
        extracted = self._extract_from_malformed(decoded)
        if extracted is not None:
            validated = _validate(extracted)
            if len(validated.get("groups", [])) >= implied_groups or implied_groups == 0:
                return validated

        # Strategy 3: structural JSON fix (handles simple missing-brace cases)
        fixed = self._fix_t5_json(decoded)
        if fixed is not None:
            return _validate(fixed)

        # Fallback
        if extracted is not None:
            return _validate(extracted)

        return dict(EMPTY_RESULT)

    def _parse_legacy(self, text: str) -> Dict[str, Any]:
        """Convert old flat ConstraintParser output to new multi-group schema."""
        old = self._fallback.parse(text)

        groups: List[Dict] = []
        g: Dict[str, Any] = {}
        if old.get("gender_filter") and old["gender_filter"] not in ("split",):
            g["gender"] = old["gender_filter"]
        if old.get("new_old_filter") and old["new_old_filter"] not in ("split",):
            g["new_old"] = old["new_old_filter"]
        if old.get("college_filter"):
            g["college"] = old["college_filter"]
        if g:
            groups.append(g)

        return {
            "groups": groups,
            "global": {
                "conflict_ok":    old.get("conflict_ok"),
                "priority_rules": old.get("priority_rules", []),
            },
            "is_confirming": old.get("is_confirming", False),
        }

    @staticmethod
    def _fix_t5_json(text: str) -> Optional[Dict]:
        """
        Structural normalisation for T5 outputs that are almost-valid JSON.
        Handles these common T5 quirks:
          "groups": ["count": 2]          → {"groups": [{"count": 2}]}
          "is_confirming": true            → {"is_confirming": true}
          "groups": [{"count": 1, ...}     → closes open bracket/brace
        """
        t = text.strip()

        # Wrap in {} when missing
        if not t.startswith("{"):
            t = "{" + t + "}"

        # Fix array elements missing opening {
        # ["key": → [{"key":
        t = re.sub(r'\[\s*"([a-z_]+)"\s*:', r'[{"\1":', t)

        # Fix multiple items after }, that are missing {
        # }, "key":  →  }, {"key":
        t = re.sub(r'},\s*"([a-z_]+)"\s*:', r'}, {"\1":', t)

        # Add } before ] when last array element isn't closed
        # "value"]  →  "value"}]    (only when inside what looks like an object)
        t = re.sub(r'("(?:[^"\\]|\\.)*"|\d+|true|false|null)\s*\]', r'\1}]', t)

        # Close any remaining open brackets/braces
        t += "]" * max(0, t.count("[") - t.count("]"))
        t += "}" * max(0, t.count("{") - t.count("}"))

        try:
            return json.loads(t)
        except Exception:
            return None

    @staticmethod
    def _extract_from_malformed(text: str) -> Optional[Dict]:
        """
        Last-resort regex extraction for deeply malformed T5 output.
        Pulls known fields by pattern, ignoring all structural JSON issues.
        """
        result: Dict[str, Any] = {}

        # is_confirming
        if re.search(r'"is_confirming"\s*:\s*true', text, re.I):
            result["is_confirming"] = True
            return result   # confirming turns have no groups

        # conflict_ok
        m = re.search(r'"conflict_ok"\s*:\s*(true|false)', text, re.I)
        if m:
            result.setdefault("global", {})["conflict_ok"] = m.group(1).lower() == "true"

        # priority_rules
        m = re.search(r'"priority_rules"\s*:\s*\[([^\]]*)\]', text)
        if m:
            rules = re.findall(r'"([a-z_]+)"', m.group(1))
            result.setdefault("global", {})["priority_rules"] = rules

        # groups — locate groups array content, then split by "count" occurrences
        m = re.search(r'"groups"\s*:\s*\[(.+?)(?:\]|}|$)', text, re.DOTALL)
        if m:
            groups_raw = m.group(1)
            count_hits = [
                (mo.start(), int(mo.group(1)))
                for mo in re.finditer(r'"count"\s*:\s*(\d+)', groups_raw)
            ]
            if count_hits:
                groups: List[Dict] = []
                boundaries = [pos for pos, _ in count_hits] + [len(groups_raw)]
                for i, (pos, count) in enumerate(count_hits):
                    chunk = groups_raw[pos : boundaries[i + 1]]
                    g: Dict[str, Any] = {"count": count}
                    cm = re.search(r'"college"\s*:\s*"([A-Z]+)"', chunk)
                    if cm:
                        g["college"] = cm.group(1)
                    gm = re.search(r'"gender"\s*:\s*"([MF])"', chunk)
                    if gm:
                        g["gender"] = gm.group(1)
                    nm = re.search(r'"new_old"\s*:\s*"(new|old)"', chunk)
                    if nm:
                        g["new_old"] = nm.group(1)
                    hmin = re.search(r'"height_min"\s*:\s*(\d+)', chunk)
                    if hmin:
                        g["height_min"] = int(hmin.group(1))
                    hmax = re.search(r'"height_max"\s*:\s*(\d+)', chunk)
                    if hmax:
                        g["height_max"] = int(hmax.group(1))
                    groups.append(g)
                result["groups"] = groups

        # height_rule (global)
        hr = re.search(r'"height_rule"\s*:\s*"([a-z_]+)"', text)
        if hr:
            result.setdefault("global", {})["height_rule"] = hr.group(1)

        return result if result else None

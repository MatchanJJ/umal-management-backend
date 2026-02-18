"""
Parser Module
Performs semantic similarity lookup and extracts structured fields from natural language.
Includes ConstraintParser for multi-slot constraint extraction (gender, new/old, conflict, college, priority).
"""

import re
import json
import os
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import Dict, List, Optional, Any


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Calculate cosine similarity between vectors."""
    a_norm = a / (np.linalg.norm(a, axis=1, keepdims=True) + 1e-9)
    b_norm = b / (np.linalg.norm(b, axis=1, keepdims=True) + 1e-9)
    return np.dot(a_norm, b_norm.T)


class VolunteerRequestParser:
    """Semantic parser for volunteer scheduling requests."""
    
    # Days mapping
    DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    
    # Time block patterns
    TIME_PATTERNS = {
        'Morning': r'\b(morning|am|a\.m\.|a\.m|morn)\b',
        'Afternoon': r'\b(afternoon|pm|p\.m\.|p\.m|aft)\b'
    }
    
    def __init__(self, embeddings: np.ndarray, dataset, model_name='all-MiniLM-L6-v2'):
        """
        Initialize parser with pre-built embeddings and dataset.
        
        Args:
            embeddings: Pre-computed embeddings from training data
            dataset: Training dataset (pandas DataFrame)
            model_name: SentenceTransformer model name
        """
        self.model = SentenceTransformer(model_name)
        self.embeddings = embeddings
        self.dataset = dataset
        print(f"Parser initialized with {len(dataset)} examples")
    
    def parse(self, text: str, top_k: int = 5) -> Dict:
        """
        Parse natural language request into structured fields.
        
        Args:
            text: Natural language volunteer request
            top_k: Number of similar examples to consider
            
        Returns:
            Dictionary with day, time_block, slots_needed (NO role - all members can do all tasks)
        """
        # Encode input text
        query_embedding = self.model.encode([text], convert_to_numpy=True)
        
        # Find most similar examples
        similarities = cosine_similarity(query_embedding, self.embeddings)[0]
        top_indices = np.argsort(similarities)[-top_k:][::-1]
        
        # Get top matches
        top_matches = self.dataset.iloc[top_indices]
        
        # Extract fields (NO role - removed as per requirements)
        result = {
            'day': self._extract_day(text, top_matches),
            'time_block': self._extract_time_block(text, top_matches),
            'slots_needed': self._extract_slots(text, top_matches),
        }
        
        # Add confidence metadata
        result['confidence'] = float(similarities[top_indices[0]])
        result['top_match'] = top_matches.iloc[0]['event_text']
        
        return result
    
    def _extract_day(self, text: str, top_matches) -> Optional[str]:
        """Extract day of the week from text."""
        text_lower = text.lower()
        
        # Try direct keyword matching first
        for day in self.DAYS:
            if day.lower() in text_lower:
                return day
        
        # Fallback to most common day in top matches
        day_counts = top_matches['day'].value_counts()
        if len(day_counts) > 0:
            return day_counts.index[0]
        
        return None
    
    def _extract_time_block(self, text: str, top_matches) -> Optional[str]:
        """Extract time block (Morning/Afternoon) from text."""
        text_lower = text.lower()
        
        # Try pattern matching
        for time_block, pattern in self.TIME_PATTERNS.items():
            if re.search(pattern, text_lower, re.IGNORECASE):
                return time_block
        
        # Fallback to most common time block in top matches
        time_counts = top_matches['time_block'].value_counts()
        if len(time_counts) > 0:
            return time_counts.index[0]
        
        return None
    
    def _extract_slots(self, text: str, top_matches) -> int:
        """Extract number of volunteers needed from text."""
        # Try to find numbers in text
        numbers = re.findall(r'\b(\d+)\b', text)
        
        if numbers:
            # Use the first number found (usually the slot count)
            return int(numbers[0])
        
        # Fallback to average from top matches
        avg_slots = int(round(top_matches['slots_needed'].mean()))
        return max(1, avg_slots)  # Ensure at least 1
    
    def batch_parse(self, texts: List[str]) -> List[Dict]:
        """Parse multiple requests in batch."""
        return [self.parse(text) for text in texts]


# ─────────────────────────────────────────────────────────────────────────────
# Multi-slot constraint parser
# ─────────────────────────────────────────────────────────────────────────────

SLOT_NAMES = ['gender', 'new_old', 'conflict', 'college', 'priority']

# Per-slot similarity threshold — must beat this to be counted as a match
THRESHOLD = {
    'gender':   0.52,
    'new_old':  0.52,
    'conflict': 0.50,
    'college':  0.55,
    'priority': 0.50,
}


class ConstraintParser:
    """
    Multi-slot semantic parser that extracts volunteer assignment constraints
    from natural language using a per-slot MiniLM embedding index.

    Slots extracted:
        gender_filter  : "M" | "F" | "split" | None
        new_old_filter : "new" | "old" | "split" | None
        conflict_ok    : True | False | None
        college_filter : str (e.g. "CCS", "COED") | None
        priority_rules : List[str] (e.g. ["male_first"]) | []
    """

    _HINT_PATTERNS = {
        'gender':   re.compile(
            r'\b(male|female|lalaki|babae|boys?|girls?|guys?|ladies|men|women|gender|puro)\b',
            re.IGNORECASE),
        'new_old':  re.compile(
            r'\b(new|old|fresh(ie|men|man)?|veteran|senior|bago|luma|rookie|experienc|baguhan|batch)\b',
            re.IGNORECASE),
        'conflict': re.compile(
            r'\b(class|klase|conflict|schedule|free|no class|kahit may|skip)\b',
            re.IGNORECASE),
        'college':  re.compile(
            r'\b(CCE|CTE|CEE|CAE|CCJE|CBAE|CHE|CHSE|CASE|CAFE|college|computing|engineering|accounting|criminology|hospitality|business|teacher|IT|BSCS|BSED|BSIT|BSBA)\b',
            re.IGNORECASE),
        'priority': re.compile(
            r'\b(prioriti|rank|first|muna|higher|prefer|important|focus)\b',
            re.IGNORECASE),
    }

    # Fast-path regex for user confirming they want to proceed with assignment
    _CONFIRM_PATTERN = re.compile(
        r'\b(yes|yeah|yep|yup|sure|okay|ok|go ahead|proceed|assign them|assign|confirm|push through|do it|sige|oo|opo|tuloy|gastos na)\b',
        re.IGNORECASE
    )

    def __init__(self, model_name: str = 'all-MiniLM-L6-v2',
                 examples_path: Optional[str] = None):
        if examples_path is None:
            examples_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)),
                'constraint_examples.json'
            )

        print(f"[ConstraintParser] Loading examples from {examples_path}")
        with open(examples_path, 'r', encoding='utf-8') as f:
            self._examples: Dict[str, List[Dict]] = json.load(f)

        print(f"[ConstraintParser] Loading encoder model: {model_name}")
        self._model = SentenceTransformer(model_name)

        self._slot_index: Dict[str, tuple] = {}
        for slot in SLOT_NAMES:
            if slot not in self._examples:
                continue
            texts  = [ex['text'] for ex in self._examples[slot]]
            values = [ex['value'] for ex in self._examples[slot]]
            embs   = self._model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
            self._slot_index[slot] = (embs, values)
            print(f"[ConstraintParser]   {slot}: {len(texts)} examples indexed")

        print("[ConstraintParser] Ready.")

    def parse(self, text: str) -> Dict[str, Any]:
        """
        Parse natural language into a structured constraint dict.

        Returns:
            {
                'gender_filter':  "M" | "F" | "split" | None,
                'new_old_filter': "new" | "old" | "split" | None,
                'conflict_ok':    True | False | None,
                'college_filter': str | None,
                'priority_rules': [str, ...],
            }
        """
        query_emb = self._model.encode([text], convert_to_numpy=True)

        constraints: Dict[str, Any] = {
            'gender_filter':  None,
            'new_old_filter': None,
            'conflict_ok':    None,
            'college_filter': None,
            'priority_rules': [],
            'is_confirming':  bool(self._CONFIRM_PATTERN.search(text)),
        }

        for slot, (slot_embs, slot_values) in self._slot_index.items():
            hint_pat = self._HINT_PATTERNS.get(slot)
            if hint_pat and not hint_pat.search(text):
                continue

            sims = cosine_similarity(query_emb, slot_embs)[0]
            best_idx  = int(np.argmax(sims))
            best_sim  = float(sims[best_idx])

            if best_sim < THRESHOLD.get(slot, 0.5):
                continue

            value = slot_values[best_idx]

            if slot == 'gender':
                constraints['gender_filter'] = value
            elif slot == 'new_old':
                constraints['new_old_filter'] = value
            elif slot == 'conflict':
                constraints['conflict_ok'] = bool(value)
            elif slot == 'college':
                constraints['college_filter'] = str(value)
            elif slot == 'priority':
                rule = str(value)
                if rule not in constraints['priority_rules']:
                    constraints['priority_rules'].append(rule)

        return constraints

    @staticmethod
    def merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
        """
        Merge two constraint dicts.  Later (override) values win for scalar
        slots.  priority_rules are accumulated (unique, order preserved).
        """
        merged = dict(base)

        for key in ('gender_filter', 'new_old_filter', 'conflict_ok', 'college_filter'):
            if override.get(key) is not None:
                merged[key] = override[key]

        existing = list(merged.get('priority_rules') or [])
        for rule in (override.get('priority_rules') or []):
            if rule not in existing:
                existing.append(rule)
        merged['priority_rules'] = existing

        # is_confirming is per-turn only, don't merge it
        merged['is_confirming'] = override.get('is_confirming', False)

        return merged

    def generate_reply(self, merged: Dict[str, Any]) -> str:
        """Build a short, friendly acknowledgment of the current merged constraints."""
        parts = []

        g = merged.get('gender_filter')
        if g == 'M':
            parts.append("male members only")
        elif g == 'F':
            parts.append("female members only")
        elif g == 'split':
            parts.append("an equal gender split")

        no = merged.get('new_old_filter')
        if no == 'new':
            parts.append("new members (freshies)")
        elif no == 'old':
            parts.append("experienced / veteran members")
        elif no == 'split':
            parts.append("a mix of new and experienced members")

        co = merged.get('conflict_ok')
        if co is False:
            parts.append("no class conflicts")
        elif co is True:
            parts.append("class conflicts are okay")

        col = merged.get('college_filter')
        if col:
            parts.append(f"from {col} college")

        priority_labels = {
            'male_first':       'males ranked first',
            'female_first':     'females ranked first',
            'new_first':        'new members ranked first',
            'old_first':        'veterans ranked first',
            'attendance_first': 'highest attendance ranked first',
        }
        for rule in (merged.get('priority_rules') or []):
            label = priority_labels.get(rule, rule.replace('_', ' '))
            if label not in parts:
                parts.append(label)

        if not parts:
            return ("Got it! I'll recommend the best available volunteers based on "
                    "fairness, availability, and workload balance.")

        if len(parts) == 1:
            conj = parts[0]
        else:
            conj = ', '.join(parts[:-1]) + ' and ' + parts[-1]

        return (f"Understood — I'll look for volunteers with {conj}. "
                "Fetching recommendations now\u2026")


def test_parser():
    """Test the parser with sample inputs."""
    from train_index import EmbeddingIndexer
    
    print("Loading index...")
    indexer = EmbeddingIndexer()
    embeddings, dataset = indexer.load_index('./index')
    
    print("\nInitializing parser...")
    parser = VolunteerRequestParser(embeddings, dataset)
    
    # Test cases (NO role - all members can do all tasks)
    test_cases = [
        "Need 5 students Friday morning",
        "Looking for 3 volunteers this Wednesday afternoon",
        "Assign 4 members on Monday AM",
        "We need 2 people for Tuesday afternoon event",
        "Get me 6 volunteers for Saturday morning",
    ]
    
    print("\n" + "=" * 60)
    print("Testing Parser (Role-Free)")
    print("=" * 60)
    
    for text in test_cases:
        print(f"\nInput: {text}")
        result = parser.parse(text)
        print(f"Output:")
        print(f"  Day: {result['day']}")
        print(f"  Time: {result['time_block']}")
        print(f"  Slots: {result['slots_needed']}")
        print(f"  Confidence: {result['confidence']:.3f}")


if __name__ == '__main__':
    test_parser()

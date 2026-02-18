"""
Parser Module
Performs semantic similarity lookup and extracts structured fields from natural language.
"""

import re
import numpy as np
from sentence_transformers import SentenceTransformer
from typing import Dict, List, Optional


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Calculate cosine similarity between vectors."""
    # Normalize vectors
    a_norm = a / np.linalg.norm(a, axis=1, keepdims=True)
    b_norm = b / np.linalg.norm(b, axis=1, keepdims=True)
    # Compute dot product
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

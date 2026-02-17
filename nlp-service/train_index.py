"""
Train Index Module
Builds semantic embeddings from the training dataset for similarity-based classification.
"""

import pandas as pd
import numpy as np
from sentence_transformers import SentenceTransformer
import pickle
import os
from pathlib import Path


class EmbeddingIndexer:
    """Handles encoding and storing embeddings from training data."""
    
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        """Initialize with MiniLM model for fast CPU inference."""
        print(f"Loading model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.embeddings = None
        self.dataset = None
        
    def load_dataset(self, csv_path='../assignai_training_dataset.csv'):
        """Load training dataset from CSV."""
        print(f"Loading dataset from: {csv_path}")
        self.dataset = pd.read_csv(csv_path)
        print(f"Loaded {len(self.dataset)} training examples")
        return self.dataset
    
    def build_embeddings(self):
        """Encode all text entries into embeddings."""
        if self.dataset is None:
            raise ValueError("Dataset not loaded. Call load_dataset() first.")
        
        print("Encoding dataset into embeddings...")
        texts = self.dataset['event_text'].tolist()
        
        # Generate embeddings with progress
        self.embeddings = self.model.encode(
            texts,
            show_progress_bar=True,
            convert_to_numpy=True
        )
        
        print(f"Generated embeddings with shape: {self.embeddings.shape}")
        return self.embeddings
    
    def save_index(self, index_dir='./index'):
        """Save embeddings and dataset to disk."""
        Path(index_dir).mkdir(parents=True, exist_ok=True)
        
        embeddings_path = os.path.join(index_dir, 'embeddings.npy')
        dataset_path = os.path.join(index_dir, 'dataset.pkl')
        
        # Save embeddings as numpy array
        np.save(embeddings_path, self.embeddings)
        print(f"Saved embeddings to: {embeddings_path}")
        
        # Save dataset with pickle
        with open(dataset_path, 'wb') as f:
            pickle.dump(self.dataset, f)
        print(f"Saved dataset to: {dataset_path}")
        
        print("Index building complete!")
    
    def load_index(self, index_dir='./index'):
        """Load pre-built index from disk."""
        embeddings_path = os.path.join(index_dir, 'embeddings.npy')
        dataset_path = os.path.join(index_dir, 'dataset.pkl')
        
        if not os.path.exists(embeddings_path) or not os.path.exists(dataset_path):
            raise FileNotFoundError(f"Index not found in {index_dir}. Run build_index() first.")
        
        self.embeddings = np.load(embeddings_path)
        with open(dataset_path, 'rb') as f:
            self.dataset = pickle.load(f)
        
        print(f"Loaded index: {len(self.dataset)} examples, embedding dim: {self.embeddings.shape[1]}")
        return self.embeddings, self.dataset


def main():
    """Build and save the embedding index."""
    print("=" * 60)
    print("AssignAI NLP Index Builder")
    print("=" * 60)
    
    # Initialize indexer
    indexer = EmbeddingIndexer()
    
    # Load dataset
    indexer.load_dataset('../assignai_training_dataset.csv')
    
    # Build embeddings
    indexer.build_embeddings()
    
    # Save index
    indexer.save_index('./index')
    
    print("\n" + "=" * 60)
    print("Index built successfully!")
    print("You can now start the FastAPI service with: uvicorn main:app --reload")
    print("=" * 60)


if __name__ == '__main__':
    main()

"""
Fair Volunteer Assignment Predictor

Uses trained ML model to predict which members should be assigned to events
based on availability, fairness, and participation history.
"""

import pickle
import numpy as np
import pandas as pd
from datetime import datetime
from typing import List, Dict, Optional


class AssignmentPredictor:
    """Predicts fair volunteer assignments using trained ML model"""
    
    def __init__(self, model_path='../assignai_model.pkl', scaler_path='../assignai_model_scaler.pkl'):
        """
        Initialize predictor with trained model and scaler.
        
        Args:
            model_path: Path to trained model (.pkl)
            scaler_path: Path to fitted scaler (.pkl)
        """
        self.model = None
        self.scaler = None
        self.feature_names = None
        self.load_model(model_path, scaler_path)
    
    def load_model(self, model_path: str, scaler_path: str):
        """Load trained model and scaler"""
        try:
            # Load model
            with open(model_path, 'rb') as f:
                self.model = pickle.load(f)
            print(f"✅ Model loaded from: {model_path}")
            
            # Load scaler
            with open(scaler_path, 'rb') as f:
                self.scaler = pickle.load(f)
            print(f"✅ Scaler loaded from: {scaler_path}")
            
            # Try to load metadata
            try:
                metadata_path = model_path.replace('.pkl', '_metadata.pkl')
                with open(metadata_path, 'rb') as f:
                    metadata = pickle.load(f)
                    self.feature_names = metadata['feature_names']
                    print(f"✅ Metadata loaded: {metadata['model_type']}")
            except FileNotFoundError:
                print("⚠️  Metadata file not found. Using default feature names.")
                self.feature_names = [
                    'is_available',
                    'assignments_last_7_days',
                    'assignments_last_30_days',
                    'days_since_last_assignment',
                    'attendance_rate',
                    'event_size',
                    'event_day_of_week',
                    'event_date_ordinal'
                ]
                
        except FileNotFoundError as e:
            print(f"❌ Error loading model: {e}")
            raise
    
    def predict_assignments(
        self,
        members: List[Dict],
        event_date: str,
        event_size: int
    ) -> List[Dict]:
        """
        Predict which members should be assigned to an event.
        
        Args:
            members: List of member dicts with keys:
                - member_id: str
                - is_available: 1 or 0
                - assignments_last_7_days: int
                - assignments_last_30_days: int
                - days_since_last_assignment: int
                - attendance_rate: float (0-1)
            event_date: str (YYYY-MM-DD)
            event_size: int (number of volunteers needed)
            
        Returns:
            List of dicts with member data + assignment probability, sorted by priority
        """
        if not members:
            return []
        
        # Prepare features for all members
        features_list = []
        for member in members:
            features = self._prepare_features(member, event_date, event_size)
            features_list.append(features)
        
        # Convert to DataFrame
        X = pd.DataFrame(features_list, columns=self.feature_names)
        
        # Scale features
        X_scaled = self.scaler.transform(X)
        
        # Predict probabilities
        proba = self.model.predict_proba(X_scaled)[:, 1]  # Probability of being assigned
        
        # Combine with member data
        results = []
        for i, member in enumerate(members):
            results.append({
                **member,
                'assignment_probability': float(proba[i]),
                'should_assign': bool(proba[i] >= 0.5 and member.get('is_available', 0) == 1)
            })
        
        # Sort by probability (highest first)
        results.sort(key=lambda x: x['assignment_probability'], reverse=True)
        
        return results
    
    def recommend_assignments(
        self,
        members: List[Dict],
        event_date: str,
        event_size: int
    ) -> Dict:
        """
        Recommend fair assignments with top N candidates.
        
        Returns:
            {
                'recommended': List of top N members to assign,
                'all_candidates': All members with scores,
                'event_size': Number of volunteers needed,
                'coverage': Whether enough volunteers are available
            }
        """
        # Get predictions
        all_candidates = self.predict_assignments(members, event_date, event_size)
        
        # Filter only available members
        available_candidates = [m for m in all_candidates if m.get('is_available', 0) == 1]
        
        # Get top N by probability
        recommended = available_candidates[:event_size]
        
        return {
            'recommended': recommended,
            'all_candidates': all_candidates,
            'event_size': int(event_size),
            'coverage': bool(len(recommended) >= event_size),
            'shortfall': int(max(0, event_size - len(recommended)))
        }
    
    def _prepare_features(self, member: Dict, event_date: str, event_size: int) -> List:
        """Prepare feature vector for a single member"""
        # Convert event_date to features
        event_dt = datetime.strptime(event_date, '%Y-%m-%d')
        event_day_of_week = event_dt.weekday()  # 0=Monday, 6=Sunday
        event_date_ordinal = event_dt.toordinal()
        
        # Build feature vector in correct order
        features = [
            member.get('is_available', 0),
            member.get('assignments_last_7_days', 0),
            member.get('assignments_last_30_days', 0),
            member.get('days_since_last_assignment', 30),
            member.get('attendance_rate', 0.8),
            event_size,
            event_day_of_week,
            event_date_ordinal
        ]
        
        return features
    
    def explain_prediction(self, member: Dict, event_date: str, event_size: int) -> Dict:
        """
        Explain why a member was/wasn't recommended.
        
        Returns factors contributing to decision.
        """
        features = self._prepare_features(member, event_date, event_size)
        X = pd.DataFrame([features], columns=self.feature_names)
        X_scaled = self.scaler.transform(X)
        
        proba = self.model.predict_proba(X_scaled)[0, 1]
        
        explanation = {
            'member_id': member.get('member_id'),
            'assignment_probability': float(proba),
            'factors': {
                'is_available': 'Available' if member.get('is_available') == 1 else 'Not Available',
                'recent_assignments_7d': f"{member.get('assignments_last_7_days', 0)} events",
                'recent_assignments_30d': f"{member.get('assignments_last_30_days', 0)} events",
                'days_since_last': f"{member.get('days_since_last_assignment', 0)} days ago",
                'attendance_rate': f"{member.get('attendance_rate', 0)*100:.0f}%",
            },
            'recommendation': 'ASSIGN' if proba >= 0.5 and member.get('is_available') == 1 else 'DO NOT ASSIGN'
        }
        
        return explanation


def test_predictor():
    """Test the assignment predictor"""
    print("="*60)
    print("Testing Assignment Predictor")
    print("="*60)
    
    # Initialize predictor
    predictor = AssignmentPredictor()
    
    # Mock member data
    members = [
        {
            'member_id': 'M001',
            'is_available': 1,
            'assignments_last_7_days': 0,
            'assignments_last_30_days': 2,
            'days_since_last_assignment': 15,
            'attendance_rate': 0.95
        },
        {
            'member_id': 'M002',
            'is_available': 1,
            'assignments_last_7_days': 2,
            'assignments_last_30_days': 5,
            'days_since_last_assignment': 3,
            'attendance_rate': 0.85
        },
        {
            'member_id': 'M003',
            'is_available': 0,  # Not available
            'assignments_last_7_days': 0,
            'assignments_last_30_days': 1,
            'days_since_last_assignment': 20,
            'attendance_rate': 0.90
        },
        {
            'member_id': 'M004',
            'is_available': 1,
            'assignments_last_7_days': 0,
            'assignments_last_30_days': 0,
            'days_since_last_assignment': 45,
            'attendance_rate': 0.75
        },
    ]
    
    # Test prediction
    event_date = '2026-02-21'  # Friday
    event_size = 2
    
    print(f"\n📅 Event: {event_date}, Need: {event_size} volunteers")
    print("-"*60)
    
    recommendations = predictor.recommend_assignments(members, event_date, event_size)
    
    print(f"\n🎯 Recommended Assignments:")
    for member in recommendations['recommended']:
        print(f"  {member['member_id']} - Probability: {member['assignment_probability']:.3f}")
    
    print(f"\n📊 All Candidates (sorted by priority):")
    for member in recommendations['all_candidates']:
        avail = "✅" if member['is_available'] == 1 else "❌"
        print(f"  {avail} {member['member_id']:5s} - Prob: {member['assignment_probability']:.3f}")
    
    print(f"\n✅ Coverage: {recommendations['coverage']}")
    if recommendations['shortfall'] > 0:
        print(f"⚠️  Short by {recommendations['shortfall']} volunteers")
    
    # Test explanation
    print(f"\n🔍 Explanation for M001:")
    explanation = predictor.explain_prediction(members[0], event_date, event_size)
    print(f"  Recommendation: {explanation['recommendation']}")
    print(f"  Probability: {explanation['assignment_probability']:.3f}")
    print(f"  Factors:")
    for key, value in explanation['factors'].items():
        print(f"    - {key}: {value}")


if __name__ == '__main__':
    test_predictor()

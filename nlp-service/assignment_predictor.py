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
import warnings

try:
    import shap
    SHAP_AVAILABLE = True
except ImportError:
    SHAP_AVAILABLE = False
    warnings.warn("SHAP not installed. Install with: pip install shap")


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
        self.shap_explainer = None
        self.load_model(model_path, scaler_path)
        if SHAP_AVAILABLE:
            self.load_shap_explainer()
    
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
                    'has_class_conflict',
                    'gender',
                    'is_new_member',
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
    
    def load_shap_explainer(self):
        """Initialize SHAP explainer for model interpretability"""
        try:
            if not SHAP_AVAILABLE:
                print("⚠️  SHAP not available, skipping explainer initialization")
                return
            
            # Use TreeExplainer for RandomForest/XGBoost
            self.shap_explainer = shap.TreeExplainer(self.model)
            print("✅ SHAP explainer initialized")
        except Exception as e:
            print(f"⚠️  Failed to initialize SHAP explainer: {e}")
            self.shap_explainer = None
    
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
        
        # ── Fairness adjustment ────────────────────────────────────────────
        # Penalise over-assigned members, boost under-assigned ones.
        # Based on assignments_last_30_days relative to the group mean/std.
        workloads = np.array([m.get('assignments_last_30_days', 0) for m in members], dtype=float)
        group_mean = float(np.mean(workloads))
        group_std  = float(np.std(workloads))

        # Combine with member data
        results = []
        for i, member in enumerate(members):
            raw_prob = float(proba[i])
            # z-score: positive = over-assigned, negative = under-assigned
            z = (workloads[i] - group_mean) / (group_std + 1e-6) if group_std > 0 else 0.0
            # multiplier < 1 for over-assigned, > 1 for under-assigned (clamped 0.3 – 2.0)
            multiplier = float(np.clip(1.0 - 0.20 * z, 0.3, 2.0))
            adjusted   = float(np.clip(raw_prob * multiplier, 0.0, 1.0))

            fairness_bias = 'boosted' if z < -0.5 else ('penalised' if z > 0.5 else 'neutral')

            results.append({
                **member,
                'assignment_probability': raw_prob,
                'fairness_adjusted_score': adjusted,
                'fairness_bias': fairness_bias,
                'should_assign': bool(adjusted >= 0.5 and member.get('is_available', 0) == 1)
            })

        # Sort by fairness-adjusted score (highest first)
        results.sort(key=lambda x: x['fairness_adjusted_score'], reverse=True)

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
        
        # Filter only available members (already sorted by fairness_adjusted_score)
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
            member.get('has_class_conflict', 0),
            member.get('gender', 0),                          # M=1, F=0
            member.get('is_new_member', 0),                   # 1 if current school year batch
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
    
    def explain_with_shap(self, member: Dict, event_date: str, event_size: int) -> Dict:
        """
        Explain prediction using SHAP values for enhanced interpretability.
        
        Returns SHAP-based explanation with feature contributions.
        """
        if not SHAP_AVAILABLE or self.shap_explainer is None:
            return {
                'error': 'SHAP explainer not available',
                'fallback': self.explain_prediction(member, event_date, event_size)
            }
        
        try:
            # Prepare features
            features = self._prepare_features(member, event_date, event_size)
            X = pd.DataFrame([features], columns=self.feature_names)
            X_scaled = self.scaler.transform(X)
            
            # Get prediction probability
            proba = self.model.predict_proba(X_scaled)[0, 1]
            
            # Calculate SHAP values using new API (SHAP 0.40+)
            explanation = self.shap_explainer(X_scaled)
            shap_vals = explanation.values  # shape: (n_samples, n_features) or (n_samples, n_features, n_classes)
            
            # Handle 3D array from binary classification (n_samples, n_features, n_classes)
            if shap_vals.ndim == 3:
                shap_vals = shap_vals[:, :, 1]  # Use positive class
            
            # Get base value
            base_value = explanation.base_values
            if hasattr(base_value, '__len__'):
                # Array of base values - take first sample
                base_value = base_value[0]
                # If still array (n_classes,), take class 1
                if hasattr(base_value, '__len__'):
                    base_value = base_value[1]
            
            # Create feature contributions list
            contributions = []
            for i, feature_name in enumerate(self.feature_names):
                contributions.append({
                    'feature': feature_name,
                    'value': float(X.iloc[0, i]),
                    'shap_value': float(shap_vals[0, i]),
                    'display_name': self._format_feature_name(feature_name),
                    'display_value': self._format_feature_value(feature_name, X.iloc[0, i])
                })
            
            # Sort by absolute SHAP value (most important first)
            contributions.sort(key=lambda x: abs(x['shap_value']), reverse=True)
            
            # Split into positive and negative contributors
            positive_factors = [c for c in contributions if c['shap_value'] > 0][:3]
            negative_factors = [c for c in contributions if c['shap_value'] < 0][:3]
            
            narrative = self._generate_shap_narrative(contributions)

            return {
                'member_id': member.get('member_id'),
                'assignment_probability': float(proba),
                'base_value': float(base_value),
                'shap_contributions': contributions,
                'top_positive_factors': positive_factors,
                'top_negative_factors': negative_factors,
                'narrative': narrative,
                'recommendation': 'ASSIGN' if proba >= 0.5 and member.get('is_available') == 1 else 'DO NOT ASSIGN',
                'explanation_method': 'SHAP TreeExplainer'
            }
        except Exception as e:
            return {
                'error': f'SHAP calculation failed: {str(e)}',
                'fallback': self.explain_prediction(member, event_date, event_size)
            }
    
    def _format_feature_name(self, feature_name: str) -> str:
        """Convert feature name to human-readable format"""
        name_map = {
            'is_available': 'Availability',
            'has_class_conflict': 'Class conflict',
            'gender': 'Gender',
            'is_new_member': 'New member',
            'assignments_last_7_days': 'Recent assignments (7 days)',
            'assignments_last_30_days': 'Recent assignments (30 days)',
            'days_since_last_assignment': 'Days since last assignment',
            'attendance_rate': 'Attendance rate',
            'event_size': 'Event size',
            'event_day_of_week': 'Day of week',
            'event_date_ordinal': 'Event date',
            'college_id': 'College',
            'year_level': 'Year level'
        }
        return name_map.get(feature_name, feature_name)
    
    def _format_feature_value(self, feature_name: str, value: float) -> str:
        """Format feature value for display"""
        if feature_name == 'is_available':
            return 'Available' if value == 1 else 'Not available'
        elif feature_name == 'has_class_conflict':
            return 'Yes — has class' if value == 1 else 'No conflict'
        elif feature_name == 'gender':
            return 'Male' if value == 1 else 'Female'
        elif feature_name == 'is_new_member':
            return 'New member (this batch)' if value == 1 else 'Returning member'
        elif feature_name == 'attendance_rate':
            return f'{value*100:.0f}%'
        elif feature_name in ['assignments_last_7_days', 'assignments_last_30_days']:
            return f'{int(value)} events'
        elif feature_name == 'days_since_last_assignment':
            if value >= 999:
                return 'Never assigned'
            return f'{int(value)} days ago'
        elif feature_name == 'event_day_of_week':
            days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            return days[int(value)] if 0 <= value < 7 else str(int(value))
        elif feature_name == 'event_date_ordinal':
            from datetime import date
            try:
                return date.fromordinal(int(value)).strftime('%b %d, %Y')
            except Exception:
                return str(int(value))
        elif feature_name == 'event_size':
            return f'{int(value)} slots'
        else:
            return str(int(value))

    def _shap_to_sentence(self, feature: str, value: float, shap_value: float) -> str:
        """Convert a single SHAP contribution into a natural language sentence."""
        if feature == 'is_available':
            if value == 1:
                return "✅ Currently available for this event."
            else:
                return "❌ Not available for this event — this is the strongest reason not to assign them."

        elif feature == 'has_class_conflict':
            if value == 1:
                return "⚠️ Has a class during this time block. Assignment is possible — this is a heads-up, not a disqualifier."
            else:
                return "✅ No class conflict during this time block."

        elif feature == 'gender':
            gender_label = 'male' if value == 1 else 'female'
            if shap_value > 0.02:
                return f"ℹ️ This member is {gender_label} — gender patterns slightly favor their selection here."
            elif shap_value < -0.02:
                return f"ℹ️ This member is {gender_label} — gender patterns slightly reduce their priority here."
            else:
                return f"ℹ️ Member gender: {gender_label}."

        elif feature == 'is_new_member':
            if value == 1:
                if shap_value > 0.02:
                    return "✅ New member this school year — the model gives a slight boost to first-year inclusion."
                else:
                    return "ℹ️ New member (joined this school year)."
            else:
                if shap_value > 0.02:
                    return "✅ Returning / experienced member — their track record increases selection confidence."
                else:
                    return "ℹ️ Returning member from a previous school year."

        elif feature == 'assignments_last_7_days':
            count = int(value)
            if count == 0:
                return "✅ No assignments in the past 7 days, keeping their recent workload light."
            elif shap_value < -0.03:
                return f"⚠️ Already assigned to {count} event(s) this past week, which increases their load."
            else:
                return f"ℹ️ Has {count} assignment(s) in the past 7 days."

        elif feature == 'assignments_last_30_days':
            count = int(value)
            if count == 0:
                return "✅ Not assigned to any events this month — makes them a strong inclusion priority."
            elif shap_value > 0.03:
                return f"✅ Only {count} assignment(s) this month — their monthly workload is low."
            elif shap_value < -0.03:
                return f"⚠️ Already has {count} assignment(s) this month, which reduces their priority."
            else:
                return f"ℹ️ Has {count} assignment(s) over the past 30 days."

        elif feature == 'days_since_last_assignment':
            days = int(value)
            if days >= 999:
                return "✅ Never been assigned before — high priority for first-time inclusion."
            elif days >= 30 and shap_value > 0:
                return f"✅ Last assigned {days} days ago — well-rested and overdue for selection."
            elif days >= 7:
                return f"ℹ️ Was last assigned {days} days ago."
            elif shap_value < -0.03:
                return f"⚠️ Only {days} day(s) since their last assignment — may need a break."
            else:
                return f"ℹ️ Last assigned {days} day(s) ago."

        elif feature == 'attendance_rate':
            pct = int(value * 100)
            if pct >= 90:
                return f"✅ Excellent attendance rate of {pct}% — highly reliable."
            elif pct >= 75:
                return f"✅ Good attendance rate of {pct}%."
            elif pct >= 50:
                return f"⚠️ Moderate attendance rate of {pct}% — may affect reliability."
            else:
                return f"❌ Low attendance rate of {pct}% — reduced confidence in showing up."

        elif feature == 'event_size':
            size = int(value)
            if shap_value > 0.02:
                return f"✅ This event needs {size} volunteer(s), which aligns with patterns where this member is typically selected."
            elif shap_value < -0.02:
                return f"ℹ️ This event's size ({size} slot(s)) slightly influences their priority in this context."
            else:
                return f"ℹ️ Event size is {size} volunteer(s)."

        elif feature == 'event_day_of_week':
            day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            day = day_names[int(value)] if 0 <= int(value) < 7 else f"day {int(value)}"
            if shap_value > 0.02:
                return f"✅ Historical patterns show strong assignment likelihood on {day}s for this member."
            elif shap_value < -0.02:
                return f"ℹ️ {day} events show a slightly lower historical assignment rate for this member."
            else:
                return f"ℹ️ The event falls on a {day}."

        elif feature == 'event_date_ordinal':
            from datetime import date as _date
            try:
                d = _date.fromordinal(int(value)).strftime('%b %d, %Y')
            except Exception:
                d = "this date"
            if shap_value > 0.02:
                return f"✅ The event date ({d}) aligns with favorable patterns for this member."
            elif shap_value < -0.02:
                return f"ℹ️ The event date ({d}) is associated with a lower historical selection rate."
            else:
                return f"ℹ️ The event is scheduled for {d}."

        return f"ℹ️ {self._format_feature_name(feature)}: {self._format_feature_value(feature, value)}"

    def _generate_shap_narrative(self, contributions: list) -> list:
        """
        Convert sorted SHAP contributions into a list of natural-language sentences.
        Only generates sentences for features with notable impact (|shap_value| >= 0.01).
        """
        sentences = []
        for c in contributions:
            sv = c['shap_value']
            if abs(sv) < 0.01:
                continue  # Skip features with negligible impact
            sentence = self._shap_to_sentence(c['feature'], c['value'], sv)
            sentences.append(sentence)
        return sentences


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

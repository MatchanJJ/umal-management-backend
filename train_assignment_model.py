"""
Train fair volunteer assignment model using RandomForest or XGBoost.

Model predicts which members should be assigned to events based on:
- Availability
- Recent assignment history (fairness)
- Attendance reliability
- Event characteristics
"""

import pandas as pd
import numpy as np
import pickle
from datetime import datetime
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
import warnings
warnings.filterwarnings('ignore')

# Try to import XGBoost (optional)
try:
    import xgboost as xgb
    XGBOOST_AVAILABLE = True
except ImportError:
    XGBOOST_AVAILABLE = False
    print("⚠️  XGBoost not available. Using RandomForest only.")


class AssignmentModelTrainer:
    """Train and evaluate volunteer assignment model"""
    
    def __init__(self, dataset_path='assignai_assignment_dataset.csv'):
        self.dataset_path = dataset_path
        self.df = None
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.scaler = None
        self.model = None
        self.feature_names = None
        
    def load_data(self):
        """Load dataset from CSV"""
        print(f"Loading dataset from: {self.dataset_path}")
        self.df = pd.read_csv(self.dataset_path)
        print(f"✅ Loaded {len(self.df)} rows with {len(self.df.columns)} columns")
        print(f"   Columns: {', '.join(self.df.columns.tolist())}")
        return self.df
    
    def prepare_features(self):
        """
        Prepare features for training.
        
        Features: All columns except member_id and assigned
        Target: assigned
        """
        print("\nPreparing features...")
        
        # Convert event_date to numeric (day of week: 0=Monday, 6=Sunday)
        self.df['event_day_of_week'] = pd.to_datetime(self.df['event_date']).dt.dayofweek
        
        # Convert event_date to ordinal for temporal patterns
        self.df['event_date_ordinal'] = pd.to_datetime(self.df['event_date']).apply(lambda x: x.toordinal())
        
        # Define feature columns (exclude member_id, event_date, assigned)
        feature_columns = [
            'is_available',
            'assignments_last_7_days',
            'assignments_last_30_days',
            'days_since_last_assignment',
            'attendance_rate',
            'event_size',
            'event_day_of_week',
            'event_date_ordinal'
        ]
        
        self.feature_names = feature_columns
        
        # Separate features and target
        X = self.df[feature_columns]
        y = self.df['assigned']
        
        print(f"✅ Features: {len(feature_columns)} columns")
        print(f"   {', '.join(feature_columns)}")
        print(f"   Target: assigned (0/1)")
        print(f"   Class distribution: 0={len(y[y==0])}, 1={len(y[y==1])}")
        
        return X, y
    
    def split_data(self, X, y, test_size=0.2, random_state=42):
        """Split data into train/test sets"""
        print(f"\nSplitting data: {int((1-test_size)*100)}% train, {int(test_size*100)}% test")
        
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )
        
        print(f"✅ Train set: {len(self.X_train)} samples")
        print(f"   Test set: {len(self.X_test)} samples")
        
        return self.X_train, self.X_test, self.y_train, self.y_test
    
    def scale_features(self):
        """Scale numerical features"""
        print("\nScaling features...")
        
        self.scaler = StandardScaler()
        self.X_train_scaled = self.scaler.fit_transform(self.X_train)
        self.X_test_scaled = self.scaler.transform(self.X_test)
        
        print("✅ Features scaled using StandardScaler")
        
        return self.X_train_scaled, self.X_test_scaled
    
    def train_random_forest(self):
        """Train RandomForestClassifier"""
        print("\n" + "="*60)
        print("Training RandomForest Model")
        print("="*60)
        
        # Optimal hyperparameters for fairness
        rf_model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            min_samples_split=5,
            min_samples_leaf=2,
            class_weight='balanced',  # Handle class imbalance
            random_state=42,
            n_jobs=-1
        )
        
        print("Training...")
        rf_model.fit(self.X_train_scaled, self.y_train)
        print("✅ Training complete")
        
        # Evaluate
        self.evaluate_model(rf_model, "RandomForest")
        
        return rf_model
    
    def train_xgboost(self):
        """Train XGBoost model (if available)"""
        if not XGBOOST_AVAILABLE:
            print("⚠️  XGBoost not available. Skipping.")
            return None
        
        print("\n" + "="*60)
        print("Training XGBoost Model")
        print("="*60)
        
        # Calculate scale_pos_weight for class imbalance
        scale_pos_weight = len(self.y_train[self.y_train == 0]) / len(self.y_train[self.y_train == 1])
        
        xgb_model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            scale_pos_weight=scale_pos_weight,
            random_state=42,
            n_jobs=-1,
            eval_metric='logloss'
        )
        
        print("Training...")
        xgb_model.fit(self.X_train_scaled, self.y_train)
        print("✅ Training complete")
        
        # Evaluate
        self.evaluate_model(xgb_model, "XGBoost")
        
        return xgb_model
    
    def evaluate_model(self, model, model_name="Model"):
        """Evaluate model performance"""
        print(f"\n📊 {model_name} Evaluation")
        print("-" * 60)
        
        # Predictions
        y_train_pred = model.predict(self.X_train_scaled)
        y_test_pred = model.predict(self.X_test_scaled)
        
        # Accuracy
        train_acc = accuracy_score(self.y_train, y_train_pred)
        test_acc = accuracy_score(self.y_test, y_test_pred)
        
        print(f"Train Accuracy: {train_acc:.4f}")
        print(f"Test Accuracy:  {test_acc:.4f}")
        
        # Classification Report
        print(f"\nClassification Report (Test Set):")
        print(classification_report(self.y_test, y_test_pred, target_names=['Not Assigned', 'Assigned']))
        
        # Confusion Matrix
        cm = confusion_matrix(self.y_test, y_test_pred)
        print(f"Confusion Matrix:")
        print(f"                 Predicted")
        print(f"                 0      1")
        print(f"Actual    0    {cm[0][0]:4d}   {cm[0][1]:4d}")
        print(f"          1    {cm[1][0]:4d}   {cm[1][1]:4d}")
        
        # Feature Importance
        if hasattr(model, 'feature_importances_'):
            print(f"\n🎯 Feature Importance:")
            importances = model.feature_importances_
            indices = np.argsort(importances)[::-1]
            
            for i, idx in enumerate(indices[:8]):
                print(f"   {i+1}. {self.feature_names[idx]:30s} {importances[idx]:.4f}")
        
        return test_acc
    
    def save_model(self, model, model_name='assignai_model', scaler=True):
        """Save trained model and scaler"""
        model_file = f'{model_name}.pkl'
        scaler_file = f'{model_name}_scaler.pkl'
        
        # Save model
        with open(model_file, 'wb') as f:
            pickle.dump(model, f)
        print(f"\n✅ Model saved: {model_file}")
        
        # Save scaler
        if scaler and self.scaler:
            with open(scaler_file, 'wb') as f:
                pickle.dump(self.scaler, f)
            print(f"✅ Scaler saved: {scaler_file}")
        
        # Save feature names
        metadata = {
            'feature_names': self.feature_names,
            'model_type': type(model).__name__,
            'trained_at': datetime.now().isoformat()
        }
        
        metadata_file = f'{model_name}_metadata.pkl'
        with open(metadata_file, 'wb') as f:
            pickle.dump(metadata, f)
        print(f"✅ Metadata saved: {metadata_file}")
    
    def load_model(self, model_path='assignai_model.pkl'):
        """Load trained model"""
        with open(model_path, 'rb') as f:
            self.model = pickle.load(f)
        print(f"✅ Model loaded from: {model_path}")
        return self.model


def main():
    print("="*60)
    print("AssignAI - Fair Assignment Model Training")
    print("="*60)
    
    # Initialize trainer
    trainer = AssignmentModelTrainer('assignai_assignment_dataset.csv')
    
    # Load data
    trainer.load_data()
    
    # Prepare features
    X, y = trainer.prepare_features()
    
    # Split data
    trainer.split_data(X, y, test_size=0.2, random_state=42)
    
    # Scale features
    trainer.scale_features()
    
    # Train RandomForest (always available)
    rf_model = trainer.train_random_forest()
    
    # Train XGBoost (if available)
    xgb_model = trainer.train_xgboost()
    
    # Choose best model
    if xgb_model:
        print("\n" + "="*60)
        print("Comparing Models...")
        print("="*60)
        
        rf_acc = accuracy_score(trainer.y_test, rf_model.predict(trainer.X_test_scaled))
        xgb_acc = accuracy_score(trainer.y_test, xgb_model.predict(trainer.X_test_scaled))
        
        print(f"RandomForest Accuracy: {rf_acc:.4f}")
        print(f"XGBoost Accuracy:      {xgb_acc:.4f}")
        
        if xgb_acc > rf_acc:
            print("\n🏆 Winner: XGBoost")
            trainer.model = xgb_model
            model_name = 'assignai_model_xgboost'
        else:
            print("\n🏆 Winner: RandomForest")
            trainer.model = rf_model
            model_name = 'assignai_model_rf'
    else:
        print("\n🏆 Using: RandomForest (only option)")
        trainer.model = rf_model
        model_name = 'assignai_model'
    
    # Save best model
    trainer.save_model(trainer.model, model_name=model_name)
    
    print("\n" + "="*60)
    print("Training Complete!")
    print("="*60)
    print(f"\nModel ready for inference.")
    print(f"Integrate with AssignAI microservice using: {model_name}.pkl")
    print("="*60)


if __name__ == '__main__':
    main()

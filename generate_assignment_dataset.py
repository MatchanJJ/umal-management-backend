"""
Generate synthetic assignment dataset for fair volunteer assignment model.

Dataset focuses on:
- Availability
- Assignment fairness (recent participation)
- Attendance reliability
- Event characteristics

NO role-based features (all members can do all tasks)
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random

# Configuration
NUM_MEMBERS = 10
NUM_EVENTS = 40  # Will generate ~5 rows per event
TOTAL_ROWS = 200

def generate_member_ids(num_members=10):
    """Generate member IDs M001 to M010"""
    return [f"M{str(i).zfill(3)}" for i in range(1, num_members + 1)]

def generate_realistic_assignment_data(num_rows=200, num_members=10):
    """
    Generate realistic assignment dataset.
    
    Each row represents a member being considered for an event.
    Only available members can be assigned (assigned=1 only if is_available=1).
    """
    
    member_ids = generate_member_ids(num_members)
    data = []
    
    # Track assignment history per member for realism
    member_history = {mid: {
        'last_assignment_date': None,
        'assignments_7d': 0,
        'assignments_30d': 0,
        'attendance_rate': round(random.uniform(0.6, 1.0), 2)
    } for mid in member_ids}
    
    # Generate events over a 60-day period
    start_date = datetime(2026, 2, 1)
    num_events = num_rows // (num_members // 2)  # Estimate events needed
    
    current_row = 0
    event_date = start_date
    
    while current_row < num_rows:
        # Event characteristics
        event_date += timedelta(days=random.randint(1, 3))
        event_size = random.randint(2, 6)  # Need 2-6 volunteers per event
        
        # Shuffle members to randomize selection
        shuffled_members = random.sample(member_ids, len(member_ids))
        
        assigned_count = 0
        
        for member_id in shuffled_members:
            if current_row >= num_rows:
                break
            
            # Member availability (70% chance of being available)
            is_available = random.random() < 0.7
            
            # Calculate days since last assignment
            if member_history[member_id]['last_assignment_date']:
                days_since_last = (event_date - member_history[member_id]['last_assignment_date']).days
            else:
                days_since_last = random.randint(30, 60)  # New member
            
            # Get current assignment counts
            assignments_7d = member_history[member_id]['assignments_7d']
            assignments_30d = member_history[member_id]['assignments_30d']
            attendance_rate = member_history[member_id]['attendance_rate']
            
            # Assignment logic (realistic)
            # Prefer: available, less recently assigned, good attendance
            assigned = 0
            if is_available and assigned_count < event_size:
                # Probability based on fairness
                assignment_prob = 0.5
                
                # Higher chance if not assigned recently
                if assignments_7d == 0:
                    assignment_prob += 0.3
                if days_since_last > 14:
                    assignment_prob += 0.2
                
                # Good attendance increases chance
                assignment_prob += (attendance_rate - 0.7) * 0.5
                
                # Lower assignments overall = higher chance
                assignment_prob -= assignments_30d * 0.05
                
                assignment_prob = max(0, min(1, assignment_prob))
                
                if random.random() < assignment_prob:
                    assigned = 1
                    assigned_count += 1
                    
                    # Update member history
                    member_history[member_id]['last_assignment_date'] = event_date
                    member_history[member_id]['assignments_7d'] += 1
                    member_history[member_id]['assignments_30d'] += 1
            
            # Create row
            data.append({
                'member_id': member_id,
                'is_available': 1 if is_available else 0,
                'assignments_last_7_days': assignments_7d,
                'assignments_last_30_days': assignments_30d,
                'days_since_last_assignment': days_since_last,
                'attendance_rate': attendance_rate,
                'event_size': event_size,
                'event_date': event_date.strftime('%Y-%m-%d'),
                'assigned': assigned
            })
            
            current_row += 1
        
        # Decay assignment counts over time (simulate 7-day/30-day windows)
        for member_id in member_ids:
            if random.random() < 0.15:  # Occasional decay
                member_history[member_id]['assignments_7d'] = max(0, member_history[member_id]['assignments_7d'] - 1)
            if random.random() < 0.05:
                member_history[member_id]['assignments_30d'] = max(0, member_history[member_id]['assignments_30d'] - 1)
    
    return pd.DataFrame(data[:num_rows])


def validate_dataset(df):
    """Validate dataset constraints"""
    print("\n" + "="*60)
    print("Dataset Validation")
    print("="*60)
    
    # Check: assigned=1 only when available=1
    invalid_assignments = df[(df['assigned'] == 1) & (df['is_available'] == 0)]
    if len(invalid_assignments) > 0:
        print(f"❌ ERROR: {len(invalid_assignments)} rows with assigned=1 but is_available=0")
        return False
    else:
        print("✅ All assignments respect availability constraint")
    
    # Check data ranges
    print(f"\n📊 Data Ranges:")
    print(f"   is_available: {df['is_available'].min()} - {df['is_available'].max()}")
    print(f"   assignments_last_7_days: {df['assignments_last_7_days'].min()} - {df['assignments_last_7_days'].max()}")
    print(f"   assignments_last_30_days: {df['assignments_last_30_days'].min()} - {df['assignments_last_30_days'].max()}")
    print(f"   days_since_last_assignment: {df['days_since_last_assignment'].min()} - {df['days_since_last_assignment'].max()}")
    print(f"   attendance_rate: {df['attendance_rate'].min():.2f} - {df['attendance_rate'].max():.2f}")
    print(f"   event_size: {df['event_size'].min()} - {df['event_size'].max()}")
    
    # Check class balance
    assigned_count = df['assigned'].sum()
    total_count = len(df)
    print(f"\n⚖️  Class Balance:")
    print(f"   Assigned (1): {assigned_count} ({assigned_count/total_count*100:.1f}%)")
    print(f"   Not Assigned (0): {total_count - assigned_count} ({(total_count - assigned_count)/total_count*100:.1f}%)")
    
    return True


def main():
    print("=" * 60)
    print("AssignAI - Fair Assignment Dataset Generator")
    print("=" * 60)
    print("\nGenerating dataset...")
    print(f"  Target rows: {TOTAL_ROWS}")
    print(f"  Members: {NUM_MEMBERS} (M001-M{str(NUM_MEMBERS).zfill(3)})")
    print(f"  Focus: Availability, Fairness, Participation History")
    print(f"  NO role-based features (all members can do all tasks)")
    
    # Generate dataset
    df = generate_realistic_assignment_data(num_rows=TOTAL_ROWS, num_members=NUM_MEMBERS)
    
    # Validate
    if not validate_dataset(df):
        print("\n❌ Dataset validation failed!")
        return
    
    # Save
    output_file = 'assignai_assignment_dataset.csv'
    df.to_csv(output_file, index=False)
    print(f"\n✅ Dataset saved: {output_file}")
    
    # Show sample
    print(f"\n📝 Sample rows (first 10):")
    print(df.head(10).to_string(index=False))
    
    # Show statistics by member
    print(f"\n📊 Assignment Statistics by Member:")
    member_stats = df.groupby('member_id').agg({
        'assigned': 'sum',
        'is_available': 'mean',
        'attendance_rate': 'mean'
    }).round(2)
    member_stats.columns = ['Total Assigned', 'Availability Rate', 'Attendance Rate']
    print(member_stats)
    
    print("\n" + "="*60)
    print("Dataset generation complete!")
    print("Next step: python train_assignment_model.py")
    print("="*60)


if __name__ == '__main__':
    main()

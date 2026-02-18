"""
Train Assignment Model — Phase 3: Fairness-Aware Retraining

Reads real assignment history from SQLite and retrains the RandomForest
with fairness sample weights so that under-represented members receive
higher weight during training.

Usage:
    python train_model.py
    python train_model.py --days 180   (use last N days of history)
    python train_model.py --min-rows 20 (fallback to synthetic if too few rows)
"""

import sqlite3
import pickle
import argparse
import os
import sys
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, date as _date
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, roc_auc_score

DB_PATH   = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'database', 'database.sqlite'))
MODEL_OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assignai_model.pkl'))
SCALER_OUT= os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assignai_model_scaler.pkl'))
META_OUT  = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'assignai_model_metadata.pkl'))

FEATURE_NAMES = [
    'is_available',
    'has_class_conflict',
    'gender',                    # M=1, F=0
    'is_new_member',             # 1 if batch_year == current school year
    'assignments_last_7_days',
    'assignments_last_30_days',
    'days_since_last_assignment',
    'attendance_rate',
    'event_size',
    'event_day_of_week',
    'event_date_ordinal',
]


# ──────────────────────────────────────────────────────────────────────
# Data loading
# ──────────────────────────────────────────────────────────────────────

def load_data(days: int):
    """
    Build a labelled dataset from the SQLite assignment history.

    Positive rows  : (member, event) pairs where the member WAS assigned.
    Negative rows  : for each event, a random sample of non-assigned members
                     (capped at 3× the number of positive rows for that event).

    Returns (X DataFrame, y Series, weights Series).
    """
    if not os.path.exists(DB_PATH):
        raise FileNotFoundError(f"Database not found: {DB_PATH}")

    conn = sqlite3.connect(DB_PATH)
    cutoff = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

    # Current school year: month >= 8 → current year, else year-1
    _now = datetime.now()
    current_school_year = _now.year if _now.month >= 8 else _now.year - 1

    # ── Fetch positive assignments ─────────────────────────────────────
    pos_df = pd.read_sql_query(
        """
        SELECT va.member_id, va.event_id, va.assigned_at,
               COALESCE(va.has_class_conflict, 0) AS has_class_conflict,
               e.date AS event_date, e.required_volunteers AS event_size,
               COALESCE(m.gender, 'F') AS gender,
               m.batch_year
        FROM   volunteer_assignments va
        JOIN   events e ON e.id = va.event_id
        JOIN   members m ON m.id = va.member_id
        WHERE  va.assigned_at >= ?
        """,
        conn, params=[cutoff]
    )

    # ── All members ────────────────────────────────────────────────────
    members_df = pd.read_sql_query("SELECT id, COALESCE(gender, 'F') AS gender, batch_year FROM members", conn)
    member_ids = members_df['id'].tolist()

    # ── All events in the window ───────────────────────────────────────
    events_df = pd.read_sql_query(
        "SELECT id, date, required_volunteers FROM events WHERE date >= ?",
        conn, params=[cutoff]
    )

    conn.close()

    if pos_df.empty or events_df.empty:
        print(f"⚠️  Only {len(pos_df)} positive rows found — falling back to synthetic dataset.")
        return None, None, None

    # ── Pre-compute per-member assignment history ──────────────────────
    # For every (member, event) we need:
    #   assignments_last_7_days / _30_days before the event date
    #   days_since_last_assignment before the event date
    #   attendance_rate = past_assigned / past_events
    pos_df['event_date'] = pd.to_datetime(pos_df['event_date'])
    pos_df['assigned_at'] = pd.to_datetime(pos_df['assigned_at'])
    events_df['date'] = pd.to_datetime(events_df['date'])

    # Build lookup: member_id → sorted list of assignment dates
    assign_dates: dict = {}
    for _, row in pos_df.iterrows():
        assign_dates.setdefault(row['member_id'], []).append(row['event_date'])
    for mid in assign_dates:
        assign_dates[mid].sort()

    total_events = len(events_df['id'].unique())

    def member_features(member_id, event_dt):
        past = [d for d in assign_dates.get(member_id, []) if d < event_dt]
        n7   = sum(1 for d in past if (event_dt - d).days <= 7)
        n30  = sum(1 for d in past if (event_dt - d).days <= 30)
        if past:
            dsla = (event_dt - max(past)).days
        else:
            dsla = 999  # never assigned before
        att  = len(past) / max(total_events, 1)
        att  = min(att, 1.0)
        return n7, n30, dsla, att

    rows = []
    labels = []

    # Build gender/is_new_member lookup per member_id from members_df
    _member_gender: dict = {}
    _member_is_new: dict = {}
    for _, mr in members_df.iterrows():
        _member_gender[mr['id']]  = 1 if str(mr.get('gender', 'F')).upper() == 'M' else 0
        _member_is_new[mr['id']]  = 1 if (pd.notna(mr.get('batch_year')) and
                                           int(mr['batch_year']) == current_school_year) else 0

    # Positive rows
    for _, row in pos_df.iterrows():
        edt  = row['event_date']
        mid  = row['member_id']
        n7, n30, dsla, att = member_features(mid, edt)
        gend = 1 if str(row.get('gender', 'F')).upper() == 'M' else 0
        is_new = 1 if (pd.notna(row.get('batch_year')) and
                       int(row['batch_year']) == current_school_year) else 0
        rows.append([
            1,                                     # is_available
            int(row.get('has_class_conflict', 0)), # has_class_conflict
            gend,                                  # gender
            is_new,                                # is_new_member
            n7, n30, dsla, att,
            int(row['event_size']),
            edt.weekday(),
            edt.toordinal(),
        ])
        labels.append(1)

    # Negative rows (members NOT assigned to each event)
    assigned_per_event: dict = {}
    for _, row in pos_df.iterrows():
        assigned_per_event.setdefault(row['event_id'], set()).add(row['member_id'])

    rng = np.random.default_rng(42)
    for _, ev in events_df.iterrows():
        edt = ev['date']
        assigned = assigned_per_event.get(ev['id'], set())
        not_assigned = [m for m in member_ids if m not in assigned]
        # cap negatives at 3× positives for this event
        cap = max(3 * len(assigned), 3)
        sample = rng.choice(not_assigned, size=min(cap, len(not_assigned)), replace=False).tolist()
        for mid in sample:
            n7, n30, dsla, att = member_features(mid, edt)
            gend   = _member_gender.get(mid, 0)
            is_new = _member_is_new.get(mid, 0)
            rows.append([
                0,                                 # is_available (unknown, treat as 0)
                0,                                 # has_class_conflict (unknown, assume 0)
                gend,                              # gender
                is_new,                            # is_new_member
                n7, n30, dsla, att,
                int(ev['required_volunteers']),
                edt.weekday(),
                edt.toordinal(),
            ])
            labels.append(0)

    X = pd.DataFrame(rows, columns=FEATURE_NAMES)
    y = pd.Series(labels)

    # ── Fairness sample weights ────────────────────────────────────────
    # Under-assigned members get higher weight; over-assigned get lower.
    total_assigned_per_member = pos_df['member_id'].value_counts().to_dict()
    mean_w = np.mean(list(total_assigned_per_member.values())) if total_assigned_per_member else 1
    std_w  = np.std(list(total_assigned_per_member.values())) + 1e-6

    # Map member_id to weight; positive rows only (negatives all get weight=1)
    def member_weight(member_id):
        count = total_assigned_per_member.get(member_id, 0)
        z = (count - mean_w) / std_w
        return float(np.clip(1.0 - 0.30 * z, 0.3, 3.0))

    weights = []
    pos_idx = 0
    neg_idx = 0
    for lbl in labels:
        if lbl == 1:
            mid = pos_df.iloc[pos_idx]['member_id']
            weights.append(member_weight(mid))
            pos_idx += 1
        else:
            weights.append(1.0)
            neg_idx += 1
    weights = np.array(weights)

    return X, y, weights


# ──────────────────────────────────────────────────────────────────────
# Synthetic fallback (same logic as original generate_assignment_dataset)
# ──────────────────────────────────────────────────────────────────────

def synthetic_dataset(n=2000):
    """Generate a synthetic training set when DB history is insufficient."""
    rng = np.random.default_rng(123)
    rows = []
    labels = []
    base_date = _date(2026, 1, 1).toordinal()

    for _ in range(n):
        is_avail     = rng.integers(0, 2)
        has_conflict = rng.integers(0, 2)           # class conflict is a warning, not a disqualifier
        gender       = rng.integers(0, 2)           # 0=F, 1=M (unused in label heuristic)
        is_new       = rng.integers(0, 2)           # 0=old, 1=new (mild positive for fairness)
        n7           = rng.integers(0, 5)
        n30          = rng.integers(0, 10)
        dsla         = rng.integers(0, 100) if rng.random() > 0.1 else 999
        att          = rng.uniform(0.5, 1.0)
        ev_size      = rng.integers(1, 10)
        ev_dow       = rng.integers(0, 7)
        ev_ord       = base_date + int(rng.integers(0, 365))

        # Synthetic label heuristic
        score = (
            is_avail * 3
            + (1 - has_conflict * 0.5)
            + is_new * 0.3                          # slight boost for new members
            + (1 - n7 / 5) * 2
            + (1 - n30 / 10)
            + (min(dsla, 60) / 60)
            + att * 2
        )
        lbl = 1 if score + rng.normal(0, 0.5) > 4.5 else 0
        rows.append([is_avail, int(has_conflict), int(gender), int(is_new),
                     n7, n30, dsla, att, ev_size, ev_dow, ev_ord])
        labels.append(lbl)

    X = pd.DataFrame(rows, columns=FEATURE_NAMES)
    y = pd.Series(labels)
    weights = np.ones(len(y))
    return X, y, weights


# ──────────────────────────────────────────────────────────────────────
# Training
# ──────────────────────────────────────────────────────────────────────

def train(days=180, min_rows=30):
    print("=" * 60)
    print("AssignAI — Phase 3 Fairness-Aware Model Training")
    print("=" * 60)

    # Load data
    print(f"\n📂 Loading assignment history (last {days} days)…")
    X, y, weights = load_data(days)

    if X is None or len(y) < min_rows:
        print(f"⚠️  Insufficient real data ({0 if y is None else len(y)} rows). Using synthetic dataset.")
        X, y, weights = synthetic_dataset(2000)
    else:
        print(f"✅ Loaded {len(y)} rows ({y.sum()} positive, {(y==0).sum()} negative)")

    # Train / test split
    X_train, X_test, y_train, y_test, w_train, _ = train_test_split(
        X, y, weights, test_size=0.2, random_state=42, stratify=y
    )

    # Scale
    scaler = StandardScaler()
    X_train_s = scaler.fit_transform(X_train)
    X_test_s  = scaler.transform(X_test)

    # Train with fairness sample weights
    print("\n🔧 Training RandomForest with fairness sample weights…")
    model = RandomForestClassifier(
        n_estimators=150,
        max_depth=8,
        min_samples_leaf=4,
        class_weight='balanced',
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train_s, y_train, sample_weight=w_train)

    # Evaluate
    y_pred  = model.predict(X_test_s)
    y_proba = model.predict_proba(X_test_s)[:, 1]
    auc = roc_auc_score(y_test, y_proba)

    print("\n📊 Evaluation on hold-out test set:")
    print(classification_report(y_test, y_pred, target_names=['Not Assigned', 'Assigned']))
    print(f"   ROC-AUC: {auc:.4f}")

    # Feature importance
    importances = dict(zip(FEATURE_NAMES, model.feature_importances_))
    print("\n🌳 Feature Importances:")
    for f, v in sorted(importances.items(), key=lambda x: -x[1]):
        bar = '█' * int(v * 40)
        print(f"   {f:<35} {bar} {v:.4f}")

    # Save
    with open(MODEL_OUT,  'wb') as f: pickle.dump(model,  f)
    with open(SCALER_OUT, 'wb') as f: pickle.dump(scaler, f)
    metadata = {
        'model_type'   : 'RandomForestClassifier',
        'feature_names': FEATURE_NAMES,
        'trained_at'   : datetime.now().isoformat(),
        'training_rows': len(y),
        'fairness_aware': True,
        'roc_auc'      : round(auc, 4),
    }
    with open(META_OUT, 'wb') as f: pickle.dump(metadata, f)

    print(f"\n✅ Model saved  → {MODEL_OUT}")
    print(f"✅ Scaler saved → {SCALER_OUT}")
    print(f"✅ Meta saved   → {META_OUT}")
    print(f"\n🎉 Phase 3 training complete! ROC-AUC = {auc:.4f}")
    return metadata


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Train fairness-aware AssignAI model')
    parser.add_argument('--days',     type=int, default=180, help='Days of history to use')
    parser.add_argument('--min-rows', type=int, default=30,  help='Min real rows before using synthetic data')
    args = parser.parse_args()
    train(days=args.days, min_rows=args.min_rows)

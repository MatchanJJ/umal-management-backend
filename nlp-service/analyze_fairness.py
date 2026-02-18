"""
Fairness Analysis Script — Per-Member Participation Equity

Analyzes volunteer assignment patterns to detect workload imbalances:
whether some members are over-assigned while others are consistently excluded.

Metrics computed:
  - Assignment count per member
  - Gini coefficient (0 = perfect equality, 1 = all work concentrated in one person)
  - Coefficient of Variation (std / mean)
  - Over-assigned members (> mean + 1.5 * std)
  - Never-assigned members (0 assignments in the period)
"""

import sqlite3
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List


class FairnessAnalyzer:
    """Analyzes per-member workload fairness for volunteer assignments."""

    def __init__(self, db_path='../database/database.sqlite'):
        self.db_path = db_path
        self.metrics = {}

        if not os.path.exists(self.db_path):
            print(f"Warning: Database not found at: {self.db_path}")
            alt_paths = [
                '../database/database.sqlite',
                './database/database.sqlite',
                '../../database/database.sqlite',
            ]
            for alt in alt_paths:
                if os.path.exists(alt):
                    self.db_path = alt
                    break

    def analyze_recent_assignments(self, days=90) -> Dict:
        """Analyse the last `days` days of assignments and measure workload equity."""
        if not os.path.exists(self.db_path):
            return {
                'success': False,
                'error': f'Database not found: {self.db_path}',
                'message': 'Database file does not exist.',
                'db_path': self.db_path,
                'cwd': os.getcwd(),
            }

        try:
            conn = sqlite3.connect(self.db_path)
            cutoff_date = (datetime.now() - timedelta(days=days)).strftime('%Y-%m-%d')

            members_df = pd.read_sql_query(
                "SELECT id, first_name, last_name FROM members", conn
            )

            if members_df.empty:
                conn.close()
                return {'success': False, 'message': 'No members found.', 'days_analyzed': days}

            assignments_df = pd.read_sql_query(
                """
                SELECT va.member_id, va.assigned_at, va.event_id
                FROM   volunteer_assignments va
                WHERE  va.assigned_at >= ?
                ORDER  BY va.assigned_at DESC
                """,
                conn,
                params=[cutoff_date],
            )
            conn.close()

            total_assignments = len(assignments_df)
            total_members = len(members_df)

            counts_series = (
                assignments_df['member_id'].value_counts()
                if total_assignments > 0
                else pd.Series(dtype=int)
            )

            members_df['assignment_count'] = (
                members_df['id'].map(counts_series).fillna(0).astype(int)
            )
            members_df['full_name'] = members_df['first_name'] + ' ' + members_df['last_name']

            counts = members_df['assignment_count'].values.astype(float)
            mean_count = float(np.mean(counts))
            std_count  = float(np.std(counts))
            gini       = self._gini_coefficient(counts)
            cv         = (std_count / mean_count) if mean_count > 0 else 0.0

            over_threshold      = mean_count + 1.5 * std_count
            never_assigned      = members_df[members_df['assignment_count'] == 0]['full_name'].tolist()
            over_assigned_df    = members_df[members_df['assignment_count'] > max(over_threshold, 1)].copy()
            over_assigned       = (
                over_assigned_df[['full_name', 'assignment_count']]
                .rename(columns={'full_name': 'name', 'assignment_count': 'count'})
                .sort_values('count', ascending=False)
                .to_dict('records')
            )
            active_member_count = int((members_df['assignment_count'] > 0).sum())

            distribution = (
                members_df[['full_name', 'assignment_count']]
                .rename(columns={'full_name': 'name', 'assignment_count': 'count'})
                .sort_values('count', ascending=False)
                .to_dict('records')
            )

            if gini < 0.30 and cv < 0.50:
                is_fair = True; bias_detected = False; fairness_status = 'FAIR'
            elif gini >= 0.50 or cv >= 1.00:
                is_fair = False; bias_detected = True;  fairness_status = 'BIASED'
            else:
                is_fair = False; bias_detected = True;  fairness_status = 'WARNING'

            recommendation = self._generate_recommendation(
                is_fair=is_fair, gini=gini, cv=cv,
                never_assigned=never_assigned, over_assigned=over_assigned,
                mean_count=mean_count, total_members=total_members,
                active_member_count=active_member_count, fairness_status=fairness_status,
            )

            return {
                'success': True,
                'days_analyzed': days,
                'total_assignments': total_assignments,
                'total_members': total_members,
                'active_members': active_member_count,
                'mean_assignments': round(mean_count, 2),
                'std_assignments': round(std_count, 2),
                'gini_coefficient': round(gini, 4),
                'coefficient_of_variation': round(cv, 4),
                'fairness_status': fairness_status,
                'is_fair': is_fair,
                'bias_detected': bias_detected,
                'never_assigned': never_assigned,
                'over_assigned': over_assigned,
                'member_distribution': distribution,
                'recommendation': recommendation,
            }

        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'message': f'Failed to analyze assignments: {str(e)}',
                'db_path': self.db_path,
                'cwd': os.getcwd(),
            }

    @staticmethod
    def _gini_coefficient(values: np.ndarray) -> float:
        arr = np.sort(values.flatten())
        n = len(arr)
        if n == 0 or arr.sum() == 0:
            return 0.0
        cumsum = np.cumsum(arr)
        return float((2 * cumsum.sum() - (n + 1) * arr.sum()) / (n * arr.sum()))

    @staticmethod
    def _generate_recommendation(
        is_fair, gini, cv, never_assigned, over_assigned,
        mean_count, total_members, active_member_count, fairness_status
    ) -> str:
        if is_fair:
            return (
                f"Assignment workload is distributed fairly across all {total_members} members "
                f"(Gini: {gini:.2f}, CV: {cv:.2f}). No action required."
            )
        parts = []
        if fairness_status == 'BIASED':
            parts.append(f"Significant workload imbalance detected (Gini: {gini:.2f}, CV: {cv:.2f}).")
        else:
            parts.append(f"Mild workload imbalance detected (Gini: {gini:.2f}, CV: {cv:.2f}).")
        if never_assigned:
            count = len(never_assigned)
            names = ', '.join(never_assigned[:3])
            suffix = f' and {count - 3} more' if count > 3 else ''
            parts.append(f"{count} member(s) have never been assigned: {names}{suffix}.")
        if over_assigned:
            names = ', '.join(f"{m['name']} ({m['count']}x)" for m in over_assigned[:3])
            parts.append(f"Over-assigned: {names}.")
        if mean_count > 0:
            parts.append(f"Average assignments per member: {mean_count:.1f}.")
        parts.append(
            "Use the AssignAI system to actively include under-assigned members "
            "and balance the workload."
        )
        return ' '.join(parts)


def main():
    print("=" * 60)
    print("AssignAI — Per-Member Participation Fairness Report")
    print("=" * 60)
    analyzer = FairnessAnalyzer()
    results = analyzer.analyze_recent_assignments(days=90)
    if not results['success']:
        print(f"ERROR: {results.get('message', results.get('error'))}")
        return
    print(f"Analysis Window  : last {results['days_analyzed']} days")
    print(f"Total Assignments: {results['total_assignments']}")
    print(f"Total Members    : {results['total_members']}")
    print(f"Active Members   : {results['active_members']}")
    print(f"Mean Assignments : {results['mean_assignments']:.2f}")
    print(f"Gini Coefficient : {results['gini_coefficient']:.4f}")
    print(f"CV               : {results['coefficient_of_variation']:.4f}")
    print(f"Fairness Status  : {results['fairness_status']}")
    if results['never_assigned']:
        print(f"Never Assigned   : {', '.join(results['never_assigned'][:10])}")
    if results['over_assigned']:
        for m in results['over_assigned']:
            print(f"Over-Assigned    : {m['name']} ({m['count']} assignments)")
    print(f"Recommendation   : {results['recommendation']}")


if __name__ == '__main__':
    main()

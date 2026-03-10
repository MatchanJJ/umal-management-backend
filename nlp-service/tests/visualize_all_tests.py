"""
Comprehensive Test Results Visualization
Shows semantic parser functional and quality test results
"""

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from pathlib import Path


def create_test_summary_charts():
    """Create comprehensive test results visualization."""
    
    # Test results data
    test_suites = {
        'Functional Tests': {
            'passed': 70,
            'failed': 0,
            'categories': {
                'Basic Constraints': {'passed': 8, 'failed': 0},
                'Multi-Group': {'passed': 5, 'failed': 0},
                'Priority Rules': {'passed': 4, 'failed': 0},
                'Schedule Conflicts': {'passed': 2, 'failed': 0},
                'Confirmation': {'passed': 4, 'failed': 0},
                'Tagalog Support': {'passed': 3, 'failed': 0},
                'Schema Validation': {'passed': 8, 'failed': 0},
                'Hallucination Detection': {'passed': 2, 'failed': 0},
                'Complex Requests': {'passed': 3, 'failed': 0},
                'Edge Cases': {'passed': 3, 'failed': 0},
                'Multi-Turn': {'passed': 14, 'failed': 0},
                'Batch Suite': {'passed': 14, 'failed': 0}
            }
        },
        'Quality Tests': {
            'passed': 13,
            'failed': 3,
            'categories': {
                'Accuracy Metrics': {'passed': 2, 'failed': 1},
                'Coherence Checks': {'passed': 9, 'failed': 0},
                'Hallucination Detection': {'passed': 2, 'failed': 0},
                'Relevance Scoring': {'passed': 0, 'failed': 2},
                'Consistency': {'passed': 1, 'failed': 0},
                'Quality Benchmark': {'passed': 1, 'failed': 0}
            }
        },
        'Hallucination Audit': {
            'passed': 22,
            'failed': 12,
            'categories': {
                'Single-Turn': {'passed': 17, 'failed': 4},
                'Multi-Turn': {'passed': 5, 'failed': 8}
            }
        }
    }
    
    # Create figure with subplots
    fig = plt.figure(figsize=(16, 10))
    fig.suptitle('Semantic Parser Test Suite - Complete Results (T5-fine-tuned)', 
                 fontsize=18, fontweight='bold', y=0.98)
    
    # Define colors
    pass_color = '#2ecc71'
    fail_color = '#e74c3c'
    
    # 1. Overall Summary Pie Chart (Top Left)
    ax1 = plt.subplot(2, 3, 1)
    total_passed = sum(s['passed'] for s in test_suites.values())
    total_failed = sum(s['failed'] for s in test_suites.values())
    
    wedges, texts, autotexts = ax1.pie([total_passed, total_failed],
                                         labels=['Passed', 'Failed'],
                                         colors=[pass_color, fail_color],
                                         autopct='%1.1f%%',
                                         startangle=90,
                                         explode=(0.05, 0),
                                         textprops={'fontsize': 11, 'weight': 'bold'})
    
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontsize(13)
        autotext.set_weight('bold')
    
    ax1.set_title(f'Overall Results\n{total_passed}/{total_passed + total_failed} Passed', 
                  fontsize=13, fontweight='bold', pad=15)
    
    # 2. Test Suite Breakdown (Top Middle)
    ax2 = plt.subplot(2, 3, 2)
    suite_names = list(test_suites.keys())
    passed_counts = [test_suites[s]['passed'] for s in suite_names]
    failed_counts = [test_suites[s]['failed'] for s in suite_names]
    
    x = range(len(suite_names))
    width = 0.6
    
    bars1 = ax2.bar(x, passed_counts, width, label='Passed', color=pass_color)
    bars2 = ax2.bar(x, failed_counts, width, bottom=passed_counts, 
                    label='Failed', color=fail_color)
    
    ax2.set_ylabel('Number of Tests', fontsize=11, fontweight='bold')
    ax2.set_title('Test Suite Breakdown', fontsize=13, fontweight='bold', pad=15)
    ax2.set_xticks(x)
    ax2.set_xticklabels(suite_names, fontsize=9, rotation=15, ha='right')
    ax2.legend(loc='upper right')
    ax2.grid(axis='y', alpha=0.3)
    
    # Add value labels
    for bar in bars1:
        height = bar.get_height()
        if height > 0:
            ax2.text(bar.get_x() + bar.get_width()/2., height/2,
                    f'{int(height)}', ha='center', va='center',
                    fontweight='bold', color='white', fontsize=10)
    
    for i, bar in enumerate(bars2):
        height = bar.get_height()
        if height > 0:
            ax2.text(bar.get_x() + bar.get_width()/2.,
                    passed_counts[i] + height/2,
                    f'{int(height)}', ha='center', va='center',
                    fontweight='bold', color='white', fontsize=10)
    
    # 3. Pass Rate by Suite (Top Right)
    ax3 = plt.subplot(2, 3, 3)
    pass_rates = []
    for suite_name in suite_names:
        suite = test_suites[suite_name]
        total = suite['passed'] + suite['failed']
        rate = (suite['passed'] / total * 100) if total > 0 else 0
        pass_rates.append(rate)
    
    bars = ax3.barh(suite_names, pass_rates, color=[pass_color if r == 100 else '#f39c12' if r >= 80 else fail_color for r in pass_rates])
    
    ax3.set_xlabel('Pass Rate (%)', fontsize=11, fontweight='bold')
    ax3.set_title('Pass Rate by Suite', fontsize=13, fontweight='bold', pad=15)
    ax3.set_xlim(0, 100)
    ax3.grid(axis='x', alpha=0.3)
    
    for i, (bar, rate) in enumerate(zip(bars, pass_rates)):
        ax3.text(rate + 2, i, f'{rate:.1f}%',
                va='center', fontweight='bold', fontsize=9)
    
    # 4. Functional Tests Detail (Bottom Left)
    ax4 = plt.subplot(2, 3, 4)
    func_cats = list(test_suites['Functional Tests']['categories'].keys())
    func_passed = [test_suites['Functional Tests']['categories'][c]['passed'] for c in func_cats]
    func_failed = [test_suites['Functional Tests']['categories'][c]['failed'] for c in func_cats]
    
    y4 = range(len(func_cats))
    ax4.barh(y4, func_passed, 0.7, label='Passed', color=pass_color)
    
    ax4.set_xlabel('Number of Tests', fontsize=10, fontweight='bold')
    ax4.set_title('Functional Tests (70/70 Passed)', fontsize= 12, fontweight='bold', pad=15, color=pass_color)
    ax4.set_yticks(y4)
    ax4.set_yticklabels(func_cats, fontsize=8)
    ax4.grid(axis='x', alpha=0.3)
    
    for i, (p, f) in enumerate(zip(func_passed, func_failed)):
        total = p + f
        ax4.text(total + 0.3, i, f'{total}',
                va='center', fontweight='bold', fontsize=8)
    
    # 5. Quality Tests Detail (Bottom Middle)
    ax5 = plt.subplot(2, 3, 5)
    qual_cats = list(test_suites['Quality Tests']['categories'].keys())
    qual_passed = [test_suites['Quality Tests']['categories'][c]['passed'] for c in qual_cats]
    qual_failed = [test_suites['Quality Tests']['categories'][c]['failed'] for c in qual_cats]
    
    y5 = range(len(qual_cats))
    bars5_1 = ax5.barh(y5, qual_passed, 0.7, label='Passed', color=pass_color)
    bars5_2 = ax5.barh(y5, qual_failed, 0.7, left=qual_passed, 
                       label='Failed', color=fail_color)
    
    ax5.set_xlabel('Number of Tests', fontsize=10, fontweight='bold')
    ax5.set_title('Quality Tests (13/16 Passed)', fontsize=12, fontweight='bold', pad=15)
    ax5.set_yticks(y5)
    ax5.set_yticklabels(qual_cats, fontsize=8)
    ax5.legend(loc='lower right', fontsize=8)
    ax5.grid(axis='x', alpha=0.3)
    
    for i, (p, f) in enumerate(zip(qual_passed, qual_failed)):
        total = p + f
        if total > 0:
            ax5.text(total + 0.3, i, f'{total}',
                    va='center', fontweight='bold', fontsize=8)
    
    # 6. Hallucination Audit Detail (Bottom Right)
    ax6 = plt.subplot(2, 3, 6)
    hall_cats = list(test_suites['Hallucination Audit']['categories'].keys())
    hall_passed = [test_suites['Hallucination Audit']['categories'][c]['passed'] for c in hall_cats]
    hall_failed = [test_suites['Hallucination Audit']['categories'][c]['failed'] for c in hall_cats]
    
    y6 = range(len(hall_cats))
    bars6_1 = ax6.barh(y6, hall_passed, 0.7, label='Passed', color=pass_color)
    bars6_2 = ax6.barh(y6, hall_failed, 0.7, left=hall_passed,
                       label='Failed', color=fail_color)
    
    ax6.set_xlabel('Number of Tests', fontsize=10, fontweight='bold')
    ax6.set_title('Hallucination Audit (22/34 Passed)', fontsize=12, fontweight='bold', pad=15)
    ax6.set_yticks(y6)
    ax6.set_yticklabels(hall_cats, fontsize=10)
    ax6.legend(loc='lower right')
    ax6.grid(axis='x', alpha=0.3)
    
    for i, (p, f) in enumerate(zip(hall_passed, hall_failed)):
        ax6.text(p, i, f'{p}' if p > 0 else '',
                va='center', ha='center', fontweight='bold', 
                fontsize=9, color='white')
        if f > 0:
            ax6.text(p + f/2, i, f'{f}',
                    va='center', ha='center', fontweight='bold',
                    fontsize=9, color='white')
    
    plt.tight_layout(rect=[0, 0, 1, 0.96])
    
    output_path = Path(__file__).parent / "test_suite_summary.png"
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    print(f"\n✓ Test suite visualization saved: {output_path}")
    print(f"\nOverall Results:")
    print(f"  Total Tests: {total_passed + total_failed}")
    print(f"  Passed: {total_passed} ({total_passed/(total_passed + total_failed)*100:.1f}%)")
    print(f"  Failed: {total_failed} ({total_failed/(total_passed + total_failed)*100:.1f}%)")
    print(f"\n  Functional: {test_suites['Functional Tests']['passed']}/70 (100%)")
    print(f"  Quality: {test_suites['Quality Tests']['passed']}/16 (81.3%)")
    print(f"  Hallucination Audit: {test_suites['Hallucination Audit']['passed']}/34 (64.7%)")
    plt.close()


if __name__ == "__main__":
    print("\n" + "="*70)
    print("Semantic Parser Test Suite - Complete Visualization")
    print("="*70)
    create_test_summary_charts()
    print("\n" + "="*70)

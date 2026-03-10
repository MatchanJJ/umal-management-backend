"""
Semantic Parser Quality Tests Visualization
Detailed breakdown of quality metrics and test results
"""

import matplotlib.pyplot as plt
from pathlib import Path


def create_quality_tests_chart():
    """Create comprehensive quality test results visualization."""
    
    # Quality test results data (from test_semantic_parser_quality.py)
    quality_tests = {
        'Accuracy Metrics': {
            'passed': 2,
            'failed': 1,
            'tests': [
                ('Basic accuracy for simple cases', True),
                ('Multi-group extraction accuracy', True),
                ('Priority detection accuracy', False)
            ]
        },
        'Coherence Checks': {
            'passed': 9,
            'failed': 0,
            'tests': [
                ('Count matches group count', True),
                ('College values are valid', True),
                ('Gender values are valid', True),
                ('New/old values are valid', True),
                ('Priority rules valid', True),
                ('Conflict_ok boolean check', True),
                ('No unknown fields', True),
                ('Multi-group coherence', True),
                ('Global structure valid', True)
            ]
        },
        'Hallucination Detection': {
            'passed': 2,
            'failed': 0,
            'tests': [
                ('No fabricated colleges', True),
                ('No fabricated priorities', True)
            ]
        },
        'Relevance Scoring': {
            'passed': 0,
            'failed': 2,
            'tests': [
                ('College mention relevance', False),
                ('Gender mention relevance', False)
            ]
        },
        'Consistency': {
            'passed': 1,
            'failed': 0,
            'tests': [
                ('Consistent output for similar inputs', True)
            ]
        },
        'Quality Benchmark': {
            'passed': 1,
            'failed': 0,
            'tests': [
                ('Comprehensive quality benchmark', True)
            ]
        }
    }
    
    # Calculate totals
    total_passed = sum(cat['passed'] for cat in quality_tests.values())
    total_failed = sum(cat['failed'] for cat in quality_tests.values())
    total_tests = total_passed + total_failed
    
    # Create figure with 2 subplots
    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 7))
    fig.patch.set_facecolor('white')
    fig.suptitle('Semantic Parser Quality Tests - Results (T5-fine-tuned)', 
                 fontsize=16, fontweight='bold', y=0.98)
    
    # Define colors
    pass_color = '#2ecc71'
    fail_color = '#e74c3c'
    colors = [pass_color, fail_color]
    
    # 1. Overall Results Pie Chart (Left)
    wedges, texts, autotexts = ax1.pie([total_passed, total_failed],
                                         labels=['Passed', 'Failed'],
                                         colors=colors,
                                         autopct='%1.1f%%',
                                         startangle=90,
                                         explode=(0.05, 0),
                                         textprops={'fontsize': 12, 'weight': 'bold'})
    
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontsize(14)
        autotext.set_weight('bold')
    
    ax1.set_title(f'Overall Quality Results\n{total_passed}/{total_tests} Tests Passed', 
                  fontsize=14, fontweight='bold', pad=20)
    
    # 2. Pass Rate by Category (Right)
    categories = list(quality_tests.keys())
    pass_rates = []
    for cat in categories:
        total = quality_tests[cat]['passed'] + quality_tests[cat]['failed']
        rate = (quality_tests[cat]['passed'] / total * 100) if total > 0 else 0
        pass_rates.append(rate)
    
    bar_colors = [pass_color if r == 100 else '#f39c12' if r >= 80 else fail_color 
                  for r in pass_rates]
    bars = ax2.barh(categories, pass_rates, color=bar_colors)
    
    ax2.set_xlabel('Pass Rate (%)', fontsize=11, fontweight='bold')
    ax2.set_title('Pass Rate by Category', fontsize=14, fontweight='bold', pad=20)
    ax2.set_xlim(0, 110)
    ax2.grid(axis='x', alpha=0.3)
    
    # Add percentage labels and test counts
    for i, (bar, rate, cat) in enumerate(zip(bars, pass_rates, categories)):
        passed = quality_tests[cat]['passed']
        failed = quality_tests[cat]['failed']
        total = passed + failed
        
        ax2.text(rate + 2, i, f'{rate:.0f}% ({passed}/{total})',
                va='center', fontweight='bold', fontsize=10)
    
    plt.tight_layout(rect=[0, 0, 1, 0.95])
    
    # Save the figure
    output_path = Path(__file__).parent / 'quality_tests_results.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    print(f"\n✓ Quality tests chart saved to: {output_path}")
    plt.close()


if __name__ == '__main__':
    create_quality_tests_chart()
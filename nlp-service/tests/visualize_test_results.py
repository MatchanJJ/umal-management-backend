"""
Professional test results visualization with proper charts
"""

import matplotlib.pyplot as plt
from matplotlib.patches import Circle
import numpy as np
from pathlib import Path


def create_test_results():
    """Create simple pie chart visualization."""
    
    # Test results from actual test run
    tests = [
        ("multiturn_001", "Progressive modifier chain", False),
        ("multiturn_002", "Priority accumulation", False),
        ("multiturn_003", "College-add modifier", False),
        ("multiturn_004", "Multi-group spec → global → confirm", True),
        ("multiturn_005", "Tagalog multi-turn conversation", True),
        ("multiturn_006", "Mid-conversation correction", True),
    ]
    
    passed = sum(1 for _, _, p in tests if p)
    total = len(tests)
    failed = total - passed
    
    # Create figure with two subplots
    fig = plt.figure(figsize=(14, 9))
    fig.patch.set_facecolor('white')
    
    gs = fig.add_gridspec(2, 1, height_ratios=[1.2, 1], hspace=0.3)
    
    # Title
    fig.suptitle('Multi-Turn Conversation Tests - Results', 
                fontsize=20, fontweight='bold', y=0.97)
    
    # ============ Top: Pie Chart ============
    ax1 = fig.add_subplot(gs[0])
    ax1.set_facecolor('white')
    
    colors = ['#2ecc71', '#e74c3c']
    sizes = [passed, failed]
    labels = [f'Passed\n{passed} tests', f'Failed\n{failed} tests']
    explode = (0.05, 0.05)
    
    wedges, texts, autotexts = ax1.pie(sizes, explode=explode, labels=labels, colors=colors,
                                        autopct='%1.1f%%', startangle=90,
                                        textprops={'fontsize': 14, 'fontweight': 'bold'},
                                        wedgeprops={'edgecolor': 'white', 'linewidth': 3})
    
    # Style the text
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontweight('bold')
        autotext.set_fontsize(18)
    
    for text in texts:
        text.set_fontweight('bold')
        text.set_fontsize(14)
    
    # Add center circle for donut effect
    centre_circle = Circle((0, 0), 0.70, fc='white', linewidth=2, edgecolor='#34495e')
    ax1.add_artist(centre_circle)
    
    # Center text
    pass_rate = (passed / total) * 100
    ax1.text(0, 0.1, f'{pass_rate:.0f}%', ha='center', va='center', 
            fontsize=42, fontweight='bold', color='#2c3e50')
    ax1.text(0, -0.15, 'Pass Rate', ha='center', va='center', 
            fontsize=14, color='#7f8c8d', fontweight='bold')
    
    # ============ Bottom: Test Details List ============
    ax2 = fig.add_subplot(gs[1])
    ax2.set_facecolor('white')
    ax2.axis('off')
    ax2.set_xlim(0, 10)
    ax2.set_ylim(0, len(tests) + 1.5)
    
    # Section headers
    ax2.text(0.5, len(tests) + 1, 'Test Details:', ha='left', va='top', 
            fontsize=16, fontweight='bold', color='#2c3e50')
    
    # Group tests by status
    passed_tests = [(tid, desc) for tid, desc, status in tests if status]
    failed_tests = [(tid, desc) for tid, desc, status in tests if not status]
    
    y_pos = len(tests) + 0.2
    
    # Passed tests
    if passed_tests:
        ax2.text(0.8, y_pos, '✓ PASSED:', ha='left', va='top', 
                fontsize=13, fontweight='bold', color='#2ecc71')
        y_pos -= 0.6
        
        for tid, desc in passed_tests:
            ax2.text(1.2, y_pos, f'• {tid}', ha='left', va='top', 
                    fontsize=11, fontfamily='monospace', color='#2c3e50', fontweight='bold')
            ax2.text(3.5, y_pos, desc, ha='left', va='top', 
                    fontsize=11, color='#34495e')
            y_pos -= 0.55
    
    # Add spacing between sections
    y_pos -= 0.3
    
    # Failed tests
    if failed_tests:
        ax2.text(0.8, y_pos, '✗ FAILED:', ha='left', va='top', 
                fontsize=13, fontweight='bold', color='#e74c3c')
        y_pos -= 0.6
        
        for tid, desc in failed_tests:
            ax2.text(1.2, y_pos, f'• {tid}', ha='left', va='top', 
                    fontsize=11, fontfamily='monospace', color='#2c3e50', fontweight='bold')
            ax2.text(3.5, y_pos, desc, ha='left', va='top', 
                    fontsize=11, color='#34495e')
            y_pos -= 0.55
    
    plt.tight_layout(rect=[0, 0.02, 1, 0.96])
    output_path = Path(__file__).parent / "multiturn_test_results.png"
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    print(f"✓ Test results visualization saved to: {output_path}")
    
    # Open the image
    import subprocess
    import sys
    if sys.platform == 'win32':
        subprocess.run(['start', str(output_path)], shell=True)


if __name__ == "__main__":
    print("\n" + "="*60)
    print("Multi-Turn Test Results Visualization")
    print("="*60 + "\n")
    create_test_results()
    print("\n" + "="*60)

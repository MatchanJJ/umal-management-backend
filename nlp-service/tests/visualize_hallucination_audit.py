"""
Hallucination Audit Visualization - Pie chart showing model output quality
"""

import matplotlib.pyplot as plt
from matplotlib.patches import Circle, FancyBboxPatch
import json
from pathlib import Path


def create_hallucination_audit():
    """Create hallucination audit pie chart."""
    
    # Actual test results from hallucination audit
    # Single-turn: 17 passed, 4 failed (21 total)
    # Multi-turn: 5 passed, 8 failed (13 total)
    single_turn_passed = 17
    single_turn_failed = 4
    multi_turn_passed = 5
    multi_turn_failed = 8
    
    total_cases = 34
    total_passed = single_turn_passed + multi_turn_passed  # 22
    total_failed = single_turn_failed + multi_turn_failed  # 12
    
    # Calculate percentages
    pass_rate = (total_passed / total_cases * 100)
    fail_rate = (total_failed / total_cases * 100)
    
    # Create figure with two subplots
    fig = plt.figure(figsize=(14, 10))
    fig.patch.set_facecolor('white')
    
    gs = fig.add_gridspec(2, 2, height_ratios=[1.5, 1], hspace=0.3, wspace=0.3)
    
    # Main title
    fig.suptitle('Model Hallucination Audit - Test Results', 
                fontsize=20, fontweight='bold', y=0.96)
    
    # ============ Top Left: Overall Results ============
    ax1 = fig.add_subplot(gs[0, 0])
    ax1.set_facecolor('white')
    
    sizes = [total_passed, total_failed]
    labels = [f'Clean Outputs\n{total_passed} cases', f'Issues Detected\n{total_failed} cases']
    colors = ['#2ecc71', '#e74c3c']
    explode = (0.05, 0.1)
    
    wedges, texts, autotexts = ax1.pie(
        sizes, 
        explode=explode, 
        labels=labels, 
        colors=colors,
        autopct='%1.1f%%', 
        startangle=90,
        textprops={'fontsize': 12, 'fontweight': 'bold'},
        wedgeprops={'edgecolor': 'white', 'linewidth': 3}
    )
    
    for autotext in autotexts:
        autotext.set_color('white')
        autotext.set_fontweight('bold')
        autotext.set_fontsize(14)
    
    for text in texts:
        text.set_fontweight('bold')
        text.set_fontsize(11)
    
    # Center circle
    centre_circle = Circle((0, 0), 0.70, fc='white', linewidth=2, edgecolor='#34495e')
    ax1.add_artist(centre_circle)
    
    # Center text
    status_color = '#2ecc71' if pass_rate >= 80 else '#f39c12' if pass_rate >= 60 else '#e74c3c'
    ax1.text(0, 0.12, f'{pass_rate:.1f}%', ha='center', va='center', 
            fontsize=36, fontweight='bold', color=status_color)
    ax1.text(0, -0.15, 'Pass Rate', ha='center', va='center', 
            fontsize=12, color='#7f8c8d', fontweight='bold')
    
    ax1.set_title('Overall Results (34 test cases)', fontsize=13, fontweight='bold', pad=15)
    
    # ============ Top Right: Breakdown by Test Type ============
    ax2 = fig.add_subplot(gs[0, 1])
    ax2.set_facecolor('white')
    
    categories = ['Single-Turn\nTests', 'Multi-Turn\nTests']
    passed_counts = [single_turn_passed, multi_turn_passed]
    failed_counts = [single_turn_failed, multi_turn_failed]
    
    x = range(len(categories))
    width = 0.35
    
    bars1 = ax2.bar([i - width/2 for i in x], passed_counts, width, 
                    label='Passed', color='#2ecc71', edgecolor='#27ae60', linewidth=2)
    bars2 = ax2.bar([i + width/2 for i in x], failed_counts, width, 
                    label='Failed', color='#e74c3c', edgecolor='#c0392b', linewidth=2)
    
    ax2.set_ylabel('Number of Tests', fontsize=11, fontweight='bold')
    ax2.set_title('Results by Test Type', fontsize=13, fontweight='bold', pad=15)
    ax2.set_xticks(x)
    ax2.set_xticklabels(categories, fontsize=10, fontweight='bold')
    ax2.legend(fontsize=10, loc='upper right')
    ax2.grid(axis='y', alpha=0.3, linestyle='--')
    ax2.spines['top'].set_visible(False)
    ax2.spines['right'].set_visible(False)
    
    # Add value labels on bars
    for bars in [bars1, bars2]:
        for bar in bars:
            height = bar.get_height()
            if height > 0:
                ax2.text(bar.get_x() + bar.get_width()/2., height,
                        f'{int(height)}',
                        ha='center', va='bottom', fontsize=10, fontweight='bold')
    
    # ============ Bottom: Summary Statistics ============
    ax3 = fig.add_subplot(gs[1, :])
    ax3.set_facecolor('white')
    ax3.axis('off')
    ax3.set_xlim(0, 10)
    ax3.set_ylim(0, 3)
    
    # Summary title
    ax3.text(5, 2.5, 'Test Summary', ha='center', va='top', 
            fontsize=15, fontweight='bold', color='#2c3e50')
    
    # Summary boxes
    summary_data = [
        ('Total Cases', str(total_cases), '#3498db'),
        ('Passed', str(total_passed), '#2ecc71'),
        ('Failed', str(total_failed), '#e74c3c'),
        ('Pass Rate', f'{pass_rate:.1f}%', status_color)
    ]
    
    x_positions = [1.5, 3.5, 5.5, 7.5]
    for (label, value, color), x_pos in zip(summary_data, x_positions):
        # Box
        from matplotlib.patches import FancyBboxPatch
        box = FancyBboxPatch((x_pos - 0.6, 0.5), 1.2, 1.2,
                            boxstyle="round,pad=0.1",
                            facecolor=color, edgecolor='#34495e',
                            linewidth=2, alpha=0.2)
        ax3.add_patch(box)
        
        # Value
        ax3.text(x_pos, 1.3, value, ha='center', va='center',
                fontsize=20, fontweight='bold', color=color)
        
        # Label
        ax3.text(x_pos, 0.7, label, ha='center', va='center',
                fontsize=10, fontweight='bold', color='#2c3e50')
    
    # Footer note
    note_text = (
        "Audit Details: 21 single-turn parsing tests (17 passed, 4 failed) | "
        "13 multi-turn modifier tests (5 passed, 8 failed)"
    )
    ax3.text(5, 0.1, note_text, ha='center', va='center',
            fontsize=9, color='#7f8c8d', style='italic')
    
    plt.tight_layout(rect=[0, 0.02, 1, 0.94])
    
    test_dir = Path(__file__).parent
    output_path = test_dir / "hallucination_audit.png"
    plt.savefig(output_path, dpi=300, bbox_inches='tight', facecolor='white')
    print(f"✓ Hallucination audit saved to: {output_path}")
    plt.close()
    
    return output_path


def main():
    print("\n" + "="*60)
    print("Model Hallucination Audit Visualization")
    print("="*60 + "\n")
    
    output_path = create_hallucination_audit()
    
    print("\n" + "="*60)
    print(f"Output: {output_path}")
    print("="*60 + "\n")
    
    # Open the image
    import subprocess
    import sys
    if sys.platform == 'win32':
        subprocess.run(['start', str(output_path)], shell=True)


if __name__ == "__main__":
    main()

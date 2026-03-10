"""
Hallucination Audit Results - March 10, 2026
Script to visualize the comprehensive audit results
"""
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

# Overall results - T5 Model
total_tests = 34
total_passed = 22
total_failed = 12

# Single-turn results (21 tests)
single_turn_passed = 17
single_turn_failed = 4

# Multi-turn results (13 tests)
multi_turn_passed = 5
multi_turn_failed = 8

# Breakdown by category - T5 Model Results
single_turn_categories = {
    'No Hallucination': {'passed': 7, 'failed': 2},
    'College Extraction': {'passed': 4, 'failed': 0},
    'Gender (English)': {'passed': 2, 'failed': 0},
    'Gender (Tagalog)': {'passed': 0, 'failed': 2},
    'Multi-Group': {'passed': 4, 'failed': 0}
}

multi_turn_categories = {
    'Ghost Fields': {'passed': 0, 'failed': 3},
    'Count Modifiers': {'passed': 1, 'failed': 0},
    'Gender Modifiers': {'passed': 0, 'failed': 2},
    'Experience Modifiers': {'passed': 0, 'failed': 2},
    'Confirmation': {'passed': 3, 'failed': 0},
    'College Modifiers': {'passed': 1, 'failed': 1}
}

# Create comprehensive visualization
fig = plt.figure(figsize=(16, 10))
fig.suptitle('Semantic Parser Hallucination Audit Results\nMarch 10, 2026', 
             fontsize=16, fontweight='bold', y=0.98)

# Define colors
pass_color = '#2ecc71'
fail_color = '#e74c3c'
colors = [pass_color, fail_color]

# 1. Overall Results (Top Left)
ax1 = plt.subplot(2, 3, 1)
wedges, texts, autotexts = ax1.pie([total_passed, total_failed], 
                                     labels=['Passed', 'Failed'],
                                     autopct='%1.1f%%',
                                     colors=colors,
                                     startangle=90,
                                     textprops={'fontsize': 11, 'weight': 'bold'})
ax1.set_title(f'Overall Results\n{total_passed}/{total_tests} Passed', 
              fontsize=13, fontweight='bold', pad=15)

# 2. Single-Turn vs Multi-Turn (Top Middle)
ax2 = plt.subplot(2, 3, 2)
categories = ['Single-Turn\n(21 tests)', 'Multi-Turn\n(13 tests)']
passed_counts = [single_turn_passed, multi_turn_passed]
failed_counts = [single_turn_failed, multi_turn_failed]

x = range(len(categories))
width = 0.5

bars1 = ax2.bar(x, passed_counts, width, label='Passed', color=pass_color)
bars2 = ax2.bar(x, failed_counts, width, bottom=passed_counts, label='Failed', color=fail_color)

ax2.set_ylabel('Number of Tests', fontsize=11, fontweight='bold')
ax2.set_title('Test Category Breakdown', fontsize=13, fontweight='bold', pad=15)
ax2.set_xticks(x)
ax2.set_xticklabels(categories, fontsize=10)
ax2.legend(loc='upper right')
ax2.grid(axis='y', alpha=0.3)

# Add value labels on bars
for bar in bars1:
    height = bar.get_height()
    if height > 0:
        ax2.text(bar.get_x() + bar.get_width()/2., height/2,
                f'{int(height)}', ha='center', va='center', 
                fontweight='bold', color='white', fontsize=11)

for i, bar in enumerate(bars2):
    height = bar.get_height()
    if height > 0:
        ax2.text(bar.get_x() + bar.get_width()/2., 
                passed_counts[i] + height/2,
                f'{int(height)}', ha='center', va='center',
                fontweight='bold', color='white', fontsize=11)

# 3. Pass Rate Comparison (Top Right)
ax3 = plt.subplot(2, 3, 3)
pass_rates = [
    (single_turn_passed / 21 * 100),
    (multi_turn_passed / 13 * 100),
    (total_passed / total_tests * 100)
]
labels = ['Single-Turn', 'Multi-Turn', 'Overall']
bars = ax3.barh(labels, pass_rates, color=[pass_color, pass_color, '#3498db'])

ax3.set_xlabel('Pass Rate (%)', fontsize=11, fontweight='bold')
ax3.set_title('Pass Rate Comparison', fontsize=13, fontweight='bold', pad=15)
ax3.set_xlim(0, 100)
ax3.grid(axis='x', alpha=0.3)

# Add percentage labels
for i, (bar, rate) in enumerate(zip(bars, pass_rates)):
    ax3.text(rate + 2, i, f'{rate:.1f}%', 
            va='center', fontweight='bold', fontsize=10)

# 4. Single-Turn Category Breakdown (Bottom Left)
ax4 = plt.subplot(2, 3, 4)
single_labels = []
single_passed = []
single_failed = []

for category, results in single_turn_categories.items():
    single_labels.append(category)
    single_passed.append(results['passed'])
    single_failed.append(results['failed'])

x4 = range(len(single_labels))
bars4_1 = ax4.bar(x4, single_passed, 0.6, label='Passed', color=pass_color)
bars4_2 = ax4.bar(x4, single_failed, 0.6, bottom=single_passed, label='Failed', color=fail_color)

ax4.set_ylabel('Number of Tests', fontsize=11, fontweight='bold')
ax4.set_title('Single-Turn Test Categories', fontsize=13, fontweight='bold', pad=15)
ax4.set_xticks(x4)
ax4.set_xticklabels(single_labels, fontsize=9, rotation=15, ha='right')
ax4.legend(loc='upper right')
ax4.grid(axis='y', alpha=0.3)

# Add value labels
for bar in bars4_1:
    height = bar.get_height()
    if height > 0:
        ax4.text(bar.get_x() + bar.get_width()/2., height/2,
                f'{int(height)}', ha='center', va='center',
                fontweight='bold', color='white', fontsize=10)

for i, bar in enumerate(bars4_2):
    height = bar.get_height()
    if height > 0:
        ax4.text(bar.get_x() + bar.get_width()/2.,
                single_passed[i] + height/2,
                f'{int(height)}', ha='center', va='center',
                fontweight='bold', color='white', fontsize=10)

# 5. Multi-Turn Category Breakdown (Bottom Middle)
ax5 = plt.subplot(2, 3, 5)
multi_labels = []
multi_passed = []
multi_failed = []

for category, results in multi_turn_categories.items():
    multi_labels.append(category)
    multi_passed.append(results['passed'])
    multi_failed.append(results['failed'])

x5 = range(len(multi_labels))
bars5_1 = ax5.bar(x5, multi_passed, 0.6, label='Passed', color=pass_color)
bars5_2 = ax5.bar(x5, multi_failed, 0.6, bottom=multi_passed, label='Failed', color=fail_color)

ax5.set_ylabel('Number of Tests', fontsize=11, fontweight='bold')
ax5.set_title('Multi-Turn Test Categories', fontsize=13, fontweight='bold', pad=15)
ax5.set_xticks(x5)
ax5.set_xticklabels(multi_labels, fontsize=9, rotation=15, ha='right')
ax5.legend(loc='upper right')
ax5.grid(axis='y', alpha=0.3)

# Add value labels
for bar in bars5_1:
    height = bar.get_height()
    if height > 0:
        ax5.text(bar.get_x() + bar.get_width()/2., height/2,
                f'{int(height)}', ha='center', va='center',
                fontweight='bold', color='white', fontsize=10)

for i, bar in enumerate(bars5_2):
    height = bar.get_height()
    if height > 0:
        ax5.text(bar.get_x() + bar.get_width()/2.,
                multi_passed[i] + height/2,
                f'{int(height)}', ha='center', va='center',
                fontweight='bold', color='white', fontsize=10)

# 6. Summary Stats (Bottom Right)
ax6 = plt.subplot(2, 3, 6)
ax6.axis('off')

# Simple summary text
summary_text = f"Total Tests: {total_tests}\nPassed: {total_passed}\nFailed: {total_failed}\n\nParser: T5-fine-tuned\nPass Rate: {total_passed/total_tests*100:.1f}%"
ax6.text(0.5, 0.5, summary_text, fontsize=12, ha='center', va='center',
         transform=ax6.transAxes, family='monospace', fontweight='bold')

plt.tight_layout(rect=[0, 0, 1, 0.96])
plt.savefig('hallucination_audit_march_2026.png', dpi=300, bbox_inches='tight')
print("✓ Audit visualization saved: hallucination_audit_march_2026.png")
print(f"\nAudit Summary:")
print(f"  Total Tests: {total_tests}")
print(f"  Passed: {total_passed} ({total_passed/total_tests*100:.1f}%)")
print(f"  Failed: {total_failed} ({total_failed/total_tests*100:.1f}%)")
print(f"\n  Single-Turn: {single_turn_passed}/21 passed")
print(f"  Multi-Turn: {multi_turn_passed}/13 passed")
plt.show()

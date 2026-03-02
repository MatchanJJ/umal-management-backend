"""
Chart generator for test reports.
Creates matplotlib visualizations and embeds them as base64 in HTML.
"""

import json
import base64
import io
from pathlib import Path
from typing import Dict, Any, List

try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    import matplotlib.patches as mpatches
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False


class ChartGenerator:
    """Generate charts for test reports."""
    
    def __init__(self):
        """Initialize chart generator."""
        self.test_dir = Path(__file__).parent
    
    def load_metrics(self) -> Dict[str, Any]:
        """Load test metrics from JSON files."""
        metrics = {}
        
        # Load test case results
        test_cases_file = self.test_dir / "test_cases.json"
        if test_cases_file.exists():
            with open(test_cases_file, 'r', encoding='utf-8') as f:
                test_cases = json.load(f)
                # Group by category
                categories = {}
                for tc in test_cases:
                    cat = tc.get('category', 'Unknown')
                    if cat not in categories:
                        categories[cat] = []
                    categories[cat].append(tc)
                metrics['categories'] = {cat: len(cases) for cat, cases in categories.items()}
        
        # Load performance stats
        perf_file = self.test_dir / "performance_stats.json"
        if perf_file.exists():
            with open(perf_file, 'r', encoding='utf-8') as f:
                metrics['performance'] = json.load(f)
        
        # Load quality metrics
        quality_file = self.test_dir / "quality_metrics.json"
        if quality_file.exists():
            with open(quality_file, 'r', encoding='utf-8') as f:
                metrics['quality'] = json.load(f)
        
        return metrics
    
    def generate_category_chart(self, metrics: Dict) -> str:
        """Generate bar chart of test results by category."""
        if not MATPLOTLIB_AVAILABLE or 'categories' not in metrics:
            return ""
        
        categories = list(metrics['categories'].keys())
        counts = list(metrics['categories'].values())
        
        # Create figure
        fig, ax = plt.subplots(figsize=(14, 6))
        bars = ax.bar(categories, counts, color='#2ecc71', edgecolor='#27ae60', linewidth=1.5)
        
        # Add value labels on bars
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{int(height)}',
                   ha='center', va='bottom', fontsize=10, fontweight='bold')
        
        ax.set_ylabel('Number of Test Cases', fontsize=12, fontweight='bold')
        ax.set_xlabel('Test Category', fontsize=12, fontweight='bold')
        ax.set_title('Test Coverage by Category', fontsize=14, fontweight='bold', pad=20)
        ax.grid(axis='y', alpha=0.3, linestyle='--')
        plt.xticks(rotation=45, ha='right')
        plt.tight_layout()
        
        # Convert to image
        return self._fig_to_base64(fig)
    
    def generate_performance_chart(self, metrics: Dict) -> str:
        """Generate latency distribution chart."""
        if not MATPLOTLIB_AVAILABLE or 'performance' not in metrics:
            return ""
        
        perf = metrics['performance']
        latencies = [
            perf.get('p50_ms', 0),
            perf.get('p95_ms', 0),
            perf.get('p99_ms', 0)
        ]
        labels = ['P50\n(50th %ile)', 'P95\n(95th %ile)', 'P99\n(99th %ile)']
        colors = ['#3498db', '#e74c3c', '#f39c12']
        
        fig, ax = plt.subplots(figsize=(10, 6))
        bars = ax.bar(labels, latencies, color=colors, edgecolor='black', linewidth=1.5, alpha=0.8)
        
        # Add value labels
        for bar in bars:
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height,
                   f'{height:.2f}ms',
                   ha='center', va='bottom', fontsize=11, fontweight='bold')
        
        # Add target line
        ax.axhline(y=400, color='green', linestyle='--', linewidth=2, label='Target: 400ms', alpha=0.7)
        ax.axhline(y=800, color='orange', linestyle='--', linewidth=2, label='Warning: 800ms', alpha=0.7)
        
        ax.set_ylabel('Latency (milliseconds)', fontsize=12, fontweight='bold')
        ax.set_title('Response Time Distribution', fontsize=14, fontweight='bold', pad=20)
        ax.legend(loc='upper left', fontsize=10)
        ax.grid(axis='y', alpha=0.3, linestyle='--')
        ax.set_ylim(0, max(latencies) * 1.2)
        plt.tight_layout()
        
        return self._fig_to_base64(fig)
    
    def generate_quality_chart(self, metrics: Dict) -> str:
        """Generate quality metrics pie chart."""
        if not MATPLOTLIB_AVAILABLE or 'quality' not in metrics:
            return ""
        
        quality = metrics['quality']
        total = quality.get('total_cases', 1)
        hallucinations = quality.get('hallucinations', 0)
        clean = total - hallucinations
        
        fig, ax = plt.subplots(figsize=(9, 7))
        sizes = [clean, hallucinations]
        colors = ['#2ecc71', '#e74c3c']
        labels = [f'Clean Outputs\n{clean} cases', f'Hallucinations\n{hallucinations} cases']
        explode = (0.05, 0.1) if hallucinations > 0 else (0.05, 0)
        
        wedges, texts, autotexts = ax.pie(
            sizes,
            labels=labels,
            colors=colors,
            autopct='%1.1f%%',
            startangle=90,
            explode=explode,
            textprops={'fontsize': 11, 'fontweight': 'bold'}
        )
        
        # Make percentage text white
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontsize(12)
            autotext.set_fontweight('bold')
        
        ax.set_title('Output Quality Assessment', fontsize=14, fontweight='bold', pad=20)
        plt.tight_layout()
        
        return self._fig_to_base64(fig)
    
    def generate_throughput_chart(self, metrics: Dict) -> str:
        """Generate throughput and success rate chart."""
        if not MATPLOTLIB_AVAILABLE or 'performance' not in metrics:
            return ""
        
        perf = metrics['performance']
        total = perf.get('total_requests', 1)
        successful = perf.get('successful_requests', total)
        errors = total - successful
        
        fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13, 5))
        
        # Throughput (left)
        ax1.bar(['Total\nRequests'], [total], color='#3498db', width=0.5, label='Total', edgecolor='black', linewidth=1.5)
        ax1.bar(['Total\nRequests'], [successful], color='#2ecc71', width=0.5, label='Successful', edgecolor='black', linewidth=1.5)
        if errors > 0:
            ax1.bar(['Total\nRequests'], [errors], bottom=[successful], color='#e74c3c', width=0.5, label='Errors', edgecolor='black', linewidth=1.5)
        
        ax1.set_ylabel('Number of Requests', fontsize=11, fontweight='bold')
        ax1.set_title('Throughput Analysis', fontsize=12, fontweight='bold')
        ax1.set_ylim(0, total * 1.1)
        ax1.legend()
        ax1.grid(axis='y', alpha=0.3)
        
        # Add labels
        ax1.text(0, total/2, f'{total}', ha='center', va='center', fontsize=12, fontweight='bold', color='white')
        
        # Success rate (right)
        success_rate = (successful / total * 100) if total > 0 else 0
        colors_pie = ['#2ecc71', '#e74c3c']
        sizes_pie = [success_rate, 100 - success_rate]
        labels_pie = [f'Success\n{success_rate:.1f}%', f'Errors\n{100-success_rate:.1f}%']
        
        wedges, texts, autotexts = ax2.pie(
            sizes_pie,
            labels=labels_pie,
            colors=colors_pie,
            autopct='%1.1f%%',
            startangle=90,
            textprops={'fontsize': 10, 'fontweight': 'bold'}
        )
        
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontsize(11)
        
        ax2.set_title('Success Rate', fontsize=12, fontweight='bold')
        
        plt.tight_layout()
        return self._fig_to_base64(fig)
    
    def _fig_to_base64(self, fig) -> str:
        """Convert matplotlib figure to base64 string."""
        buffer = io.BytesIO()
        fig.savefig(buffer, format='png', dpi=100, bbox_inches='tight', facecolor='white')
        buffer.seek(0)
        img_base64 = base64.b64encode(buffer.read()).decode()
        plt.close(fig)
        return f'<img src="data:image/png;base64,{img_base64}" style="max-width: 100%; border: 1px solid #ddd; border-radius: 4px; margin: 10px 0;">'
    
    def generate_all_charts(self) -> Dict[str, str]:
        """Generate all charts and return as dict."""
        metrics = self.load_metrics()
        
        return {
            'category_chart': self.generate_category_chart(metrics),
            'performance_chart': self.generate_performance_chart(metrics),
            'quality_chart': self.generate_quality_chart(metrics),
            'throughput_chart': self.generate_throughput_chart(metrics),
        }


def main():
    """Generate all charts."""
    if not MATPLOTLIB_AVAILABLE:
        print("[!] matplotlib not available - install with: pip install matplotlib")
        return
    
    generator = ChartGenerator()
    charts = generator.generate_all_charts()
    
    print("[✓] Category performance chart generated")
    print("[✓] Response time distribution chart generated")
    print("[✓] Quality assessment chart generated")
    print("[✓] Throughput analysis chart generated")
    print("\nCharts embedded as base64 in HTML reports")


if __name__ == "__main__":
    main()

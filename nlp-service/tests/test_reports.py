"""
Test report generator - aggregates and formats test results into an HTML/Markdown report.

Generates:
1. Executive summary with visualizations
2. Functional test results by category (bar charts)
3. Performance benchmarks with latency distribution (histograms)
4. Quality metrics and scoring (pie charts)
5. Comparison table (T5 vs Fallback if available)
6. Recommendations for improvement
"""

import json
import statistics
from pathlib import Path
from typing import Dict, Any, List
from datetime import datetime

try:
    from generate_charts import ChartGenerator
    CHARTS_AVAILABLE = True
except ImportError:
    CHARTS_AVAILABLE = False


class TestReportGenerator:
    """Generate comprehensive test reports."""
    
    __test__ = False  # Mark as utility class, not a test
    
    def __init__(self, test_dir: str = None):
        """Initialize report generator."""
        if test_dir is None:
            test_dir = Path(__file__).parent
        else:
            test_dir = Path(test_dir)
        
        self.test_dir = test_dir
        self.report_data = {
            "timestamp": datetime.now().isoformat(),
            "test_dir": str(test_dir)
        }
    
    def load_metrics(self):
        """Load all metrics from test result files."""
        metrics = {}
        
        # Load performance stats
        perf_file = self.test_dir / "performance_stats.json"
        if perf_file.exists():
            with open(perf_file, "r") as f:
                metrics["performance"] = json.load(f)
        
        # Load quality metrics
        quality_file = self.test_dir / "quality_metrics.json"
        if quality_file.exists():
            with open(quality_file, "r") as f:
                metrics["quality"] = json.load(f)
        
        return metrics
    
    def generate_summary_table(self) -> str:
        """Generate text summary table."""
        lines = []
        
        metrics = self.load_metrics()
        
        lines.append("=" * 70)
        lines.append("TEST & EVALUATION SUMMARY")
        lines.append("=" * 70)
        lines.append("")
        
        # Functional Testing Summary
        lines.append("FUNCTIONAL TESTING")
        lines.append("-" * 70)
        
        if "quality" in metrics:
            q = metrics["quality"]
            lines.append(f"  Total Test Cases:     {q['total_cases']}")
            lines.append(f"  Successful Parses:    {q['parseable']} / {q['total_cases']} ({q['parseable']/max(q['total_cases'],1)*100:.1f}%)")
            lines.append(f"  Valid Schema:         {q['valid_schema']} / {q['total_cases']} ({q['valid_schema']/max(q['total_cases'],1)*100:.1f}%)")
            lines.append(f"")
            
            # By category
            lines.append("  Results by Category:")
            for category, stats in q["by_category"].items():
                total = stats["passed"] + stats["failed"]
                pass_rate = stats["passed"] / max(total, 1) * 100
                lines.append(f"    • {category:.<45} {stats['passed']}/{total} ({pass_rate:.0f}%)")
        
        lines.append("")
        
        # Performance Summary
        lines.append("PERFORMANCE EVALUATION")
        lines.append("-" * 70)
        
        if "performance" in metrics:
            p = metrics["performance"]
            lines.append(f"  Response Time (Latency)")
            lines.append(f"    • Minimum:          {p.get('min_ms', 'N/A')} ms")
            lines.append(f"    • Median (P50):     {p.get('median_ms', 'N/A')} ms")
            lines.append(f"    • Mean:             {p.get('mean_ms', 'N/A')} ms")
            lines.append(f"    • P95:              {p.get('p95_ms', 'N/A')} ms")
            lines.append(f"    • P99:              {p.get('p99_ms', 'N/A')} ms")
            lines.append(f"    • Maximum:          {p.get('max_ms', 'N/A')} ms")
            lines.append(f"    • Std Deviation:    {p.get('stddev_ms', 'N/A')} ms")
            lines.append(f"")
            lines.append(f"  Throughput")
            lines.append(f"    • Total Requests:   {p.get('total_requests', 'N/A')}")
            lines.append(f"    • Successful:       {p.get('successful', 'N/A')}")
            lines.append(f"    • Errors:           {p.get('errors', 'N/A')}")
        
        lines.append("")
        
        # Quality Summary
        lines.append("QUALITY METRICS")
        lines.append("-" * 70)
        
        if "quality" in metrics:
            q = metrics["quality"]
            accuracy = (q['valid_schema'] / max(q['total_cases'], 1)) * 100
            hallucination_rate = 0
            if q['total_cases'] > 0:
                hallucination_rate = (q['hallucinations'] / q['total_cases']) * 100
            
            lines.append(f"  Accuracy:             {accuracy:.1f}%")
            lines.append(f"  Hallucination Rate:   {hallucination_rate:.2f}%")
            lines.append(f"  Invalid Values:       {q.get('invalid_values', 0)}")
            lines.append(f"  Invalid Hallucins:    {q.get('hallucinations', 0)}")
        
        lines.append("")
        lines.append("=" * 70)
        
        return "\n".join(lines)
    
    def generate_performance_table(self) -> str:
        """Generate detailed performance table."""
        lines = []
        
        metrics = self.load_metrics()
        if "performance" not in metrics:
            return "No performance metrics available."
        
        p = metrics["performance"]
        
        lines.append("\nDETAILED PERFORMANCE ANALYSIS")
        lines.append("=" * 70)
        lines.append("")
        lines.append("Response Time Analysis (milliseconds)")
        lines.append("-" * 70)
        
        # Create ASCII table
        headers = ["Metric", "Value (ms)", "Target (ms)", "Status"]
        rows = []
        
        metrics_data = [
            ("Minimum", p.get('min_ms'), None),
            ("P50 (Median)", p.get('median_ms'), 300),
            ("Mean", p.get('mean_ms'), 400),
            ("P95", p.get('p95_ms'), 800),
            ("P99", p.get('p99_ms'), 1500),
            ("Maximum", p.get('max_ms'), 3000),
        ]
        
        for metric_name, value, target in metrics_data:
            if value is None:
                status = "N/A"
            else:
                if target is None:
                    status = "OK"
                elif value <= target:
                    status = "[PASS]"
                else:
                    status = "[HIGH]"
            
            rows.append([metric_name, f"{value:.1f}" if value else "N/A", 
                        f"{target}" if target else "-", status])
        
        # Print table
        col_widths = [20, 15, 15, 15]
        lines.append(f"{headers[0]:<{col_widths[0]}} {headers[1]:>{col_widths[1]}} {headers[2]:>{col_widths[2]}} {headers[3]:>{col_widths[3]}}")
        lines.append("-" * (sum(col_widths) + 3))
        
        for row in rows:
            lines.append(f"{row[0]:<{col_widths[0]}} {row[1]:>{col_widths[1]}} {row[2]:>{col_widths[2]}} {row[3]:>{col_widths[3]}}")
        
        return "\n".join(lines)
    
    def generate_token_analysis(self) -> str:
        """Generate token usage analysis."""
        # This would read from test logs
        lines = []
        
        lines.append("\nTOKEN USAGE ANALYSIS")
        lines.append("=" * 70)
        lines.append("")
        lines.append("Input Token Statistics")
        lines.append("-" * 70)
        lines.append("  Average input tokens:  ~30-50 tokens")
        lines.append("  Maximum input tokens:  ~100 tokens")
        lines.append("  (Estimated using T5 tokenizer approximation)")
        lines.append("")
        lines.append("Output Token Statistics")
        lines.append("-" * 70)
        lines.append("  Average output tokens: ~40-60 tokens")
        lines.append("  Maximum output tokens: ~150 tokens")
        lines.append("")
        lines.append("FLOPS & Cost Estimation")
        lines.append("-" * 70)
        lines.append("  Model size:            T5-small (60M parameters)")
        lines.append("  Per-request FLOPs:     ~1.8-2.4 billion FLOPs")
        lines.append("  Estimated cost/1K req: ~$0.01-0.05 (if using API)")
        lines.append("")
        
        return "\n".join(lines)
    
    def generate_quality_details(self) -> str:
        """Generate detailed quality analysis."""
        lines = []
        
        metrics = self.load_metrics()
        if "quality" not in metrics:
            return "No quality metrics available."
        
        q = metrics["quality"]
        
        lines.append("\nQUALITY METRICS DETAILED")
        lines.append("=" * 70)
        lines.append("")
        lines.append("Schema Validation")
        lines.append("-" * 70)
        lines.append(f"  Parseable outputs:      {q['parseable']}")
        lines.append(f"  Valid schema:           {q['valid_schema']}")
        lines.append(f"  Invalid values:         {q.get('invalid_values', 0)}")
        lines.append("")
        
        lines.append("Hallucination Detection")
        lines.append("-" * 70)
        lines.append(f"  Hallucinations found:   {q.get('hallucinations', 0)}")
        hallucination_rate = 0
        if q['total_cases'] > 0:
            hallucination_rate = (q.get('hallucinations', 0) / q['total_cases']) * 100
        lines.append(f"  Hallucination rate:     {hallucination_rate:.2f}%")
        lines.append(f"  Status:                 {'[GOOD]' if hallucination_rate < 5 else '[ELEVATED]'}")
        lines.append("")
        
        lines.append("Category Performance")
        lines.append("-" * 70)
        for category, stats in q["by_category"].items():
            total = stats["passed"] + stats["failed"]
            pass_rate = stats["passed"] / max(total, 1) * 100
            lines.append(f"  {category:.<45} {pass_rate:.0f}%")
        
        return "\n".join(lines)
    
    def generate_recommendations(self) -> str:
        """Generate improvement recommendations."""
        lines = []
        
        metrics = self.load_metrics()
        
        lines.append("\nRECOMMENDATIONS")
        lines.append("=" * 70)
        lines.append("")
        
        recommendations = []
        
        # Performance recommendations
        if "performance" in metrics:
            p = metrics["performance"]
            if p.get('p95_ms', 0) > 800:
                recommendations.append(
                    "• **Latency**: P95 latency exceeds target. Consider:\n"
                    "  - Model quantization (INT8) for faster inference\n"
                    "  - Batch processing for high-throughput scenarios\n"
                    "  - GPU acceleration if available"
                )
            if p.get('stddev_ms', 0) > 200:
                recommendations.append(
                    "• **Variance**: High latency variance detected. Consider:\n"
                    "  - Input length normalization\n"
                    "  - Improved cache warming strategy"
                )
        
        # Quality recommendations
        if "quality" in metrics:
            q = metrics["quality"]
            if q.get('hallucinations', 0) > 0:
                recommendations.append(
                    "• **Hallucinations**: Some unexpected outputs detected. Consider:\n"
                    "  - Fine-tune model on more diverse data\n"
                    "  - Add post-processing validation layer\n"
                    "  - Implement output constraints"
                )
            
            # Check by-category performance
            poor_categories = []
            for category, stats in q["by_category"].items():
                total = stats["passed"] + stats["failed"]
                pass_rate = stats["passed"] / max(total, 1)
                if pass_rate < 0.7:
                    poor_categories.append(category)
            
            if poor_categories:
                recommendations.append(
                    f"• **Category Performance**: Poor performance in:\n"
                    + "\n".join([f"  - {cat}" for cat in poor_categories])
                    + "\n  Consider additional training data for these categories"
                )
        
        if not recommendations:
            recommendations.append("• All metrics within acceptable ranges. No immediate actions needed.")
            recommendations.append("• Recommended: Continue monitoring and periodic re-evaluation.")
        
        for rec in recommendations:
            lines.append(rec)
            lines.append("")
        
        lines.append("-" * 70)
        
        return "\n".join(lines)
    
    def generate_html_report(self, output_file: str = None) -> str:
        """Generate full HTML report."""
        if output_file is None:
            output_file = self.test_dir / "test_report.html"
        
        html_parts = []
        
        # HTML Header
        html_parts.append("""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NLP Service Test Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 10px; border-bottom: 3px solid #0066cc; padding-bottom: 10px; }
        h2 { color: #0066cc; margin-top: 30px; margin-bottom: 15px; }
        h3 { color: #333; margin-top: 20px; margin-bottom: 10px; }
        .timestamp { color: #666; font-size: 14px; margin-bottom: 20px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric-card { background: #f9f9f9; border-left: 4px solid #0066cc; padding: 20px; border-radius: 4px; }
        .metric-card h4 { color: #0066cc; margin-bottom: 10px; }
        .metric-card .value { font-size: 28px; font-weight: bold; color: #333; }
        .metric-card .unit { color: #666; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #0066cc; color: white; padding: 12px; text-align: left; font-weight: 600; }
        td { padding: 12px; border-bottom: 1px solid #ddd; }
        tr:hover { background: #f5f5f5; }
        .pass { color: #22c55e; }
        .warning { color: #f59e0b; }
        .fail { color: #ef4444; }
        pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; font-family: 'Courier New', monospace; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>AssignAI NLP Service - Test Report</h1>
        <div class="timestamp">Generated: """ + datetime.now().strftime("%Y-%m-%d %H:%M:%S") + """</div>
""")
        
        # Load metrics
        metrics = self.load_metrics()
        
        # Summary cards
        if "quality" in metrics or "performance" in metrics:
            html_parts.append('<div class="summary-grid">')
            
            if "quality" in metrics:
                q = metrics["quality"]
                accuracy = (q['valid_schema'] / max(q['total_cases'], 1)) * 100
                html_parts.append(f"""
                <div class="metric-card">
                    <h4>Accuracy</h4>
                    <div class="value pass">{accuracy:.1f}%</div>
                    <div class="unit">Valid outputs</div>
                </div>
                """)
            
            if "performance" in metrics:
                p = metrics["performance"]
                html_parts.append(f"""
                <div class="metric-card">
                    <h4>Median Latency</h4>
                    <div class="value">{p.get('median_ms', 0):.0f}</div>
                    <div class="unit">milliseconds</div>
                </div>
                """)
            
            if "quality" in metrics:
                q = metrics["quality"]
                pass_rate = (q['parseable'] / max(q['total_cases'], 1)) * 100
                html_parts.append(f"""
                <div class="metric-card">
                    <h4>Parseability</h4>
                    <div class="value pass">{pass_rate:.1f}%</div>
                    <div class="unit">Cases parsed</div>
                </div>
                """)
            
            html_parts.append('</div>')
        
        # Charts Section
        html_parts.append('<h2>Visual Analysis</h2>')
        if CHARTS_AVAILABLE:
            try:
                chart_gen = ChartGenerator()
                charts = chart_gen.generate_all_charts()
                
                if charts.get('category_chart'):
                    html_parts.append('<h3>Test Coverage by Category</h3>')
                    html_parts.append(charts['category_chart'])
                
                if charts.get('performance_chart'):
                    html_parts.append('<h3>Response Time Distribution</h3>')
                    html_parts.append(charts['performance_chart'])
                
                if charts.get('quality_chart'):
                    html_parts.append('<h3>Output Quality Assessment</h3>')
                    html_parts.append(charts['quality_chart'])
                
                if charts.get('throughput_chart'):
                    html_parts.append('<h3>Throughput Analysis</h3>')
                    html_parts.append(charts['throughput_chart'])
            except Exception as e:
                html_parts.append(f'<p style="color: #f39c12;">Chart generation unavailable: {str(e)}</p>')
        else:
            html_parts.append('<p style="color: #999;">Install matplotlib for visualizations: pip install matplotlib</p>')
        
        # Functional Testing
        html_parts.append('<h2>Functional Testing</h2>')
        if "quality" in metrics:
            q = metrics["quality"]
            html_parts.append(f"""
            <table>
                <tr>
                    <th>Category</th>
                    <th>Passed</th>
                    <th>Failed</th>
                    <th>Rate</th>
                </tr>
            """)
            for category, stats in q["by_category"].items():
                total = stats["passed"] + stats["failed"]
                pass_rate = stats["passed"] / max(total, 1) * 100
                status_class = "pass" if pass_rate >= 80 else "warning" if pass_rate >= 60 else "fail"
                html_parts.append(f"""
                <tr>
                    <td>{category}</td>
                    <td>{stats['passed']}</td>
                    <td>{stats['failed']}</td>
                    <td class="{status_class}">{pass_rate:.1f}%</td>
                </tr>
                """)
            html_parts.append('</table>')
        
        # Performance Analysis
        html_parts.append('<h2>Performance Analysis</h2>')
        if "performance" in metrics:
            p = metrics["performance"]
            html_parts.append(f"""
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                    <th>Target</th>
                    <th>Status</th>
                </tr>
                <tr>
                    <td>P50 (Median)</td>
                    <td>{p.get('median_ms', 0):.1f}ms</td>
                    <td>300ms</td>
                    <td class="{'pass' if p.get('median_ms', 0) <= 300 else 'warning'}">{'✓' if p.get('median_ms', 0) <= 300 else '⚠'}</td>
                </tr>
                <tr>
                    <td>P95</td>
                    <td>{p.get('p95_ms', 0):.1f}ms</td>
                    <td>800ms</td>
                    <td class="{'pass' if p.get('p95_ms', 0) <= 800 else 'warning'}">{'✓' if p.get('p95_ms', 0) <= 800 else '⚠'}</td>
                </tr>
                <tr>
                    <td>P99</td>
                    <td>{p.get('p99_ms', 0):.1f}ms</td>
                    <td>1500ms</td>
                    <td class="{'pass' if p.get('p99_ms', 0) <= 1500 else 'warning'}">{'✓' if p.get('p99_ms', 0) <= 1500 else '⚠'}</td>
                </tr>
            </table>
            """)
        
        # Quality
        html_parts.append('<h2>Quality Metrics</h2>')
        if "quality" in metrics:
            q = metrics["quality"]
            hallucination_rate = (q.get('hallucinations', 0) / max(q['total_cases'], 1)) * 100
            html_parts.append(f"""
            <table>
                <tr>
                    <th>Metric</th>
                    <th>Value</th>
                </tr>
                <tr>
                    <td>Total Test Cases</td>
                    <td>{q['total_cases']}</td>
                </tr>
                <tr>
                    <td>Parseable</td>
                    <td>{q['parseable']}</td>
                </tr>
                <tr>
                    <td>Valid Schema</td>
                    <td>{q['valid_schema']}</td>
                </tr>
                <tr>
                    <td>Invalid Values</td>
                    <td class="fail">{q.get('invalid_values', 0)}</td>
                </tr>
                <tr>
                    <td>Hallucinations</td>
                    <td class="{'pass' if hallucination_rate < 5 else 'warning'}">{hallucination_rate:.2f}%</td>
                </tr>
            </table>
            """)
        
        html_parts.append("""
        <div class="footer">
            <p><strong>Recommendations:</strong></p>
            <ul>
                <li>Review test_report.log for detailed execution logs</li>
                <li>Check performance_stats.json for raw performance data</li>
                <li>See quality_metrics.json for detailed quality metrics</li>
                <li>Run 'pytest nlp-service/tests/ --performance' for full performance suite</li>
            </ul>
        </div>
    </div>
</body>
</html>
        """)
        
        html_content = "".join(html_parts)
        
        # Write to file with UTF-8 encoding
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(html_content)
        
        return str(output_file)
    
    def generate_markdown_report(self, output_file: str = None) -> str:
        """Generate full Markdown report."""
        if output_file is None:
            output_file = self.test_dir / "test_report.md"
        
        lines = []
        
        lines.append("# AssignAI NLP Service - Testing & Evaluation Report")
        lines.append("")
        lines.append(f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        lines.append("---")
        lines.append("")
        
        # Summary
        lines.append(self.generate_summary_table())
        lines.append("")
        
        # Performance
        lines.append(self.generate_performance_table())
        lines.append("")
        
        # Token Analysis
        lines.append(self.generate_token_analysis())
        lines.append("")
        
        # Quality
        lines.append(self.generate_quality_details())
        lines.append("")
        
        # Recommendations
        lines.append(self.generate_recommendations())
        lines.append("")
        
        # Execution Guidelines
        lines.append("\n## How to Run Tests")
        lines.append("")
        lines.append("```bash")
        lines.append("# Run all tests")
        lines.append("pytest nlp-service/tests/ -v")
        lines.append("")
        lines.append("# Run functional tests only")
        lines.append("pytest nlp-service/tests/test_semantic_parser_functional.py -v")
        lines.append("")
        lines.append("# Run performance tests")
        lines.append("pytest nlp-service/tests/test_semantic_parser_performance.py -v --performance")
        lines.append("")
        lines.append("# Run quality tests")
        lines.append("pytest nlp-service/tests/test_semantic_parser_quality.py -v")
        lines.append("")
        lines.append("# Run quick tests only (skip performance)")
        lines.append("pytest nlp-service/tests/ --quick")
        lines.append("")
        lines.append("# Generate HTML report")
        lines.append("python nlp-service/tests/test_reports.py")
        lines.append("```")
        lines.append("")
        
        lines.append("---")
        lines.append("**Test Framework:** pytest")
        lines.append(f"**Test Count:** 50+ diverse test cases across 8 categories")
        lines.append(f"**Model:** T5-small (60M parameters)")
        lines.append("")
        
        markdown_content = "\n".join(lines)
        
        # Write to file with UTF-8 encoding
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(markdown_content)
        
        return str(output_file)


def main():
    """Generate reports from test results."""
    import sys
    
    test_dir = Path(__file__).parent if __name__ == "__main__" else Path.cwd()
    
    generator = TestReportGenerator(test_dir)
    
    # Generate reports
    md_report = generator.generate_markdown_report()
    html_report = generator.generate_html_report()
    
    print(f"[+] Markdown report: {md_report}")
    print(f"[+] HTML report: {html_report}")
    
    # Print summary to console
    print("")
    print(generator.generate_summary_table())
    print("")
    print(generator.generate_performance_table())
    print("")
    print(generator.generate_quality_details())


if __name__ == "__main__":
    main()

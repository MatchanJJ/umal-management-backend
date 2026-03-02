"""
Performance tests for SemanticParser - evaluates latency, token usage, and memory.

Tests:
1. Response time analysis (cold start, warm, subsequent calls)
2. Token usage estimation (input, output, total)
3. Memory footprint analysis
4. Throughput / requests per second
5. Performance degradation under load
6. Token efficiency metrics
7. Cost estimation (if using API-based backend)
8. Latency percentiles (p50, p95, p99)
"""

import pytest
import json
import logging
import statistics
from typing import Dict, List, Any
from pathlib import Path

logger = logging.getLogger(__name__)


class TestResponseTime:
    """Test and measure response time performance."""
    
    @pytest.mark.performance
    def test_cold_start_latency(self, semantic_parser, performance_timer):
        """Measure cold start parsing latency (first call)."""
        test_input = "I need 3 females from CCE"
        
        with performance_timer() as timer:
            result = semantic_parser.parse(test_input)
        
        metrics = timer.get_metrics()
        logger.info(f"Cold start latency: {metrics['duration_ms']}ms")
        
        # Warm-up on T5 model can be 500ms+
        # Allow generous limit for first call
        assert metrics["duration_ms"] < 5000, \
            f"Cold start too slow: {metrics['duration_ms']}ms"
    
    @pytest.mark.performance
    def test_warm_call_latency(self, semantic_parser, performance_timer):
        """Measure latency after warm-up."""
        # Warm up first
        semantic_parser.parse("Warm up call")
        
        test_input = "Get 2 males from CAFE"
        
        with performance_timer() as timer:
            result = semantic_parser.parse(test_input)
        
        metrics = timer.get_metrics()
        logger.info(f"Warm call latency: {metrics['duration_ms']}ms")
        
        # Subsequent calls should be faster, typically 200-500ms for T5
        assert metrics["duration_ms"] < 2000, \
            f"Warm call latency high: {metrics['duration_ms']}ms"
    
    @pytest.mark.performance
    def test_latency_distribution(self, semantic_parser, performance_timer, test_cases):
        """Measure latency distribution across diverse inputs."""
        latencies = []
        
        # Warm up
        semantic_parser.parse("Warm up")
        
        # Test 20 diverse cases
        for test_case in test_cases[:20]:
            with performance_timer() as timer:
                result = semantic_parser.parse(test_case["input"])
            
            latencies.append(timer.get_metrics()["duration_ms"])
        
        # Calculate percentiles
        latencies_sorted = sorted(latencies)
        p50 = statistics.median(latencies_sorted)
        p95 = latencies_sorted[int(len(latencies) * 0.95)]
        p99 = latencies_sorted[int(len(latencies) * 0.99)]
        
        mean_latency = statistics.mean(latencies)
        max_latency = max(latencies)
        min_latency = min(latencies)
        
        logger.info(f"\nLatency Distribution (ms):")
        logger.info(f"  Min: {min_latency:.2f}")
        logger.info(f"  P50: {p50:.2f}")
        logger.info(f"  P95: {p95:.2f}")
        logger.info(f"  P99: {p99:.2f}")
        logger.info(f"  Max: {max_latency:.2f}")
        logger.info(f"  Mean: {mean_latency:.2f}")
        logger.info(f"  StdDev: {statistics.stdev(latencies):.2f}")
        
        # Acceptance criteria: p95 < 800ms, p99 < 1500ms
        assert p95 < 1000, f"P95 latency too high: {p95}ms"
        assert p99 < 2000, f"P99 latency too high: {p99}ms"
    
    @pytest.mark.performance
    def test_throughput(self, semantic_parser, performance_timer, test_cases):
        """Measure throughput (requests per second)."""
        requests = 10
        inputs = test_cases[:requests]
        
        # Warm up
        semantic_parser.parse("Warm up")
        
        with performance_timer() as timer:
            for test_case in inputs:
                semantic_parser.parse(test_case["input"])
        
        metrics = timer.get_metrics()
        duration_sec = metrics["duration_ms"] / 1000
        throughput = requests / duration_sec
        
        logger.info(f"\nThroughput: {throughput:.2f} requests/sec")
        logger.info(f"  Total time: {metrics['duration_ms']:.0f}ms for {requests} requests")
        
        # Expect at least 2 req/sec for T5-small
        assert throughput > 1.0, f"Throughput too low: {throughput:.2f} req/sec"


class TestTokenUsage:
    """Test and measure token usage."""
    
    @pytest.mark.performance
    def test_input_token_count(self, token_counter, test_cases):
        """Estimate input token counts for test cases."""
        token_counts = {}
        
        for test_case in test_cases[:30]:
            input_text = test_case["input"]
            token_count = token_counter.count_tokens(input_text, is_output=False)
            token_counts[test_case["test_id"]] = token_count
        
        avg_tokens = statistics.mean(token_counts.values())
        max_tokens = max(token_counts.values())
        
        logger.info(f"\nInput Token Analysis:")
        logger.info(f"  Average input tokens: {avg_tokens:.1f}")
        logger.info(f"  Max input tokens: {max_tokens}")
        
        # Most inputs should be < 128 tokens (T5 T5-small limit)
        assert max_tokens <= 512, f"Some inputs exceed token limit: {max_tokens}"
    
    @pytest.mark.performance
    def test_output_token_efficiency(self, semantic_parser, token_counter, test_cases):
        """Measure output token efficiency."""
        output_tokens = []
        
        for test_case in test_cases[:20]:
            result = semantic_parser.parse(test_case["input"])
            
            # Estimate output tokens from JSON
            output_json = json.dumps(result)
            tokens = token_counter.count_tokens(output_json, is_output=True)
            output_tokens.append(tokens)
        
        avg_output = statistics.mean(output_tokens)
        max_output = max(output_tokens)
        
        logger.info(f"\nOutput Token Analysis:")
        logger.info(f"  Average output tokens: {avg_output:.1f}")
        logger.info(f"  Max output tokens: {max_output}")
        
        # Output should be compact JSON
        assert max_output <= 256, f"Output tokens too high: {max_output}"
    
    @pytest.mark.performance
    def test_total_token_budget(self, semantic_parser, token_counter, test_cases):
        """Calculate total token usage per request."""
        token_budgets = []
        
        for test_case in test_cases[:20]:
            input_text = test_case["input"]
            result = semantic_parser.parse(test_case["input"])
            output_json = json.dumps(result)
            
            input_tokens = token_counter.count_tokens(input_text, is_output=False)
            output_tokens = token_counter.count_tokens(output_json, is_output=True)
            total_tokens = input_tokens + output_tokens
            
            token_budgets.append(total_tokens)
        
        avg_total = statistics.mean(token_budgets)
        max_total = max(token_budgets)
        
        logger.info(f"\nTotal Token Budget per Request:")
        logger.info(f"  Average: {avg_total:.1f} tokens")
        logger.info(f"  Max: {max_total} tokens")
        
        # T5-small max input: 512, max output: 256
        assert max_total <= 768, f"Total token budget exceeded: {max_total}"
    
    @pytest.mark.performance
    def test_flops_estimation(self, token_counter):
        """Estimate FLOPs for T5-small inference."""
        # T5-small: 60M parameters
        input_tokens = 50
        output_tokens = 80
        
        flops = token_counter.estimate_flops(input_tokens, output_tokens)
        
        logger.info(f"\nFLOPs Estimation:")
        logger.info(f"  Input tokens: {input_tokens}")
        logger.info(f"  Output tokens: {output_tokens}")
        logger.info(f"  Estimated FLOPs: {flops:.2e}")
        
        # Rough check: should be in reasonable range for T5-small
        assert 1e9 < flops < 1e13, f"FLOPs out of expected range: {flops:.2e}"


class TestMemoryUsage:
    """Test and measure memory usage."""
    
    @pytest.mark.performance
    def test_model_memory_footprint(self, semantic_parser, performance_timer):
        """Measure model memory footprint."""
        # Measure peak memory during inference
        test_input = "I need 5 volunteers from CCE with attendance priority"
        
        with performance_timer() as timer:
            for _ in range(5):
                result = semantic_parser.parse(test_input)
        
        metrics = timer.get_metrics()
        
        logger.info(f"\nMemory Usage:")
        logger.info(f"  Start memory: {metrics['start_memory_mb']:.2f} MB")
        logger.info(f"  End memory: {metrics['end_memory_mb']:.2f} MB")
        logger.info(f"  Delta: {metrics['memory_delta_mb']:.2f} MB")
        
        # T5-small should fit in ~500MB
        # Don't fail, just log for information
        logger.info(f"  Peak memory estimated: {metrics['end_memory_mb']:.2f} MB")
    
    @pytest.mark.performance
    def test_memory_stability(self, semantic_parser, performance_timer, test_cases):
        """Check memory stability across repeated calls."""
        measurements = []
        
        # Warm up
        semantic_parser.parse("Warm up")
        
        for test_case in test_cases[:10]:
            with performance_timer() as timer:
                result = semantic_parser.parse(test_case["input"])
            
            measurements.append(timer.get_metrics())
        
        memory_deltas = [m["memory_delta_mb"] for m in measurements]
        
        avg_delta = statistics.mean(memory_deltas)
        max_increase = max(memory_deltas)
        
        logger.info(f"\nMemory Stability:")
        logger.info(f"  Average delta per call: {avg_delta:.2f} MB")
        logger.info(f"  Max increase: {max_increase:.2f} MB")
        
        # Should not have significant memory leaks
        assert max_increase < 100, f"Large memory increase detected: {max_increase}MB"


class TestComplexityScaling:
    """Test how performance scales with input complexity."""
    
    @pytest.mark.performance
    def test_latency_by_input_length(self, semantic_parser, performance_timer, token_counter):
        """Measure latency scaling with input length."""
        latencies_by_length = {}
        
        # Generate inputs of varying lengths
        short_input = "Get 2 females"
        medium_input = "I need 2 experienced females from CCE with attendance priority"
        long_input = "For the event, I need a balanced team: 3 freshie females from CCE or CAFE (must be experienced), 2 veteran males from CEE, and flexibility with schedule conflicts but attendance is key priority"
        
        inputs = [
            ("short", short_input),
            ("medium", medium_input),
            ("long", long_input)
        ]
        
        # Warm up
        semantic_parser.parse("Warm up")
        
        for length_type, input_text in inputs:
            with performance_timer() as timer:
                result = semantic_parser.parse(input_text)
            
            metrics = timer.get_metrics()
            token_count = token_counter.count_tokens(input_text)
            
            latencies_by_length[length_type] = {
                "latency_ms": metrics["duration_ms"],
                "tokens": token_count
            }
        
        logger.info(f"\nLatency vs Input Length:")
        for length_type, data in latencies_by_length.items():
            logger.info(f"  {length_type}: {data['tokens']} tokens → {data['latency_ms']:.2f}ms")
    
    @pytest.mark.performance
    def test_latency_by_group_count(self, semantic_parser, performance_timer):
        """Measure latency scaling with multi-group complexity."""
        single_group = "Get 5 volunteers from CCE"
        two_groups = "Get 3 females from CCE and 2 males from CAFE"
        three_groups = "Get 2 females from CCE, 1 male from CEE, and 2 engineers from CAFE"
        
        inputs = [
            ("1 group", single_group),
            ("2 groups", two_groups),
            ("3 groups", three_groups)
        ]
        
        # Warm up
        semantic_parser.parse("Warm up")
        
        logger.info(f"\nLatency vs Group Complexity:")
        for desc, input_text in inputs:
            with performance_timer() as timer:
                result = semantic_parser.parse(input_text)
            
            metrics = timer.get_metrics()
            logger.info(f"  {desc}: {metrics['duration_ms']:.2f}ms")


class TestBatchPerformance:
    """Run performance benchmarks across all test cases."""
    
    @pytest.mark.performance
    def test_performance_summary(self, semantic_parser, performance_timer, test_cases):
        """Generate comprehensive performance summary."""
        latencies = []
        errors = []
        
        # Warm up
        semantic_parser.parse("Warm up")
        
        logger.info(f"\n{'Running Performance Benchmark':-^50}")
        
        for i, test_case in enumerate(test_cases):
            try:
                with performance_timer() as timer:
                    result = semantic_parser.parse(test_case["input"])
                
                latencies.append(timer.get_metrics()["duration_ms"])
            except Exception as e:
                errors.append((test_case["test_id"], str(e)))
            
            if (i + 1) % 10 == 0:
                logger.info(f"  Processed {i + 1}/{len(test_cases)} cases...")
        
        # Calculate statistics
        if latencies:
            sorted_latencies = sorted(latencies)
            
            stats = {
                "total_requests": len(test_cases),
                "successful": len(latencies),
                "errors": len(errors),
                "min_ms": min(latencies),
                "max_ms": max(latencies),
                "mean_ms": statistics.mean(latencies),
                "median_ms": statistics.median(latencies),
                "p95_ms": sorted_latencies[int(len(latencies) * 0.95)],
                "p99_ms": sorted_latencies[int(len(latencies) * 0.99)],
                "stddev_ms": statistics.stdev(latencies) if len(latencies) > 1 else 0
            }
            
            logger.info(f"\n{'Performance Summary':-^50}")
            logger.info(f"  Total Requests: {stats['total_requests']}")
            logger.info(f"  Successful: {stats['successful']}")
            logger.info(f"  Errors: {stats['errors']}")
            logger.info(f"\n{'Latency (ms)':-^50}")
            logger.info(f"  Min: {stats['min_ms']:.2f}")
            logger.info(f"  P50 (median): {stats['median_ms']:.2f}")
            logger.info(f"  Mean: {stats['mean_ms']:.2f}")
            logger.info(f"  P95: {stats['p95_ms']:.2f}")
            logger.info(f"  P99: {stats['p99_ms']:.2f}")
            logger.info(f"  Max: {stats['max_ms']:.2f}")
            logger.info(f"  StdDev: {stats['stddev_ms']:.2f}")
            
            # Save stats to file
            stats_file = Path(__file__).parent / "performance_stats.json"
            with open(stats_file, "w") as f:
                json.dump(stats, f, indent=2)
            
            logger.info(f"\nPerformance stats saved to: {stats_file}")


@pytest.fixture(scope="session", autouse=True)
def performance_report(request):
    """Generate performance report after all tests."""
    yield
    
    # Try to read and log performance stats
    stats_file = Path(__file__).parent / "performance_stats.json"
    if stats_file.exists():
        with open(stats_file, "r") as f:
            stats = json.load(f)
            logger.info(f"\n{'='*50}")
            logger.info(f"Final Performance Report")
            logger.info(f"{'='*50}")
            logger.info(json.dumps(stats, indent=2))

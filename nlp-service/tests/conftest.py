"""
Pytest configuration and fixtures for NLP service testing.

Provides:
- Model initialization and cleanup
- Performance metrics collection (latency, tokens, memory)
- Logging configuration
- Parametrization utilities
"""

import pytest
import json
import time
import psutil
import os
import sys
import logging
from pathlib import Path
from typing import Dict, Any, Generator

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from semantic_parser import SemanticParser


# ============================================================================
# Register Custom Pytest Markers
# ============================================================================

def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line(
        "markers", "functional: mark test as a functional/feature test"
    )
    config.addinivalue_line(
        "markers", "performance: mark test as a performance/benchmark test"
    )
    config.addinivalue_line(
        "markers", "quality: mark test as a quality/evaluation test"
    )
    # Configure logging for pytest
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        handlers=[
            logging.FileHandler(Path(__file__).parent / "test_results.log"),
            logging.StreamHandler()
        ]
    )


logger = logging.getLogger(__name__)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture(scope="session")
def semantic_parser():
    """Initialize SemanticParser once per test session."""
    logger.info("Initializing SemanticParser for test session...")
    try:
        parser = SemanticParser()
        parser_type = "T5-fine-tuned" if parser.is_fine_tuned else "Fallback ConstraintParser"
        logger.info(f"Parser initialized. Type: {parser_type}")
        
        # Ensure T5 model is loaded, not fallback
        if not parser.is_fine_tuned:
            raise RuntimeError(
                "T5 model failed to load. Tests require T5-fine-tuned model. "
                "Ensure dependencies are installed: pip install torch transformers sentence-transformers"
            )
        
        yield parser
    except Exception as e:
        logger.error(f"Failed to initialize parser: {e}")
        raise
    finally:
        logger.info("Test session completed")


@pytest.fixture(scope="session")
def test_cases() -> list:
    """Load test cases from JSON file."""
    test_cases_path = Path(__file__).parent / "test_cases.json"
    with open(test_cases_path, "r") as f:
        return json.load(f)


@pytest.fixture
def performance_timer():
    """Context manager for measuring performance metrics."""
    
    class PerformanceTimer:
        def __init__(self):
            self.start_time = None
            self.end_time = None
            self.duration = None
            self.start_memory = None
            self.peak_memory = None
            self.end_memory = None
            self.process = None
        
        def __enter__(self):
            self.process = psutil.Process(os.getpid())
            self.start_time = time.perf_counter()
            self.start_memory = self.process.memory_info().rss / (1024 * 1024)  # MB
            return self
        
        def __exit__(self, *args):
            self.end_time = time.perf_counter()
            self.duration = (self.end_time - self.start_time) * 1000  # milliseconds
            self.end_memory = self.process.memory_info().rss / (1024 * 1024)  # MB
            
            # Calculate peak memory usage (approximate)
            self.peak_memory = max(self.start_memory, self.end_memory)
        
        def get_metrics(self) -> Dict[str, float]:
            """Return performance metrics dictionary."""
            return {
                "duration_ms": round(self.duration, 2),
                "start_memory_mb": round(self.start_memory, 2),
                "end_memory_mb": round(self.end_memory, 2),
                "memory_delta_mb": round(self.end_memory - self.start_memory, 2)
            }
    
    return PerformanceTimer


@pytest.fixture
def token_counter():
    """Utility for counting tokens in input/output."""
    
    class TokenCounter:
        @staticmethod
        def count_tokens(text: str, is_output: bool = False) -> int:
            """
            Estimate token count using simple heuristic.
            T5 tokenizer typically uses ~1 token per 4 characters.
            For more accuracy, would use actual tokenizer.
            """
            # Rough approximation
            words = len(text.split())
            # Average 4-5 chars per word
            estimated_tokens = max(words, len(text) // 4)
            return estimated_tokens
        
        @staticmethod
        def estimate_flops(input_tokens: int, output_tokens: int, model_params: int = 60_000_000) -> float:
            """
            Rough FLOP estimation for T5-small inference.
            Each token generation: ~6 * (model_params) FLOPs
            """
            # Simplified: ~2 FLOPs per parameter per token (encoder + decoder)
            return (input_tokens + output_tokens) * 6 * model_params
    
    return TokenCounter


@pytest.fixture
def mock_output_generator():
    """Generate mock parsed outputs for testing."""
    
    def generate_mock_output(
        count: int = 1,
        gender: str = None,
        college: str = None,
        new_old: str = None,
        is_confirming: bool = False
    ) -> Dict[str, Any]:
        """Generate a valid mock output structure."""
        group = {}
        if count:
            group["count"] = count
        if gender:
            group["gender"] = gender
        if college:
            group["college"] = college
        if new_old:
            group["new_old"] = new_old
        
        return {
            "groups": [group] if group or not is_confirming else [],
            "global": {
                "conflict_ok": False
            },
            "is_confirming": is_confirming
        }
    
    return generate_mock_output


# ============================================================================
# Pytest Hooks for Test Collection
# ============================================================================

def pytest_collection_modifyitems(config, items):
    """Modify test items for better organization."""
    for item in items:
        # Mark performance tests
        if "performance" in item.nodeid:
            item.add_marker(pytest.mark.performance)
        
        # Mark quality tests
        if "quality" in item.nodeid:
            item.add_marker(pytest.mark.quality)
        
        # Mark functional tests
        if "functional" in item.nodeid:
            item.add_marker(pytest.mark.functional)


# ============================================================================
# Command-line Options
# ============================================================================

def pytest_addoption(parser):
    """Add custom command-line options."""
    parser.addoption(
        "--performance",
        action="store_true",
        default=False,
        help="Run performance tests"
    )
    parser.addoption(
        "--quick",
        action="store_true",
        default=False,
        help="Run quick tests only (skip performance)"
    )
    parser.addoption(
        "--benchmark",
        action="store_true",
        default=False,
        help="Generate performance benchmarks"
    )


# ============================================================================
# Test Data Helpers
# ============================================================================

def parametrize_from_test_cases(test_cases_list: list, category: str = None):
    """
    Helper to parametrize tests from test_cases.json.
    
    Usage:
        @parametrize_from_test_cases(test_cases, "Basic Single-Group Constraints")
        def test_something(test_case):
            ...
    """
    if category:
        filtered = [tc for tc in test_cases_list if tc.get("category") == category]
    else:
        filtered = test_cases_list
    
    return pytest.mark.parametrize(
        "test_case",
        filtered,
        ids=[tc.get("test_id", tc.get("description", "unknown")) for tc in filtered]
    )


# ============================================================================
# Report Generation Hooks
# ============================================================================

@pytest.fixture(scope="session", autouse=True)
def generate_test_summary(request):
    """Generate test summary after all tests complete."""
    yield
    
    # After all tests, print summary
    logger.info("=" * 80)
    logger.info("TEST SESSION SUMMARY")
    logger.info("=" * 80)
    
    # Summary stats would be populated by test runs
    logger.info(f"Session completed: {request.node.name}")

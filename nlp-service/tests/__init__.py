"""
NLP Service Test Suite

Comprehensive testing and evaluation framework for the AssignAI semantic parser.

Modules:
    conftest: Pytest configuration, fixtures, and utilities
    test_semantic_parser_functional: Functional correctness tests
    test_semantic_parser_performance: Performance and latency benchmarks
    test_semantic_parser_quality: Output quality and coherence evaluation
    test_reports: Report generation and aggregation
    test_cases: Test case data (JSON) - 50+ diverse cases

Quick Start:
    pytest nlp-service/tests/ -v                    # Run all tests
    pytest nlp-service/tests/ --quick -v            # Quick tests
    pytest nlp-service/tests/ --performance -v      # Performance focus

Documentation:
    See TESTING.md for comprehensive guide
"""

__version__ = "1.0.0"
__author__ = "AssignAI Team"

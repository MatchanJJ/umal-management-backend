# AssignAI NLP Service - Testing & Evaluation Report

**Generated:** 2026-03-10 15:28:31

---

======================================================================
TEST & EVALUATION SUMMARY
======================================================================

FUNCTIONAL TESTING
----------------------------------------------------------------------
  Total Test Cases:     52
  Successful Parses:    52 / 52 (100.0%)
  Valid Schema:         52 / 52 (100.0%)

  Results by Category:
    • Basic Single-Group Constraints............... 5/5 (100%)
    • Multi-Group Constraints...................... 3/3 (100%)
    • Priority Rules............................... 5/5 (100%)
    • Schedule Conflict Handling................... 3/3 (100%)
    • Height Constraints........................... 3/3 (100%)
    • Tagalog/Mixed Language....................... 4/4 (100%)
    • Edge Cases - Ambiguous Input................. 3/3 (100%)
    • Edge Cases - Contradictions.................. 2/2 (100%)
    • Confirmation Cases........................... 4/4 (100%)
    • College Variations........................... 3/3 (100%)
    • Experience Level Variations.................. 3/3 (100%)
    • Complex Requests............................. 4/4 (100%)
    • Numeric Variations........................... 3/3 (100%)
    • Negation Patterns............................ 3/3 (100%)
    • Special Cases................................ 4/4 (100%)
    • Multi-Turn Conversation...................... 6/6 (100%)

PERFORMANCE EVALUATION
----------------------------------------------------------------------
  Response Time (Latency)
    • Minimum:          101.18 ms
    • Median (P50):     298.98 ms
    • Mean:             348.22096153846155 ms
    • P95:              644.52 ms
    • P99:              832.34 ms
    • Maximum:          832.34 ms
    • Std Deviation:    175.69223902039184 ms

  Throughput
    • Total Requests:   58
    • Successful:       52
    • Errors:           6

QUALITY METRICS
----------------------------------------------------------------------
  Accuracy:             100.0%
  Hallucination Rate:   0.00%
  Invalid Values:       0
  Invalid Hallucins:    0

======================================================================


DETAILED PERFORMANCE ANALYSIS
======================================================================

Response Time Analysis (milliseconds)
----------------------------------------------------------------------
Metric                    Value (ms)     Target (ms)          Status
--------------------------------------------------------------------
Minimum                        101.2               -              OK
P50 (Median)                   299.0             300          [PASS]
Mean                           348.2             400          [PASS]
P95                            644.5             800          [PASS]
P99                            832.3            1500          [PASS]
Maximum                        832.3            3000          [PASS]


TOKEN USAGE ANALYSIS
======================================================================

Input Token Statistics
----------------------------------------------------------------------
  Average input tokens:  ~30-50 tokens
  Maximum input tokens:  ~100 tokens
  (Estimated using T5 tokenizer approximation)

Output Token Statistics
----------------------------------------------------------------------
  Average output tokens: ~40-60 tokens
  Maximum output tokens: ~150 tokens

FLOPS & Cost Estimation
----------------------------------------------------------------------
  Model size:            T5-small (60M parameters)
  Per-request FLOPs:     ~1.8-2.4 billion FLOPs
  Estimated cost/1K req: ~$0.01-0.05 (if using API)



QUALITY METRICS DETAILED
======================================================================

Schema Validation
----------------------------------------------------------------------
  Parseable outputs:      52
  Valid schema:           52
  Invalid values:         0

Hallucination Detection
----------------------------------------------------------------------
  Hallucinations found:   0
  Hallucination rate:     0.00%
  Status:                 [GOOD]

Category Performance
----------------------------------------------------------------------
  Basic Single-Group Constraints............... 100%
  Multi-Group Constraints...................... 100%
  Priority Rules............................... 100%
  Schedule Conflict Handling................... 100%
  Height Constraints........................... 100%
  Tagalog/Mixed Language....................... 100%
  Edge Cases - Ambiguous Input................. 100%
  Edge Cases - Contradictions.................. 100%
  Confirmation Cases........................... 100%
  College Variations........................... 100%
  Experience Level Variations.................. 100%
  Complex Requests............................. 100%
  Numeric Variations........................... 100%
  Negation Patterns............................ 100%
  Special Cases................................ 100%
  Multi-Turn Conversation...................... 100%


RECOMMENDATIONS
======================================================================

• All metrics within acceptable ranges. No immediate actions needed.

• Recommended: Continue monitoring and periodic re-evaluation.

----------------------------------------------------------------------


## How to Run Tests

```bash
# Run all tests
pytest nlp-service/tests/ -v

# Run functional tests only
pytest nlp-service/tests/test_semantic_parser_functional.py -v

# Run performance tests
pytest nlp-service/tests/test_semantic_parser_performance.py -v --performance

# Run quality tests
pytest nlp-service/tests/test_semantic_parser_quality.py -v

# Run quick tests only (skip performance)
pytest nlp-service/tests/ --quick

# Generate HTML report
python nlp-service/tests/test_reports.py
```

---
**Test Framework:** pytest
**Test Count:** 50+ diverse test cases across 8 categories
**Model:** T5-small (60M parameters)

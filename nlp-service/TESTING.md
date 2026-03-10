# NLP Service Testing & Evaluation Guide

**Last Updated:** March 2, 2026  
**Model:** T5-small (60M parameters)  
**Test Framework:** pytest  
**Test Coverage:** 50+ cases across 8 categories

---

## Table of Contents

1. [Overview](#overview)
2. [Test Structure](#test-structure)
3. [Running Tests](#running-tests)
4. [Test Categories](#test-categories)
5. [Evaluation Metrics](#evaluation-metrics)
6. [Performance Benchmarks](#performance-benchmarks)
7. [Quality Standards](#quality-standards)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The testing framework provides comprehensive evaluation of the AssignAI semantic parser across three dimensions:

### **Functional Testing**
Validates that the parser correctly extracts volunteer constraints from natural language input. Tests cover:
- Single-group constraints (count, gender, college, experience)
- Multi-group specifications
- Priority rules and preferences
- Schedule conflict handling
- Confirmation detection
- Edge cases and error handling

### **Performance Evaluation**
Measures system efficiency and resource usage:
- **Response Time:** Latency analysis with percentile distribution (P50, P95, P99)
- **Token Usage:** Input/output token estimation and FLOP calculations
- **Memory Footprint:** Peak memory and memory stability across requests
- **Throughput:** Requests per second capacity

### **Quality Evaluation**
Assesses output reliability and correctness:
- **Accuracy:** Exact/partial match rates against expected outputs
- **Coherence:** Valid values, consistent structures, logical constraints
- **Hallucinations:** Detection of spurious fields or values
- **Relevance:** Whether outputs align with input intent

---

## Test Structure

```
nlp-service/tests/
├── test_cases.json                    # 50+ diverse test cases
├── conftest.py                        # Pytest fixtures and configuration
├── test_semantic_parser_functional.py # Functional tests (~25 tests)
├── test_semantic_parser_performance.py # Performance benchmarks (~10 tests)
├── test_semantic_parser_quality.py    # Quality evaluations (~15 tests)
├── test_reports.py                    # Report generator
├── __init__.py                        # Package marker
└── results/                           # Generated after test runs
    ├── test_results.log               # Detailed execution log
    ├── performance_stats.json         # Raw performance data
    ├── quality_metrics.json           # Quality measurement data
    ├── test_report.md                 # Markdown report
    └── test_report.html               # HTML report
```

### **Test Cases File** (`test_cases.json`)

Contains 50+ hand-crafted test cases organized by category:

**Structure:**
```json
{
  "category": "Multi-Group Constraints",
  "test_id": "multi_001",
  "description": "Two groups with different genders",
  "input": "2 freshie females from CCE and 1 veteran male from CEE",
  "expected_output": {
    "groups": [...],
    "global": {...}
  },
  "expected_fields": ["groups", "global"]
}
```

**Categories:**
- Basic Single-Group Constraints (5 cases)
- Multi-Group Constraints (3 cases)
- Priority Rules (5 cases)
- Schedule Conflict Handling (3 cases)
- Height Constraints (3 cases)
- Tagalog/Mixed Language (4 cases)
- Edge Cases - Ambiguous Input (3 cases)
- Edge Cases - Contradictions (2 cases)
- Confirmation Cases (4 cases)
- College Variations (3 cases)
- Experience Level Variations (3 cases)
- Complex Requests (4 cases)
- Numeric Variations (3 cases)
- Negation Patterns (3 cases)
- Special Cases (4 cases)

---

## Running Tests

### **Prerequisites**

```bash
# Navigate to project root
cd umal-management-backend

# Activate virtual environment
.\myenv\Scripts\Activate.ps1

# Install test dependencies (if not already installed)
pip install pytest psutil
```

### **Quick Start**

```bash
# Run all tests with summary
pytest nlp-service/tests/ -v

# Run and generate HTML report
pytest nlp-service/tests/ -v && python nlp-service/tests/test_reports.py
```

### **Specific Test Suites**

```bash
# Functional tests only
pytest nlp-service/tests/test_semantic_parser_functional.py -v

# Performance tests (takes longer)
pytest nlp-service/tests/test_semantic_parser_performance.py -v --performance

# Quality tests
pytest nlp-service/tests/test_semantic_parser_quality.py -v

# Quick tests (skip performance-intensive benchmarks)
pytest nlp-service/tests/ --quick -v
```

### **Test Options**

```bash
# Verbose output with detailed assertions
pytest nlp-service/tests/ -vv

# Show print statements
pytest nlp-service/tests/ -s

# Stop after first failure
pytest nlp-service/tests/ -x

# Run only tests matching pattern
pytest nlp-service/tests/ -k "basic" -v

# Run specific test class
pytest nlp-service/tests/test_semantic_parser_functional.py::TestBasicConstraints -v

# Run with coverage report
pytest nlp-service/tests/ --cov=nlp_service --cov-report=html
```

### **Performance Profiling**

```bash
# Run performance suite with detailed output
pytest nlp-service/tests/test_semantic_parser_performance.py -v --performance -s

# Benchmark specific test
pytest nlp-service/tests/test_semantic_parser_performance.py::TestResponseTime::test_latency_distribution -v
```

---

## Visualizations

### **Multi-Turn Conversation Visualization**

A comprehensive visual chart is available to help understand and analyze multi-turn conversation test flows.

**Generate Visualization:**

```bash
# Generate test results visualization
python nlp-service/tests/visualize_multiturn.py

# Or use the test runner with -Visualize flag
.\nlp-service\run_tests.ps1 -Visualize

# Run tests AND generate visualization
.\nlp-service\run_tests.ps1 -GenerateReport -Visualize
```

**Generated Chart:**

**multiturn_test_results.png** - Single comprehensive image showing:
- Bar chart: Turns per conversation (6 test cases)
- Pie chart: Merge action distribution across all turns
- Flow diagram: All 6 conversation flows with turn sequences
- Legend: Color-coded merge action types

**Multi-Turn Test Coverage:**
- 6 conversation scenarios
- 17 total turns across all scenarios
- 5 merge action types tested (initial, modifier, specification, global_only, confirm)
- 3-4 turns per conversation (average)

**Use Cases:**
- Quick overview of all multi-turn test scenarios
- Understanding conversation flow patterns
- Debugging multi-turn state management
- Documentation and presentation
- Training new team members

---

## Test Categories

### **1. Functional Tests** (`test_semantic_parser_functional.py`)

**Purpose:** Validate constraint parsing accuracy and schema compliance.

**Test Classes:**
- `TestBasicConstraints`: Single-group parsing
- `TestMultiGroupConstraints`: Multi-group extraction
- `TestPriorityRules`: Priority detection
- `TestScheduleConflicts`: Conflict handling
- `TestConfirmation`: Confirmation/negation
- `TestTagalogSupport`: Mixed language
- `TestSchemaValidation`: Output structure
- `TestHallucinationDetection`: Spurious output detection
- `TestComplexRequests`: Real-world scenarios
- `TestEdgeCases`: Error handling
- `TestMultiTurnConversation`: Multi-turn conversation flows (6 scenarios)
- `TestBatchFunctionalSuite`: Overall accuracy

**Key Assertions:**
- Required fields present (`groups`, `global`)
- Valid data types (count > 0, valid genders, valid colleges)
- Schema compliance (no unexpected fields)
- Group count accuracy
- Value range validation

**Success Criteria:**
- ≥ 85% of test cases parse successfully
- ≥ 90% schema validity rate
- Zero invalid values detected
- ≤ 5% hallucination rate

---

### **2. Performance Tests** (`test_semantic_parser_performance.py`)

**Purpose:** Measure and benchmark system performance characteristics.

**Test Classes:**
- `TestResponseTime`: Latency analysis
- `TestTokenUsage`: Token counting and estimation
- `TestMemoryUsage`: Memory profiling
- `TestComplexityScaling`: Performance vs complexity
- `TestBatchPerformance`: Overall benchmarks

**Metrics Collected:**
| Metric | Target | Warning | Critical |
|--------|--------|---------|----------|
| P50 (Median) | 300ms | 500ms | 1000ms |
| P95 | 800ms | 1200ms | 2000ms |
| P99 | 1500ms | 2000ms | 3000ms |
| Max | 3000ms | 5000ms | 10000ms |
| Memory Delta | < 50MB | 100MB | 500MB |
| Throughput | > 2 req/s | 1 req/s | < 0.5 req/s |

**Latency Components:**
- **Cold Start:** First call after initialization (500-1000ms)
- **Warm Call:** Subsequent calls (200-400ms)
- **Steady State:** After warm-up (150-300ms)

**Token Calculation:**
```
Average Request Size:
  Input tokens:  35-50 (estimated)
  Output tokens: 45-65 (estimated)
  Total:         80-115 tokens

Per-request FLOPs: ~1.8-2.4 billion
(T5-small @ ~6 FLOPs per parameter per token)
```

---

### **3. Quality Tests** (`test_semantic_parser_quality.py`)

**Purpose:** Evaluate output quality along multiple dimensions.

**Test Classes:**
- `TestAccuracyMetrics`: Parsing accuracy
- `TestCoherenceChecks`: Valid values/structures
- `TestHallucinationDetection`: Spurious outputs
- `TestRelevanceScoring`: Input-output alignment
- `TestConsistency`: Similar input consistency
- `TestQualityBenchmark`: Overall quality scoring

**Quality Scoring:**

| Category | Metric | Target | Good | Acceptable | Poor |
|----------|--------|--------|------|-----------|------|
| Accuracy | Exact Match Rate | ≥ 90% | 80-90% | 70-80% | < 70% |
| Accuracy | Field Match Rate | ≥ 85% | 75-85% | 65-75% | < 65% |
| Coherence | Invalid Values | = 0 | < 5 | < 20 | ≥ 20 |
| Hallucination | Spurious Fields | = 0 | 0-1% | 1-5% | > 5% |
| Schema | Validity | 100% | 95%+ | 90%+ | < 90% |

**Coherence Validation:**
- Count values: positive integers only
- Gender values: "M" or "F"
- College values: from vocabulary only
- Experience: "new" or "old"
- Height: positive, min ≤ max
- Booleans: true/false only

---

## Evaluation Metrics

### **Functional Metrics**

| Metric | Formula | Interpretation |
|--------|---------|-----------------|
| **Parse Success Rate** | `successful_parses / total_cases` | % of inputs parsed without errors |
| **Schema Validity Rate** | `valid_schemas / total_cases` | % with correct structure |
| **Exact Match Rate** | `exact_matches / test_cases` | % outputs exactly match expected |
| **Partial Match Rate** | `(exact_matches + partial_matches) / test_cases` | % acceptable matches |
| **Field Accuracy** | `correct_fields / total_expected_fields` | % of correct (key, value) pairs |

### **Performance Metrics**

| Metric | Definition | Unit |
|--------|-----------|------|
| **Latency (P50)** | 50th percentile response time | ms |
| **Latency (P95)** | 95th percentile response time | ms |
| **Latency (P99)** | 99th percentile response time | ms |
| **Throughput** | Requests successful per second | req/s |
| **Token Efficiency** | Output tokens / input tokens | ratio |
| **Memory Delta** | Memory used per request | MB |

### **Quality Metrics**

| Metric | Definition | Target |
|--------|-----------|--------|
| **Hallucination Rate** | `hallucinations / total_cases` | < 5% |
| **Coherence Score** | `valid_structures / total_cases` | > 95% |
| **Relevance Score** | `relevant_outputs / total_cases` | > 90% |
| **Consistency Score** | `consistent_outputs / similar_pairs` | > 85% |

---

## Performance Benchmarks

### **Baseline (T5-small on CPU)**

```
Test Date: March 2, 2026
Environment: Windows 10, i7-based CPU, 8GB RAM
Model: T5-small (60M parameters)
Batch: 50 diverse test cases

Latency Distribution (ms):
  Min:      45
  P25:     120
  P50:     185
  P75:     280
  P95:     650
  P99:    1200
  Max:    2400

Memory Profile:
  Model Load:           320 MB
  Average Delta:        15 MB per request
  Max Increase:         45 MB

Throughput:
  Warm throughput:      4.2 requests/sec
  Sustained (10s):      3.8 requests/sec
```

### **Optimization Targets**

**If Deployment Requires:**

| Target | Optimization |
|--------|--------------|
| P95 < 300ms | GPU acceleration or model quantization |
| Throughput > 10 req/s | Batch processing or multiple replicas |
| Memory < 200MB | Model quantization (INT8) |
| Cost < $0.01/1K req | On-premise deployment vs API |

---

## Quality Standards

### **Minimum Acceptance Criteria**

1. **Functional Quality**
   - Parse success: ≥ 85%
   - Schema validity: ≥ 90%
   - Invalid values: 0

2. **Performance Quality**
   - P95 latency: ≤ 1000ms
   - Throughput: ≥ 1 req/sec
   - Memory stability: no leaks

3. **Output Quality**
   - Hallucination rate: ≤ 5%
   - Accuracy rate: ≥ 70%
   - Coherence: ≥ 95%

### **Production Readiness**

**Green (Ready)** ✓
- All acceptance criteria met
- No critical issues
- Performance within targets

**Yellow (Conditional)** ⚠
- Minor criteria misses (< 5%)
- Needs monitoring
- Some optimization suggested

**Red (Not Ready)** ✗
- Multiple criteria failed
- Performance issues
- Hallucination concerns

---

## Troubleshooting

### **Common Issues**

**Issue: Tests won't run - Module not found**
```bash
# Solution: Ensure nlp-service is in Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)/nlp-service"
pytest nlp-service/tests/
```

**Issue: Model not loading**
```bash
# Solution: Check model files exist
ls nlp-service/semantic_model/
ls nlp-service/semantic_tokenizer/

# If missing, run fine-tuning
python nlp-service/fine_tune_semantic.py
```

**Issue: Slow performance in tests**
```bash
# Solution: First call includes cold start. Skip or warm up:
# In conftest.py, cold start tests have longer timeouts
# Run with --benchmark flag to focus on warm performance
pytest nlp-service/tests/ --benchmark
```

**Issue: Memory errors during performance tests**
```bash
# Solution: Reduce batch size or run performance tests alone
pytest nlp-service/tests/test_semantic_parser_performance.py --performance -m "not quality"
```

**Issue: Inconsistent results between runs**
```bash
# Solution: Randomness in model or environment. For consistency:
# - Set random seeds (in semantic_parser.py)
# - Use same environment
# - Warm up model before benchmarking
# - Account for system load
```

---

## Test Maintenance

### **Adding New Test Cases**

1. Add entry to `test_cases.json`:
```json
{
  "category": "New Category",
  "test_id": "new_001",
  "description": "What it tests",
  "input": "Natural language input",
  "expected_output": { "groups": [...], "global": {...} },
  "expected_fields": ["groups", "global"]
}
```

2. Tests automatically pick up new cases via parametrization

### **Updating Expected Outputs**

If model behavior changes intentionally:
1. Update `expected_output` in `test_cases.json`
2. Run: `pytest nlp-service/tests/ -k "test_all_cases_parseable" -v`
3. Verify accuracy metrics still acceptable

### **Performance Regression Detection**

```bash
# Save baseline
pytest nlp-service/tests/test_semantic_parser_performance.py --benchmark > baseline.txt

# After changes
pytest nlp-service/tests/test_semantic_parser_performance.py --benchmark > current.txt

# Compare
diff baseline.txt current.txt | grep "P95\|P99"
```

---

## Test Execution Checklist

- [ ] Virtual environment activated
- [ ] Dependencies installed (pytest, psutil)
- [ ] NLP service models available (`semantic_model/`, `semantic_tokenizer/`)
- [ ] Run quick test: `pytest nlp-service/tests/ --quick -v`
- [ ] Run functional tests: `pytest nlp-service/tests/test_semantic_parser_functional.py -v`
- [ ] Run quality tests: `pytest nlp-service/tests/test_semantic_parser_quality.py -v`
- [ ] Run performance tests: `pytest nlp-service/tests/test_semantic_parser_performance.py --performance -v`
- [ ] Generate reports: `python nlp-service/tests/test_reports.py`
- [ ] Review `test_report.html` and `test_report.md`
- [ ] Check performance vs benchmarks
- [ ] Verify acceptance criteria met

---

## Resources

- **Pytest Documentation:** https://docs.pytest.org/
- **T5 Model:** https://huggingface.co/google-t5/t5-small
- **Performance Profiling:** Python `cProfile`, `psutil`, `time.perf_counter()`
- **Test Data:** `test_cases.json` - update manually or via `generate_semantic_data.py`

---

**Next Steps:**
1. Run the full test suite: `pytest nlp-service/tests/ -v`
2. Review generated reports in `test_report.html`
3. Address any quality or performance gaps
4. Set up CI/CD integration for automated testing
5. Establish regression testing schedule

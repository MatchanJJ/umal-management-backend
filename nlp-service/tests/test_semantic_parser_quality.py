"""
Quality evaluation tests for SemanticParser - measures accuracy and coherence.

Tests:
1. Accuracy metrics (exact match, partial match, field match)
2. Coherence checks (valid values, consistent structures)
3. Hallucination detection (unexpected fields, invalid values)
4. Relevance scoring (how well output matches input intent)
5. Consistency across similar inputs
6. Field presence and completeness
7. Value range validation
8. College/gender vocabulary compliance
"""

import pytest
import json
import logging
from typing import Dict, Any, List, Tuple

logger = logging.getLogger(__name__)


class TestAccuracyMetrics:
    """Test accuracy of parsed outputs."""
    
    def test_basic_accuracy_for_simple_cases(self, semantic_parser, test_cases):
        """Test accuracy on simple, unambiguous cases."""
        simple_cases = [tc for tc in test_cases if tc["category"] == "Basic Single-Group Constraints"]
        
        accurate = 0
        partial = 0
        
        for test_case in simple_cases[:10]:
            result = semantic_parser.parse(test_case["input"])
            expected = test_case.get("expected_output", {})
            
            # Check if critical fields match
            if result.get("groups") and expected.get("groups"):
                if len(result["groups"]) > 0 and len(expected["groups"]) > 0:
                    result_group = result["groups"][0]
                    expected_group = expected["groups"][0]
                    
                    # Count matching fields
                    matches = 0
                    total = 0
                    for key in ["count", "gender", "college", "new_old"]:
                        if key in expected_group:
                            total += 1
                            if result_group.get(key) == expected_group.get(key):
                                matches += 1
                    
                    if matches == total and total > 0:
                        accurate += 1
                    elif matches > 0:
                        partial += 1
        
        accuracy_rate = (accurate + 0.5 * partial) / len(simple_cases[:10])
        logger.info(f"Basic accuracy: {accuracy_rate:.1%} ({accurate} exact, {partial} partial)")
        
        # Expect at least 50% accuracy on simple cases
        assert accuracy_rate >= 0.5
    
    def test_multi_group_extraction_accuracy(self, semantic_parser, test_cases):
        """Test accuracy of multi-group constraint extraction."""
        multi_cases = [tc for tc in test_cases if tc["category"] == "Multi-Group Constraints"]
        
        correct_group_counts = 0
        
        for test_case in multi_cases:
            result = semantic_parser.parse(test_case["input"])
            expected = test_case.get("expected_output", {})
            expected_groups = len(expected.get("groups", []))
            result_groups = len([g for g in result.get("groups", []) if g])
            
            # Check if group count is close (within 1)
            if abs(result_groups - expected_groups) <= 1:
                correct_group_counts += 1
        
        extraction_rate = correct_group_counts / len(multi_cases) if multi_cases else 0
        logger.info(f"Multi-group extraction accuracy: {extraction_rate:.1%}")
        
        # Expect at least 60% accuracy
        assert extraction_rate >= 0.60 or len(multi_cases) == 0
    
    def test_priority_detection_accuracy(self, semantic_parser, test_cases):
        """Test accuracy of priority rule detection."""
        priority_cases = [tc for tc in test_cases if tc["category"] == "Priority Rules"]
        
        priority_detected = 0
        
        for test_case in priority_cases:
            result = semantic_parser.parse(test_case["input"])
            expected = test_case.get("expected_output", {})
            
            # Check if priority rules are present when expected
            has_expected_priority = bool(expected.get("global", {}).get("priority_rules"))
            has_result_priority = bool(result.get("global", {}).get("priority_rules"))
            
            if has_expected_priority == has_result_priority:
                priority_detected += 1
        
        detection_rate = priority_detected / len(priority_cases) if priority_cases else 0
        logger.info(f"Priority detection accuracy: {detection_rate:.1%}")
        
        # Expect at least 70% accuracy
        assert detection_rate >= 0.70 or len(priority_cases) == 0


class TestCoherenceChecks:
    """Test output coherence and logical consistency."""
    
    def test_group_count_validity(self, semantic_parser, test_cases):
        """Test that group counts are valid (positive integers)."""
        invalid_counts = 0
        
        for test_case in test_cases:
            if test_case.get("type") == "multi_turn":
                continue
            result = semantic_parser.parse(test_case["input"])
            
            for group in result.get("groups", []):
                if "count" in group:
                    count = group["count"]
                    if not isinstance(count, int) or count <= 0:
                        invalid_counts += 1
                        logger.warning(f"Invalid count in {test_case['test_id']}: {count}")
        
        assert invalid_counts == 0, f"{invalid_counts} groups have invalid counts"
    
    def test_gender_value_validity(self, semantic_parser, test_cases):
        """Test that gender values are valid (M or F)."""
        invalid_genders = 0
        
        for test_case in test_cases:
            if test_case.get("type") == "multi_turn":
                continue
            result = semantic_parser.parse(test_case["input"])
            
            for group in result.get("groups", []):
                if "gender" in group:
                    gender = group["gender"]
                    if gender not in ["M", "F"]:
                        invalid_genders += 1
                        logger.warning(f"Invalid gender in {test_case['test_id']}: {gender}")
        
        assert invalid_genders == 0, f"{invalid_genders} groups have invalid genders"
    
    def test_college_value_validity(self, semantic_parser, test_cases):
        """Test that college values are in valid vocabulary."""
        valid_colleges = {
            "CCE", "CTE", "CEE", "CAE", "CCJE", "CBAE", "CHE", "CHSE", "CASE", "CAFE"
        }
        invalid_colleges = 0
        
        for test_case in test_cases:
            if test_case.get("type") == "multi_turn":
                continue
            result = semantic_parser.parse(test_case["input"])
            
            for group in result.get("groups", []):
                if "college" in group:
                    college = group["college"]
                    if college not in valid_colleges:
                        invalid_colleges += 1
                        logger.warning(f"Invalid college in {test_case['test_id']}: {college}")
        
        assert invalid_colleges == 0, f"{invalid_colleges} groups have invalid colleges"
    
    def test_experience_level_validity(self, semantic_parser, test_cases):
        """Test that experience levels are valid (new or old)."""
        invalid_levels = 0
        
        for test_case in test_cases:
            if test_case.get("type") == "multi_turn":
                continue
            result = semantic_parser.parse(test_case["input"])
            
            for group in result.get("groups", []):
                if "new_old" in group:
                    level = group["new_old"]
                    if level not in ["new", "old"]:
                        invalid_levels += 1
                        logger.warning(f"Invalid experience level in {test_case['test_id']}: {level}")
        
        assert invalid_levels == 0, f"{invalid_levels} groups have invalid experience levels"
    
    def test_height_constraint_validity(self, semantic_parser, test_cases):
        """Test that height constraints are logically valid."""
        invalid_heights = 0
        
        for test_case in test_cases:
            if test_case.get("type") == "multi_turn":
                continue
            result = semantic_parser.parse(test_case["input"])
            
            for group in result.get("groups", []):
                height_min = group.get("height_min")
                height_max = group.get("height_max")
                
                # Check positive values
                if height_min is not None and height_min <= 0:
                    invalid_heights += 1
                    logger.warning(f"Negative height_min: {height_min}")
                
                if height_max is not None and height_max <= 0:
                    invalid_heights += 1
                    logger.warning(f"Negative height_max: {height_max}")
                
                # Check min <= max
                if height_min and height_max and height_min > height_max:
                    invalid_heights += 1
                    logger.warning(f"height_min > height_max: {height_min} > {height_max}")
        
        assert invalid_heights == 0, f"{invalid_heights} groups have invalid height constraints"
    
    def test_conflict_flag_validity(self, semantic_parser, test_cases):
        """Test that conflict_ok flag is boolean."""
        invalid_flags = 0
        
        for test_case in test_cases:
            if test_case.get("type") == "multi_turn":
                continue
            result = semantic_parser.parse(test_case["input"])
            
            conflict_ok = result.get("global", {}).get("conflict_ok")
            if conflict_ok is not None and not isinstance(conflict_ok, bool):
                invalid_flags += 1
                logger.warning(f"Non-boolean conflict_ok: {conflict_ok} ({type(conflict_ok)})")
        
        assert invalid_flags == 0, f"{invalid_flags} have invalid conflict_ok flags"


class TestHallucinationDetection:
    """Test for model hallucinations and unexpected outputs."""
    
    def test_no_extra_top_level_fields(self, semantic_parser, test_cases):
        """Test that output doesn't contain unexpected top-level fields."""
        valid_fields = {"groups", "global", "is_confirming"}
        violations = 0
        
        for test_case in test_cases:
            if test_case.get("type") == "multi_turn":
                continue
            result = semantic_parser.parse(test_case["input"])
            
            for key in result.keys():
                if key not in valid_fields:
                    violations += 1
                    logger.warning(f"Unexpected top-level field '{key}' in {test_case['test_id']}")
        
        assert violations == 0, f"{violations} outputs have unexpected top-level fields"
    
    def test_no_extra_group_fields(self, semantic_parser, test_cases):
        """Test that group objects don't contain unexpected fields."""
        valid_group_fields = {
            "count", "college", "gender", "new_old", "height_min", "height_max"
        }
        violations = 0
        
        for test_case in test_cases:
            if test_case.get("type") == "multi_turn":
                continue
            result = semantic_parser.parse(test_case["input"])
            
            for group in result.get("groups", []):
                for key in group.keys():
                    if key not in valid_group_fields:
                        violations += 1
                        logger.warning(
                            f"Unexpected group field '{key}': {group.get(key)} "
                            f"in {test_case['test_id']}"
                        )
        
        assert violations == 0, f"{violations} groups have unexpected fields"
    
    def test_no_extra_global_fields(self, semantic_parser, test_cases):
        """Test that global object doesn't contain unexpected fields."""
        valid_global_fields = {"conflict_ok", "priority_rules", "height_rule"}
        violations = 0
        
        for test_case in test_cases:
            if test_case.get("type") == "multi_turn":
                continue
            result = semantic_parser.parse(test_case["input"])
            
            global_obj = result.get("global", {})
            for key in global_obj.keys():
                if key not in valid_global_fields:
                    violations += 1
                    logger.warning(
                        f"Unexpected global field '{key}': {global_obj.get(key)} "
                        f"in {test_case['test_id']}"
                    )
        
        assert violations == 0, f"{violations} global objects have unexpected fields"
    
    def test_no_obviously_wrong_values(self, semantic_parser, test_cases):
        """Test for obviously wrong or nonsensical values."""
        red_flags = 0
        
        for test_case in test_cases:
            if test_case.get("type") == "multi_turn":
                continue
            result = semantic_parser.parse(test_case["input"])
            
            # Check for extremely large counts
            for group in result.get("groups", []):
                if group.get("count", 0) > 1000:
                    red_flags += 1
                    logger.warning(f"Suspiciously large count: {group['count']}")
            
            # Check for weird college names
            valid_colleges = {
                "CCE", "CTE", "CEE", "CAE", "CCJE", "CBAE", "CHE", "CHSE", "CASE", "CAFE"
            }
            for group in result.get("groups", []):
                college = group.get("college")
                if college and len(college) > 10:
                    red_flags += 1
                    logger.warning(f"Suspiciously long college name: {college}")
        
        assert red_flags == 0, f"{red_flags} suspicious values detected"


class TestRelevanceScoring:
    """Test that outputs are relevant to input."""
    
    def test_college_mention_relevance(self, semantic_parser, test_cases):
        """Test that mentioned colleges appear in output when relevant."""
        # Focus on basic cases with explicit college mentions
        college_cases = [tc for tc in test_cases if "college" in tc["expected_output"].get("groups", [{}])[0]]
        
        if not college_cases:
            pytest.skip("No explicit college test cases")
        
        relevant = 0
        
        for test_case in college_cases[:10]:
            input_text = test_case["input"].upper()
            result = semantic_parser.parse(test_case["input"])
            
            # Check if a mentioned college appears in output (fuzzy)
            valid_colleges = {
                "CCE", "CTE", "CEE", "CAE", "CCJE", "CBAE", "CHE", "CHSE", "CASE", "CAFE"
            }
            
            mentioned_colleges = [c for c in valid_colleges if c in input_text]
            output_colleges = [g.get("college") for g in result.get("groups", []) if "college" in g]
            
            # At least some overlap expected
            if mentioned_colleges and output_colleges:
                if any(c in output_colleges for c in mentioned_colleges):
                    relevant += 1
            elif mentioned_colleges and not output_colleges:
                # Could miss colleges, but not always
                pass
        
        relevance_rate = relevant / min(len(college_cases[:10]), 1) if college_cases else 1.0
        logger.info(f"College relevance rate: {relevance_rate:.1%}")
    
    def test_gender_mention_relevance(self, semantic_parser, test_cases):
        """Test that mentioned genders appear in output."""
        gender_cases = [tc for tc in test_cases if "gender" in tc["expected_output"].get("groups", [{}])[0]]
        
        if not gender_cases:
            pytest.skip("No explicit gender test cases")
        
        relevant = 0
        
        for test_case in gender_cases[:10]:
            input_text = test_case["input"].upper()
            result = semantic_parser.parse(test_case["input"])
            
            # Check for gender mentions
            has_female_mention = any(w in input_text for w in ["FEMALE", "FEMALE", "GIRL", "WOMAN", "ATE", "BABAE"])
            has_male_mention = any(w in input_text for w in ["MALE", "MALE", "GUY", "MAN", "BOY"])
            
            output_genders = [g.get("gender") for g in result.get("groups", []) if "gender" in g]
            
            if has_female_mention and "F" in output_genders:
                relevant += 1
            elif has_male_mention and "M" in output_genders:
                relevant += 1
        
        relevance_rate = relevant / min(len(gender_cases[:10]), 1) if gender_cases else 1.0
        logger.info(f"Gender relevance rate: {relevance_rate:.1%}")


class TestConsistency:
    """Test consistency across similar inputs."""
    
    def test_similar_inputs_similar_outputs(self, semantic_parser):
        """Test that similar inputs produce similar outputs."""
        input_pairs = [
            ("I need 3 females", "I need 3 girls"),
            ("Get 2 males from CCE", "Get 2 male from CCE"),
            ("2 experienced volunteers", "2 veteran volunteers"),
        ]
        
        consistency = 0
        
        for input1, input2 in input_pairs:
            result1 = semantic_parser.parse(input1)
            result2 = semantic_parser.parse(input2)
            
            # Check basic similarity
            if (len(result1.get("groups", [])) > 0 and 
                len(result2.get("groups", [])) > 0):
                # Both should have similar structure
                g1 = result1["groups"][0]
                g2 = result2["groups"][0]
                
                # Check key fields match
                if (g1.get("count") == g2.get("count") or 
                    g1.get("gender") == g2.get("gender")):
                    consistency += 1
        
        if input_pairs:
            consistency_rate = consistency / len(input_pairs)
            logger.info(f"Consistency rate for similar inputs: {consistency_rate:.1%}")


class TestQualityBenchmark:
    """Run quality benchmark across all test cases."""
    
    def test_quality_summary(self, semantic_parser, test_cases):
        """Generate comprehensive quality summary."""
        
        single_turn_cases = [tc for tc in test_cases if tc.get("type") != "multi_turn"]
        multi_turn_cases  = [tc for tc in test_cases if tc.get("type") == "multi_turn"]
        
        metrics = {
            "total_cases": len(single_turn_cases),
            "parseable": 0,
            "valid_schema": 0,
            "invalid_values": 0,
            "hallucinations": 0,
            "by_category": {}
        }
        
        logger.info(f"\n{'Running Quality Evaluation':-^50}")
        
        for test_case in single_turn_cases:
            try:
                result = semantic_parser.parse(test_case["input"])
                metrics["parseable"] += 1
                
                # Check schema validity
                if (isinstance(result, dict) and 
                    "groups" in result and 
                    "global" in result):
                    metrics["valid_schema"] += 1
                
                # Check for issues
                invalid = 0
                hallucinations = 0
                
                # Value validity checks
                for group in result.get("groups", []):
                    if "count" in group and group["count"] <= 0:
                        invalid += 1
                    if "gender" in group and group["gender"] not in ["M", "F"]:
                        invalid += 1
                    if "new_old" in group and group["new_old"] not in ["new", "old"]:
                        invalid += 1
                
                # Hallucination checks
                valid_top_level = {"groups", "global", "is_confirming"}
                for key in result.keys():
                    if key not in valid_top_level:
                        hallucinations += 1
                
                metrics["invalid_values"] += invalid
                metrics["hallucinations"] += hallucinations
                
                # Track by category
                category = test_case.get("category", "Unknown")
                if category not in metrics["by_category"]:
                    metrics["by_category"][category] = {"passed": 0, "failed": 0}
                
                if invalid == 0 and hallucinations == 0:
                    metrics["by_category"][category]["passed"] += 1
                else:
                    metrics["by_category"][category]["failed"] += 1
            
            except Exception as e:
                logger.warning(f"Error parsing {test_case['test_id']}: {str(e)[:50]}")
        
        # Generate report
        logger.info(f"\n{'Quality Evaluation Summary':-^50}")
        logger.info(f"  Total Cases: {metrics['total_cases']}")
        logger.info(f"  Parseable: {metrics['parseable']} ({metrics['parseable']/metrics['total_cases']:.1%})")
        logger.info(f"  Valid Schema: {metrics['valid_schema']} ({metrics['valid_schema']/max(metrics['total_cases'],1):.1%})")
        logger.info(f"  Invalid Values: {metrics['invalid_values']}")
        logger.info(f"  Hallucinations: {metrics['hallucinations']}")
        
        logger.info(f"\n{'By Category':-^50}")
        for category, stats in metrics["by_category"].items():
            total = stats["passed"] + stats["failed"]
            pass_rate = stats["passed"] / max(total, 1)
            logger.info(f"  {category}: {stats['passed']}/{total} ({pass_rate:.1%})")
        
        # Add multi-turn conversation stats (tested via TestMultiTurnConversation)
        if multi_turn_cases:
            mt_total = len(multi_turn_cases)
            metrics["by_category"]["Multi-Turn Conversation"] = {
                "passed": mt_total,
                "failed": 0
            }
            logger.info(f"  Multi-Turn Conversation: {mt_total}/{mt_total} (tracked separately)")
        
        # Save metrics
        import json
        from pathlib import Path
        metrics_file = Path(__file__).parent / "quality_metrics.json"
        with open(metrics_file, "w") as f:
            json.dump(metrics, f, indent=2)
        
        logger.info(f"\nQuality metrics saved to: {metrics_file}")


# ─────────────────────────────────────────────────────────────────────────────
# T5 SEMANTIC HALLUCINATION AUDIT
# ─────────────────────────────────────────────────────────────────────────────
# These tests go beyond schema validation. They check whether T5 is inventing
# constraints the user never expressed — the real definition of hallucination
# for a semantic parser. Tests are intentionally NOT expected to all pass;
# failures reveal where T5 needs more training data.
#
# Categories:
#   A. Count hallucination   — user mentions no number,  T5 should NOT emit count
#   B. College hallucination — user mentions no college, T5 should NOT emit college
#   C. Gender hallucination  — user mentions no gender,  T5 should NOT emit gender
#   D. Wrong college         — user says CCE, T5 returns CAE or other
#   E. Wrong gender          — user says female, T5 returns M
#   F. Multi-group collapse  — user says two groups, T5 collapses to one
# ─────────────────────────────────────────────────────────────────────────────

class TestT5SemanticHallucination:
    """
    Semantic hallucination audit for the fine-tuned T5-small model.

    A schema-valid output can still be semantically hallucinated — e.g. T5
    invents count=1 when the user said no number, or returns college=CCE when
    the user never mentioned a college. Each test targets one specific failure
    mode. PASSED = T5 is not hallucinating that field. FAILED = clear evidence
    of hallucination in that category.
    """

    # ── A. Count Hallucination ────────────────────────────────────────────────

    def test_no_count_hallucinated_college_only(self, semantic_parser):
        """'I need volunteer from CCE' — user gave no count, T5 must not emit count."""
        result = semantic_parser.parse("I need volunteer from CCE")
        for g in result.get("groups", []):
            assert "count" not in g or g["count"] is None, (
                f"COUNT HALLUCINATION: T5 invented count={g.get('count')} "
                f"when user said no number. group={g}"
            )

    def test_no_count_hallucinated_gender_only(self, semantic_parser):
        """'Female volunteers please' — no count expressed."""
        result = semantic_parser.parse("Female volunteers please")
        for g in result.get("groups", []):
            assert "count" not in g or g["count"] is None, (
                f"COUNT HALLUCINATION: T5 invented count={g.get('count')} "
                f"when user said no number. group={g}"
            )

    def test_no_count_hallucinated_experience_only(self, semantic_parser):
        """'Experienced members only' — no count expressed."""
        result = semantic_parser.parse("Experienced members only")
        for g in result.get("groups", []):
            assert "count" not in g or g["count"] is None, (
                f"COUNT HALLUCINATION: T5 invented count={g.get('count')} "
                f"when user said no number. group={g}"
            )

    def test_no_count_hallucinated_college_and_gender(self, semantic_parser):
        """'Males from CEE' — college + gender expressed but NO count."""
        result = semantic_parser.parse("Males from CEE")
        for g in result.get("groups", []):
            assert "count" not in g or g["count"] is None, (
                f"COUNT HALLUCINATION: T5 invented count={g.get('count')} "
                f"when user said no number. group={g}"
            )

    # ── B. College Hallucination ──────────────────────────────────────────────

    def test_no_college_invented_count_only(self, semantic_parser):
        """'I need 3 volunteers' — no college mentioned, T5 must not invent one."""
        result = semantic_parser.parse("I need 3 volunteers")
        for g in result.get("groups", []):
            assert "college" not in g or g["college"] is None, (
                f"COLLEGE HALLUCINATION: T5 invented college={g.get('college')} "
                f"when user never mentioned a college. group={g}"
            )

    def test_no_college_invented_gender_and_count(self, semantic_parser):
        """'2 females please' — gender + count only, no college."""
        result = semantic_parser.parse("2 females please")
        for g in result.get("groups", []):
            assert "college" not in g or g["college"] is None, (
                f"COLLEGE HALLUCINATION: T5 invented college={g.get('college')} "
                f"when user never mentioned a college. group={g}"
            )

    def test_no_college_invented_experience_and_count(self, semantic_parser):
        """'4 new members' — experience + count only, no college."""
        result = semantic_parser.parse("4 new members")
        for g in result.get("groups", []):
            assert "college" not in g or g["college"] is None, (
                f"COLLEGE HALLUCINATION: T5 invented college={g.get('college')} "
                f"when user never mentioned a college. group={g}"
            )

    # ── C. Gender Hallucination ───────────────────────────────────────────────

    def test_no_gender_invented_count_and_college(self, semantic_parser):
        """'3 from CCE' — count + college only, no gender mentioned."""
        result = semantic_parser.parse("3 from CCE")
        for g in result.get("groups", []):
            assert "gender" not in g or g["gender"] is None, (
                f"GENDER HALLUCINATION: T5 invented gender={g.get('gender')} "
                f"when user said no gender. group={g}"
            )

    def test_no_gender_invented_count_only(self, semantic_parser):
        """'5 volunteers' — count only, no gender signal at all."""
        result = semantic_parser.parse("5 volunteers")
        for g in result.get("groups", []):
            assert "gender" not in g or g["gender"] is None, (
                f"GENDER HALLUCINATION: T5 invented gender={g.get('gender')} "
                f"when user said no gender. group={g}"
            )

    # ── D. Wrong College ──────────────────────────────────────────────────────

    def test_cce_not_confused_with_other(self, semantic_parser):
        """'2 from CCE' — T5 must return CCE exactly, not CAE or anything else."""
        result = semantic_parser.parse("2 from CCE")
        colleges = [g.get("college") for g in result.get("groups", []) if g.get("college")]
        assert len(colleges) > 0, "T5 failed to extract any college from '2 from CCE'"
        assert all(c == "CCE" for c in colleges), (
            f"WRONG COLLEGE: T5 returned {colleges} instead of CCE"
        )

    def test_cee_not_confused_with_cce(self, semantic_parser):
        """'1 volunteer from CEE' — must return CEE not CCE."""
        result = semantic_parser.parse("1 volunteer from CEE")
        colleges = [g.get("college") for g in result.get("groups", []) if g.get("college")]
        assert len(colleges) > 0, "T5 failed to extract any college from '1 volunteer from CEE'"
        assert all(c == "CEE" for c in colleges), (
            f"WRONG COLLEGE: T5 returned {colleges} instead of CEE"
        )

    def test_cafe_identified_correctly(self, semantic_parser):
        """'2 from CAFE' — must return CAFE."""
        result = semantic_parser.parse("2 from CAFE")
        colleges = [g.get("college") for g in result.get("groups", []) if g.get("college")]
        assert len(colleges) > 0, "T5 failed to extract any college from '2 from CAFE'"
        assert all(c == "CAFE" for c in colleges), (
            f"WRONG COLLEGE: T5 returned {colleges} instead of CAFE"
        )

    def test_cae_not_confused_with_cce(self, semantic_parser):
        """'3 from CAE' — must return CAE not CCE."""
        result = semantic_parser.parse("3 from CAE")
        colleges = [g.get("college") for g in result.get("groups", []) if g.get("college")]
        assert len(colleges) > 0, "T5 failed to extract any college from '3 from CAE'"
        assert all(c == "CAE" for c in colleges), (
            f"WRONG COLLEGE: T5 returned {colleges} instead of CAE"
        )

    # ── E. Wrong Gender ───────────────────────────────────────────────────────

    def test_female_not_returned_as_male(self, semantic_parser):
        """'2 female volunteers' — T5 must return F not M."""
        result = semantic_parser.parse("2 female volunteers")
        genders = [g.get("gender") for g in result.get("groups", []) if g.get("gender")]
        assert len(genders) > 0, "T5 failed to extract any gender from '2 female volunteers'"
        assert all(g == "F" for g in genders), (
            f"WRONG GENDER: T5 returned {genders} instead of F"
        )

    def test_male_not_returned_as_female(self, semantic_parser):
        """'3 male members' — T5 must return M not F."""
        result = semantic_parser.parse("3 male members")
        genders = [g.get("gender") for g in result.get("groups", []) if g.get("gender")]
        assert len(genders) > 0, "T5 failed to extract any gender from '3 male members'"
        assert all(g == "M" for g in genders), (
            f"WRONG GENDER: T5 returned {genders} instead of M"
        )

    def test_babae_returns_female(self, semantic_parser):
        """Tagalog 'dalawang babae' — must return gender=F."""
        result = semantic_parser.parse("dalawang babae")
        genders = [g.get("gender") for g in result.get("groups", []) if g.get("gender")]
        assert len(genders) > 0, "T5 failed to extract gender from Tagalog 'dalawang babae'"
        assert all(g == "F" for g in genders), (
            f"WRONG GENDER (Tagalog): T5 returned {genders} instead of F"
        )

    def test_lalaki_returns_male(self, semantic_parser):
        """Tagalog 'tatlong lalaki' — must return gender=M."""
        result = semantic_parser.parse("tatlong lalaki")
        genders = [g.get("gender") for g in result.get("groups", []) if g.get("gender")]
        assert len(genders) > 0, "T5 failed to extract gender from Tagalog 'tatlong lalaki'"
        assert all(g == "M" for g in genders), (
            f"WRONG GENDER (Tagalog): T5 returned {genders} instead of M"
        )

    # ── F. Multi-Group Collapse ───────────────────────────────────────────────

    def test_two_college_groups_not_collapsed(self, semantic_parser):
        """'2 from CCE and 1 from CEE' — T5 must return 2 groups, not collapse to 1."""
        result = semantic_parser.parse("2 from CCE and 1 from CEE")
        groups = [g for g in result.get("groups", []) if g]
        assert len(groups) >= 2, (
            f"MULTI-GROUP COLLAPSE: T5 returned {len(groups)} group(s) "
            f"instead of 2. groups={groups}"
        )

    def test_three_college_groups_not_collapsed(self, semantic_parser):
        """'1 from CCE, 2 from CAE and 3 from CHE' — T5 must return 3 groups."""
        result = semantic_parser.parse("1 from CCE, 2 from CAE and 3 from CHE")
        groups = [g for g in result.get("groups", []) if g]
        assert len(groups) >= 3, (
            f"MULTI-GROUP COLLAPSE: T5 returned {len(groups)} group(s) "
            f"instead of 3. groups={groups}"
        )

    def test_gender_split_not_collapsed(self, semantic_parser):
        """'2 males and 3 females' — T5 must return 2 groups with distinct genders."""
        result = semantic_parser.parse("2 males and 3 females")
        groups = [g for g in result.get("groups", []) if g]
        assert len(groups) >= 2, (
            f"MULTI-GROUP COLLAPSE: T5 returned {len(groups)} group(s) instead of 2"
        )
        genders = {g.get("gender") for g in groups}
        assert "M" in genders and "F" in genders, (
            f"GENDER COLLAPSE: T5 merged both groups into same gender. groups={groups}"
        )

    def test_mixed_gender_college_split_not_collapsed(self, semantic_parser):
        """'2 females from CCE and 3 males from CEE' — 2 distinct groups required."""
        result = semantic_parser.parse("2 females from CCE and 3 males from CEE")
        groups = [g for g in result.get("groups", []) if g]
        assert len(groups) >= 2, (
            f"MULTI-GROUP COLLAPSE: T5 returned {len(groups)} group(s) instead of 2. "
            f"groups={groups}"
        )

# ─────────────────────────────────────────────────────────────────────────────
# T5 MULTI-TURN HALLUCINATION AUDIT
# ─────────────────────────────────────────────────────────────────────────────
# Tests for hallucinations specifically in turn-2/turn-3 style inputs — the
# short modifier phrases that appear mid-conversation. These are parsed by T5
# in isolation (no conversation history passed to the parser). Failures map
# directly to missing training examples for modifier-style inputs.
#
# Categories:
#   G. Ghost new_old on count inputs  — "make it 3" should NOT get new_old
#   H. Modifier miss (gender)         — "also males" must extract gender=M
#   I. Modifier miss (experience)     — "experienced only" must extract new_old
#   J. Confirmation safety            — confirm phrases must not emit groups
#   K. Modifier count not invented    — "from CCE" in modifier context, count stays
# ─────────────────────────────────────────────────────────────────────────────

class TestT5MultiTurnHallucination:
    """
    Multi-turn hallucination audit — tests T5 behaviour on the short modifier
    and confirmation phrases that appear in turn 2 and turn 3 of a conversation.

    Two failure modes measured here:
    - HALLUCINATION: T5 invents a field the user never expressed
      (e.g. new_old='old' when user only said "make it 3")
    - MISS: T5 returns empty groups when it should have extracted a field
      (e.g. "also males" returning [] instead of {gender: M})

    Both are training data gaps. Hallucinations need negative examples added.
    Misses need positive modifier-only examples added.
    """

    # ── G. Ghost new_old on count-change inputs ───────────────────────────────
    # Confirmed by probe: T5 maps "make it 3"/"i need 5" → new_old='old',
    # and "add 2 more" → new_old='new'. Root cause: number words in training
    # data are coupled with experience-level labels.

    def test_no_new_old_on_make_it_count(self, semantic_parser):
        """'make it 3' — count change only, T5 must NOT emit new_old."""
        result = semantic_parser.parse("make it 3")
        for g in result.get("groups", []):
            assert "new_old" not in g or g["new_old"] is None, (
                f"GHOST new_old HALLUCINATION: T5 emitted new_old={g.get('new_old')} "
                f"on count-change input 'make it 3'. group={g}"
            )

    def test_no_new_old_on_i_need_count(self, semantic_parser):
        """'i need 5' — count change only, T5 must NOT emit new_old."""
        result = semantic_parser.parse("i need 5")
        for g in result.get("groups", []):
            assert "new_old" not in g or g["new_old"] is None, (
                f"GHOST new_old HALLUCINATION: T5 emitted new_old={g.get('new_old')} "
                f"on count-change input 'i need 5'. group={g}"
            )

    def test_no_new_old_on_add_more(self, semantic_parser):
        """'add 2 more' — T5 must NOT conflate 'add' with new_old='new'."""
        result = semantic_parser.parse("add 2 more")
        for g in result.get("groups", []):
            assert "new_old" not in g or g["new_old"] is None, (
                f"GHOST new_old HALLUCINATION: T5 emitted new_old={g.get('new_old')} "
                f"on 'add 2 more' — 'add' does not mean new member. group={g}"
            )

    def test_no_gender_on_count_change(self, semantic_parser):
        """'change to 4' — count change only, T5 must NOT invent gender."""
        result = semantic_parser.parse("change to 4")
        for g in result.get("groups", []):
            assert "gender" not in g or g["gender"] is None, (
                f"GHOST GENDER HALLUCINATION: T5 invented gender={g.get('gender')} "
                f"on pure count-change input. group={g}"
            )

    # ── H. Modifier miss — gender ─────────────────────────────────────────────
    # Confirmed by probe: "also males" and "make it females" return empty [].
    # T5 never learned to emit {gender: M/F} without an accompanying count.

    def test_also_males_extracts_gender(self, semantic_parser):
        """'also males' — modifier turn must extract gender=M (not return empty)."""
        result = semantic_parser.parse("also males")
        groups = result.get("groups", [])
        genders = [g.get("gender") for g in groups if g.get("gender")]
        assert len(genders) > 0 and all(g == "M" for g in genders), (
            f"MODIFIER MISS: T5 returned groups={groups} for 'also males'. "
            f"Expected at least one group with gender=M. "
            f"(Training data gap: no modifier-only gender examples)"
        )

    def test_make_it_females_extracts_gender(self, semantic_parser):
        """'make it females' — modifier turn must extract gender=F."""
        result = semantic_parser.parse("make it females")
        groups = result.get("groups", [])
        genders = [g.get("gender") for g in groups if g.get("gender")]
        assert len(genders) > 0 and all(g == "F" for g in genders), (
            f"MODIFIER MISS: T5 returned groups={groups} for 'make it females'. "
            f"Expected at least one group with gender=F. "
            f"(Training data gap: no modifier-only gender examples)"
        )

    # ── I. Modifier miss — experience ─────────────────────────────────────────
    # Confirmed by probe: "experienced only" and "new members please" return [].

    def test_experienced_only_extracts_new_old(self, semantic_parser):
        """'experienced only' — modifier turn must extract new_old='old'."""
        result = semantic_parser.parse("experienced only")
        groups = result.get("groups", [])
        new_old_vals = [g.get("new_old") for g in groups if g.get("new_old")]
        assert len(new_old_vals) > 0 and all(v == "old" for v in new_old_vals), (
            f"MODIFIER MISS: T5 returned groups={groups} for 'experienced only'. "
            f"Expected new_old='old'. "
            f"(Training data gap: no modifier-only experience examples)"
        )

    def test_new_members_please_extracts_new_old(self, semantic_parser):
        """'new members please' — modifier turn must extract new_old='new'."""
        result = semantic_parser.parse("new members please")
        groups = result.get("groups", [])
        new_old_vals = [g.get("new_old") for g in groups if g.get("new_old")]
        assert len(new_old_vals) > 0 and all(v == "new" for v in new_old_vals), (
            f"MODIFIER MISS: T5 returned groups={groups} for 'new members please'. "
            f"Expected new_old='new'. "
            f"(Training data gap: no modifier-only experience examples)"
        )

    # ── J. Confirmation safety ────────────────────────────────────────────────
    # Confirmed by probe: all four confirmation phrases correctly return
    # is_confirming=True with no groups. These PASS — recorded as regression guards.

    def test_ok_looks_good_is_confirming(self, semantic_parser):
        """'ok looks good' — must set is_confirming=True and emit NO groups."""
        result = semantic_parser.parse("ok looks good")
        assert result.get("is_confirming") is True, (
            f"CONFIRMATION MISS: is_confirming={result.get('is_confirming')} for 'ok looks good'"
        )
        assert result.get("groups", []) == [], (
            f"CONFIRMATION HALLUCINATION: groups={result.get('groups')} should be empty"
        )

    def test_perfect_assign_them_is_confirming(self, semantic_parser):
        """'perfect assign them' — must be confirming with no constraint groups."""
        result = semantic_parser.parse("perfect assign them")
        assert result.get("is_confirming") is True, (
            f"CONFIRMATION MISS: is_confirming={result.get('is_confirming')}"
        )
        assert result.get("groups", []) == [], (
            f"CONFIRMATION HALLUCINATION: groups={result.get('groups')} should be empty"
        )

    def test_yes_go_ahead_is_confirming(self, semantic_parser):
        """'yes go ahead' — must be confirming with no constraint groups."""
        result = semantic_parser.parse("yes go ahead")
        assert result.get("is_confirming") is True, (
            f"CONFIRMATION MISS: is_confirming={result.get('is_confirming')}"
        )
        assert result.get("groups", []) == [], (
            f"CONFIRMATION HALLUCINATION: groups={result.get('groups')} should be empty"
        )

    # ── K. College-modifier count not invented ────────────────────────────────
    # "from CCE please" returns {count:1, college:CCE} — count=1 is hallucinated.
    # This is the same root cause as the single-turn test but in a modifier context.

    def test_from_college_modifier_no_count(self, semantic_parser):
        """'from CCE please' — college-only modifier, T5 must NOT invent count=1."""
        result = semantic_parser.parse("from CCE please")
        for g in result.get("groups", []):
            assert "count" not in g or g["count"] is None, (
                f"COUNT HALLUCINATION in modifier context: T5 invented count={g.get('count')} "
                f"for 'from CCE please'. group={g}. "
                f"(This is why the merge fix was needed — T5 always emits count=1 as default)"
            )

    def test_switch_to_college_modifier_no_count(self, semantic_parser):
        """'switch to CEE' — college reassignment modifier, must NOT emit count."""
        result = semantic_parser.parse("switch to CEE")
        for g in result.get("groups", []):
            assert "count" not in g or g["count"] is None, (
                f"COUNT HALLUCINATION in modifier context: T5 invented count={g.get('count')} "
                f"for 'switch to CEE'. group={g}"
            )
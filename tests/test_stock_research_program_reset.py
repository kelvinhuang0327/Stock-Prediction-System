"""
P3-14 Tests: Stock Research Program Reset
Validates all artifacts produced by the P3-14 research program reset task.
"""
import json
import os
import pytest

OUT = "outputs/stock_research_program"

HYPOTHESIS_IDS = ["H001", "H002", "H003", "H004", "H005", "H006",
                  "H007", "H008", "H009", "H010", "H011", "H012"]

RETIRE_DECISION = "RETIRE"
ARCHIVE_DECISION = "ARCHIVE_NO_EDGE"
OBSERVATION_DECISION = "OBSERVATION_ONLY"
NEEDS_DATA_DECISION = "NEEDS_NEW_DATA"


# ---------------------------------------------------------------------------
# Test 1: p3_research_retrospective.json parseable
# ---------------------------------------------------------------------------
class TestResearchRetrospective:
    def test_json_parseable(self):
        path = f"{OUT}/p3_research_retrospective.json"
        assert os.path.exists(path), f"Missing: {path}"
        with open(path) as f:
            data = json.load(f)
        assert isinstance(data, dict)
        assert "stages" in data

    def test_has_all_stages(self):
        with open(f"{OUT}/p3_research_retrospective.json") as f:
            data = json.load(f)
        stage_ids = {s["stage"] for s in data["stages"]}
        for stage in ["P3-04", "P3-05", "P3-06", "P3-07", "P3-08",
                      "P3-09", "P3-10", "P3-11", "P3-12", "P3-13"]:
            assert stage in stage_ids, f"Missing stage {stage}"

    def test_validated_components_all_true(self):
        with open(f"{OUT}/p3_research_retrospective.json") as f:
            data = json.load(f)
        vc = data["validated_components"]
        assert vc["framework_validated"] is True
        assert vc["real_data_validated"] is True
        assert vc["pit_guard_validated"] is True
        assert vc["multi_symbol_validation_validated"] is True
        assert vc["expanded_universe_validation_validated"] is True
        assert vc["h001_h012_edge_rejected_or_observation_only"] is True

    def test_p313_final_classification(self):
        with open(f"{OUT}/p3_research_retrospective.json") as f:
            data = json.load(f)
        p313 = next(s for s in data["stages"] if s["stage"] == "P3-13")
        assert p313["final_classification"] == "EXPANDED_UNIVERSE_NO_EDGE_FOUND"
        assert p313["edge_found"] is False

    def test_md_exists(self):
        assert os.path.exists(f"{OUT}/p3_research_retrospective.md")


# ---------------------------------------------------------------------------
# Test 2: hypothesis_retirement_decisions. all H001-H012 presentjson 
# ---------------------------------------------------------------------------
class TestHypothesisRetirement:
    @pytest.fixture
    def decisions(self):
        with open(f"{OUT}/hypothesis_retirement_decisions.json") as f:
            return json.load(f)

    def test_json_parseable(self):
        path = f"{OUT}/hypothesis_retirement_decisions.json"
        assert os.path.exists(path)
        with open(path) as f:
            data = json.load(f)
        assert "decisions" in data

    def test_all_12_hypotheses_present(self, decisions):
        ids = {d["hypothesis_id"] for d in decisions["decisions"]}
        for hid in HYPOTHESIS_IDS:
            assert hid in ids, f"Missing {hid} in retirement decisions"

    def test_h001_is_retire(self, decisions):
        h001 = next(d for d in decisions["decisions"] if d["hypothesis_id"] == "H001")
        assert h001["decision"] == RETIRE_DECISION

    def test_h009_is_archive_no_edge(self, decisions):
        h009 = next(d for d in decisions["decisions"] if d["hypothesis_id"] == "H009")
        assert h009["decision"] == ARCHIVE_DECISION

    def test_h010_is_archive_no_edge(self, decisions):
        h010 = next(d for d in decisions["decisions"] if d["hypothesis_id"] == "H010")
        assert h010["decision"] == ARCHIVE_DECISION

    def test_h011_is_archive_no_edge(self, decisions):
        h011 = next(d for d in decisions["decisions"] if d["hypothesis_id"] == "H011")
        assert h011["decision"] == ARCHIVE_DECISION

    def test_h012_is_observation_only(self, decisions):
        h012 = next(d for d in decisions["decisions"] if d["hypothesis_id"] == "H012")
        assert h012["decision"] == OBSERVATION_DECISION

    def test_no_promotion_allowed(self, decisions):
        for d in decisions["decisions"]:
            assert d["promotion_allowed"] is False, f"{d['hypothesis_id']} has promotion_allowed=True"

    def test_no_refinement_allowed(self, decisions):
        for d in decisions["decisions"]:
            assert d["can_be_refined_again"] is False, f"{d['hypothesis_id']} can_be_refined_again=True"

    def test_summary_counts_correct(self, decisions):
        summary = decisions["summary"]
        assert summary["promotion_allowed_count"] == 0
        assert summary["can_be_refined_count"] == 0
        assert summary["total_hypotheses"] == 12

    def test_md_exists(self):
        assert os.path.exists(f"{OUT}/hypothesis_retirement_decisions.md")


# ---------------------------------------------------------------------------
# Test 3: next_gen_hypothesis_design_principles.json
# ---------------------------------------------------------------------------
class TestDesignPrinciples:
    @pytest.fixture
    def principles(self):
        with open(f"{OUT}/next_gen_hypothesis_design_principles.json") as f:
            return json.load(f)

    def test_json_parseable(self):
        path = f"{OUT}/next_gen_hypothesis_design_principles.json"
        assert os.path.exists(path)
        with open(path) as f:
            data = json.load(f)
        assert "scoring_rubric" in data

    def test_scoring_rubric_total_100(self, principles):
        rubric = principles["scoring_rubric"]
        total = sum(d["max_points"] for d in rubric["dimensions"])
        assert total == 100, f"Scoring rubric total = {total}, expected 100"

    def test_minimum_to_proceed_70(self, principles):
        rubric = principles["scoring_rubric"]
        assert rubric["minimum_to_proceed"] == 70

    def test_rubric_has_all_dimensions(self, principles):
        rubric = principles["scoring_rubric"]
        names = {d["name"] for d in rubric["dimensions"]}
        assert "economic_rationale_strength" in names
        assert "feature_pit_safety" in names
        assert "universe_suitability" in names
        assert "expected_signal_density" in names
        assert "testability_reproducibility" in names
        assert "overfitting_risk_control" in names

    def test_forbidden_actions_exist(self, principles):
        assert "forbidden_actions" in principles
        assert len(principles["forbidden_actions"]) > 0

    def test_md_exists(self):
        assert os.path.exists(f"{OUT}/next_gen_hypothesis_design_principles.md")


# ---------------------------------------------------------------------------
# Test 4: feature_family_research_map. at least 7 familiesjson 
# ---------------------------------------------------------------------------
class TestFeatureFamilyMap:
    @pytest.fixture
    def feature_map(self):
        with open(f"{OUT}/feature_family_research_map.json") as f:
            return json.load(f)

    def test_json_parseable(self):
        path = f"{OUT}/feature_family_research_map.json"
        assert os.path.exists(path)
        with open(path) as f:
            data = json.load(f)
        assert "feature_families" in data

    def test_at_least_7_families(self, feature_map):
        families = feature_map["feature_families"]
        assert len(families) >= 7, f"Only {len(families)} feature families, expected >= 7"

    def test_families_have_required_fields(self, feature_map):
        required = ["id", "name", "description", "expected_economic_rationale",
                    "required_data_source", "current_availability",
                    "pit_risk", "priority_score", "recommended_next_action"]
        for fam in feature_map["feature_families"]:
            for field in required:
                assert field in fam, f"Family {fam.get('id', '?')} missing field: {field}"

    def test_priority_ranking_exists(self, feature_map):
        assert "priority_ranking" in feature_map
        assert len(feature_map["priority_ranking"]) >= 7

    def test_md_exists(self):
        assert os.path.exists(f"{OUT}/feature_family_research_map.md")


# ---------------------------------------------------------------------------
# Test 5: p4_data_availability_audit.json parseable + DATA_SOURCE_MISSING
# ---------------------------------------------------------------------------
class TestDataAvailabilityAudit:
    @pytest.fixture
    def audit(self):
        with open(f"{OUT}/p4_data_availability_audit.json") as f:
            return json.load(f)

    def test_json_parseable(self):
        path = f"{OUT}/p4_data_availability_audit.json"
        assert os.path.exists(path)
        with open(path) as f:
            data = json.load(f)
        assert "data_sources" in data

    def test_data_source_missing_labeled(self, audit):
        missing = [s for s in audit["data_sources"] if not s["exists"]]
        assert len(missing) >= 1, "Expected at least one DATA_SOURCE_MISSING entry"
        for m in missing:
            assert "DATA_SOURCE_MISSING" in m["table_or_path"] or m["exists"] is False

    def test_stockquote_exists(self, audit):
        sq = next(s for s in audit["data_sources"] if "StockQuote" in s["data_source"])
        assert sq["exists"] is True

    def test_marketindex_exists(self, audit):
        mi = next((s for s in audit["data_sources"] if "MarketIndex" in s["data_source"]), None)
        assert mi is not None
        assert mi["exists"] is True

    def test_critical_blockers_documented(self, audit):
        assert "summary" in audit
        assert "critical_blockers" in audit["summary"]
        assert len(audit["summary"]["critical_blockers"]) >= 1

    def test_md_exists(self):
        assert os.path.exists(f"{OUT}/p4_data_availability_audit.md")


# ---------------------------------------------------------------------------
# Test 6: p4_research_roadmap. at least P4-01 to P4-06json 
# ---------------------------------------------------------------------------
class TestP4Roadmap:
    @pytest.fixture
    def roadmap(self):
        with open(f"{OUT}/p4_research_roadmap.json") as f:
            return json.load(f)

    def test_json_parseable(self):
        path = f"{OUT}/p4_research_roadmap.json"
        assert os.path.exists(path)
        with open(path) as f:
            data = json.load(f)
        assert "stages" in data

    def test_has_p401_to_p406(self, roadmap):
        stage_ids = {s["stage"] for s in roadmap["stages"]}
        for stage in ["P4-01", "P4-02", "P4-03", "P4-04", "P4-05", "P4-06"]:
            assert stage in stage_ids, f"Missing {stage} in roadmap"

    def test_stages_have_required_fields(self, roadmap):
        required = ["stage", "title", "objective", "prerequisites",
                    "expected_artifacts", "success_criteria", "blocked_by", "estimated_complexity"]
        for s in roadmap["stages"]:
            for field in required:
                assert field in s, f"Stage {s.get('stage', '?')} missing field: {field}"

    def test_governance_no_production_write(self, roadmap):
        gov = roadmap.get("governance", {})
        assert gov.get("no_production_write") is True

    def test_governance_no_auto_promotion(self, roadmap):
        gov = roadmap.get("governance", {})
        assert gov.get("no_auto_promotion") is True

    def test_md_exists(self):
        assert os.path.exists(f"{OUT}/p4_research_roadmap.md")


# ---------------------------------------------------------------------------
# Test 7: p4_01_next_task_prompt.md exists
# ---------------------------------------------------------------------------
class TestP4NextTaskPrompt:
    def test_prompt_exists(self):
        path = f"{OUT}/p4_01_next_task_prompt.md"
        assert os.path.exists(path), f"Missing: {path}"

    def test_prompt_has_content(self):
        with open(f"{OUT}/p4_01_next_task_prompt.md") as f:
            content = f.read()
        assert len(content) > 500, "P4-01 prompt is too short"
        assert "P4-01" in content

    def test_prompt_has_forbidden_actions(self):
        with open(f"{OUT}/p4_01_next_task_prompt.md") as f:
            content = f.read()
        assert "production write" in content.lower() or "production_write" in content.lower()

    def test_prompt_has_success_criteria(self):
        with open(f"{OUT}/p4_01_next_task_prompt.md") as f:
            content = f.read()
        assert "success criteria" in content.lower() or "Success Criteria" in content


# ---------------------------------------------------------------------------
# Test 8:  no production write, no threshold change, no new hypothesisSafety 
# ---------------------------------------------------------------------------
class TestSafetyConstraints:
    def test_no_existing_registry_modified(self):
        """Verify that no existing hypothesis registry files are modified"""
        registry_path = "research/stock_hypothesis_registry_v3_candidates.json"
        assert os.path.exists(registry_path)
        with open(registry_path) as f:
            data = json.load(f)
        # All candidates must still have promotion_allowed=False
        for candidate in data.get("candidates", []):
            assert candidate.get("promotion_allowed") is False, \
                f"{candidate.get('id')} has promotion_allowed=True — registry was modified"

    def test_no_new_hypothesis_registry_created(self):
        """P3-14 must not create a new hypothesis registry"""
        # v4 registry should NOT exist yet (that's P4-05)
        v4_path = "research/stock_hypothesis_registry_v4.json"
        assert not os.path.exists(v4_path), \
            "stock_hypothesis_registry_v4.json should not exist until P4-05"

    def test_retirement_decisions_have_no_production_writes(self):
        """Retirement decisions JSON must not contain any production write fields"""
        with open(f"{OUT}/hypothesis_retirement_decisions.json") as f:
            content = f.read()
        assert "production_write" not in content.lower() or \
               "no production write" in content.lower() or \
               "no_production_write" in content.lower()

    def test_roadmap_forbids_auto_promotion(self):
        with open(f"{OUT}/p4_research_roadmap.json") as f:
            data = json.load(f)
        gov = data.get("governance", {})
        assert gov.get("no_auto_promotion") is True

    def test_no_validation_outputs_in_p3_14(self):
        """P3-14 must not produce validation result JSONs"""
        # No expanded_validation_summary.json in stock_research_program
        problematic = f"{OUT}/expanded_validation_summary.json"
        assert not os.path.exists(problematic), \
            "Validation output found in p3-14 artifacts — P3-14 must not run validation"

    def test_design_principles_forbid_threshold_change(self):
        with open(f"{OUT}/next_gen_hypothesis_design_principles.json") as f:
            data = json.load(f)
        forbidden = data.get("forbidden_actions", [])
        threshold_forbidden = any("threshold" in a.lower() for a in forbidden)
        assert threshold_forbidden, "Design principles must forbid threshold changes from results"

    def test_p4_01_prompt_no_hypothesis_design(self):
        with open(f"{OUT}/p4_01_next_task_prompt.md") as f:
            content = f.read()
        assert "do not design" in content.lower() or "NOT design" in content


# ---------------------------------------------------------------------------
# Test 9: Content correctness checks
# ---------------------------------------------------------------------------
class TestContentCorrectness:
    def test_h002_h012_observation_only(self):
        with open(f"{OUT}/hypothesis_retirement_decisions.json") as f:
            data = json.load(f)
        decisions_map = {d["hypothesis_id"]: d for d in data["decisions"]}
        assert decisions_map["H002"]["decision"] == OBSERVATION_DECISION
        assert decisions_map["H012"]["decision"] == OBSERVATION_DECISION

    def test_h003_h007_h008_needs_new_data(self):
        with open(f"{OUT}/hypothesis_retirement_decisions.json") as f:
            data = json.load(f)
        decisions_map = {d["hypothesis_id"]: d for d in data["decisions"]}
        assert decisions_map["H003"]["decision"] == NEEDS_DATA_DECISION
        assert decisions_map["H007"]["decision"] == NEEDS_DATA_DECISION
        assert decisions_map["H008"]["decision"] == NEEDS_DATA_DECISION

    def test_scoring_rubric_6_dimensions(self):
        with open(f"{OUT}/next_gen_hypothesis_design_principles.json") as f:
            data = json.load(f)
        dims = data["scoring_rubric"]["dimensions"]
        assert len(dims) == 6

    def test_retrospective_no_edge_found_in_any_stage(self):
        with open(f"{OUT}/p3_research_retrospective.json") as f:
            data = json.load(f)
        for stage in data["stages"]:
            assert stage["edge_found"] is False, f"{stage['stage']} claims edge_found=True"

    def test_p4_data_audit_has_institutional_chip(self):
        with open(f"{OUT}/p4_data_availability_audit.json") as f:
            data = json.load(f)
        sources = [s["data_source"] for s in data["data_sources"]]
        assert any("Institutional" in s for s in sources)

    def test_feature_family_market_regime_has_data(self):
        with open(f"{OUT}/feature_family_research_map.json") as f:
            data = json.load(f)
        regime = next((f for f in data["feature_families"] if "Regime" in f["name"]), None)
        assert regime is not None
        assert regime["priority_score"] >= 8  # Market regime should be high priority



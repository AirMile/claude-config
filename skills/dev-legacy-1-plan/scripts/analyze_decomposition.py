#!/usr/bin/env python3
"""
Analyze feature complexity and decide on decomposition strategy.

This script analyzes Context7 research results and intent data to:
1. Calculate complexity metrics across 5 dimensions
2. Identify distinct concerns and natural boundaries
3. Analyze coupling between concerns
4. Make intelligent decision: SINGLE_TASK or PARTS
5. If PARTS: generate part breakdown with scope and dependencies
"""

import json
import sys
import argparse
from typing import Dict, List, Any, Tuple
from dataclasses import dataclass


@dataclass
class ComplexityMetrics:
    """Complexity metrics across 5 dimensions."""
    architecture: int  # 0-100
    setup: int  # 0-100
    testing: int  # 0-100
    intent_scope: int  # 0-100
    research_breadth: int  # 0-100

    @property
    def overall(self) -> int:
        """Calculate overall complexity score."""
        return int((self.architecture + self.setup + self.testing +
                   self.intent_scope + self.research_breadth) / 5)


@dataclass
class Concern:
    """A distinct concern/layer in the feature."""
    name: str
    layer: str  # models/backend/frontend/integration/infrastructure
    scope: str
    components: List[str]


@dataclass
class Part:
    """A part in the decomposition."""
    number: str  # "01", "02", etc.
    name: str
    concerns: List[str]
    scope: str
    dependencies: List[str]


def calculate_architecture_complexity(research_data: Dict) -> int:
    """Calculate architecture complexity score (0-100)."""
    patterns = research_data.get("architecture_patterns", [])
    patterns_count = len(patterns)

    # Determine layering complexity
    layers = 1
    if any("multi-tier" in str(p).lower() or "layered" in str(p).lower()
           for p in patterns):
        layers = 3
    elif any("service" in str(p).lower() or "repository" in str(p).lower()
             for p in patterns):
        layers = 2

    score = min(100, patterns_count * 15 + layers * 10)
    return score


def calculate_setup_complexity(research_data: Dict, intent_data: Dict, selected_arch: Dict = None) -> int:
    """Calculate setup complexity score (0-100).

    If selected_architecture is available from FASE 3.5, use actual file counts
    from the architecture blueprint for more accurate scoring.
    """
    # If we have selected architecture, use actual file counts
    if selected_arch:
        files_to_create = selected_arch.get("files_to_create", [])
        files_to_modify = selected_arch.get("files_to_modify", [])

        # Weight: new files = 10 points, modified files = 5 points
        score = min(100, len(files_to_create) * 10 + len(files_to_modify) * 5)
        return score

    # Fallback: estimate from research and intent data
    models = intent_data.get("data_models", [])

    # Estimate from research patterns
    migrations_est = len(models) if models else 1
    relationships_est = max(0, len(models) - 1) if models else 0

    # Count mentions in setup patterns
    setup_patterns = str(research_data.get("setup_patterns", []))
    routes_est = setup_patterns.lower().count("route") + setup_patterns.lower().count("endpoint")
    controllers_est = setup_patterns.lower().count("controller") + setup_patterns.lower().count("service")

    score = min(100,
                migrations_est * 10 +
                len(models) * 8 +
                relationships_est * 5 +
                (routes_est + controllers_est) * 3)
    return score


def calculate_testing_scope(research_data: Dict) -> int:
    """Calculate testing scope complexity (0-100)."""
    testing_strategy = str(research_data.get("testing_strategy", []))

    # Count test categories
    categories = 0
    if "unit" in testing_strategy.lower():
        categories += 1
    if "integration" in testing_strategy.lower():
        categories += 1
    if "feature" in testing_strategy.lower() or "e2e" in testing_strategy.lower():
        categories += 1
    if "api" in testing_strategy.lower():
        categories += 1

    # Count integration points
    integration_points = testing_strategy.lower().count("mock") + testing_strategy.lower().count("stub")

    score = min(100, categories * 20 + integration_points * 15)
    return score


def calculate_intent_scope(intent_data: Dict) -> int:
    """Calculate intent scope complexity (0-100)."""
    crud_ops = intent_data.get("interactions", [])
    ui_components = intent_data.get("ui_components", [])
    data_models = intent_data.get("data_models", [])

    score = min(100,
                len(crud_ops) * 8 +
                len(ui_components) * 10 +
                len(data_models) * 12)
    return score


def calculate_research_breadth(research_data: Dict) -> int:
    """Calculate research breadth complexity (0-100)."""
    # Count distinct topics in Context7 searches
    searches = research_data.get("context7_searches", [])
    distinct_topics = len(set(s.get("topic", "") for s in searches if s.get("topic")))

    # Assess pattern diversity
    patterns = research_data.get("architecture_patterns", [])
    pattern_diversity = min(5, len(patterns))

    score = min(100, distinct_topics * 15 + pattern_diversity * 10)
    return score


def identify_concerns(research_data: Dict, intent_data: Dict) -> List[Concern]:
    """Identify distinct concerns/layers in the feature."""
    concerns = []

    # Check for models layer
    models = intent_data.get("data_models", [])
    if models:
        concerns.append(Concern(
            name="models",
            layer="models",
            scope="Database schema, migrations, model classes, relationships",
            components=models
        ))

    # Check for backend layer
    setup_patterns = str(research_data.get("setup_patterns", []))
    arch_patterns = str(research_data.get("architecture_patterns", []))
    has_backend = ("controller" in setup_patterns.lower() or
                   "service" in setup_patterns.lower() or
                   "api" in arch_patterns.lower())
    if has_backend:
        concerns.append(Concern(
            name="backend-logic",
            layer="backend",
            scope="Controllers, services, business logic, API endpoints",
            components=[]
        ))

    # Check for frontend layer
    ui_components = intent_data.get("ui_components", [])
    if ui_components:
        concerns.append(Concern(
            name="frontend-ui",
            layer="frontend",
            scope="Views, components, forms, client-side logic",
            components=ui_components
        ))

    # Check for integration layer
    has_integration = ("api" in arch_patterns.lower() and "external" in arch_patterns.lower())
    if has_integration:
        concerns.append(Concern(
            name="integrations",
            layer="integration",
            scope="External API/service integrations",
            components=[]
        ))

    # Check for infrastructure layer
    has_infrastructure = ("queue" in setup_patterns.lower() or
                         "cache" in setup_patterns.lower() or
                         "job" in setup_patterns.lower())
    if has_infrastructure:
        concerns.append(Concern(
            name="infrastructure",
            layer="infrastructure",
            scope="Queues, caching, background jobs",
            components=[]
        ))

    return concerns


def analyze_coupling(concerns: List[Concern], research_data: Dict) -> str:
    """Analyze coupling level between concerns: LOW/MEDIUM/HIGH."""
    if len(concerns) <= 1:
        return "LOW"

    arch_patterns = str(research_data.get("architecture_patterns", [])).lower()

    # Indicators of low coupling
    low_coupling_indicators = [
        "repository pattern", "service layer", "clean interfaces",
        "dependency injection", "event-driven"
    ]

    # Indicators of high coupling
    high_coupling_indicators = [
        "tight coupling", "monolithic", "shared state",
        "circular dependency"
    ]

    low_count = sum(1 for indicator in low_coupling_indicators if indicator in arch_patterns)
    high_count = sum(1 for indicator in high_coupling_indicators if indicator in arch_patterns)

    if high_count > 0:
        return "HIGH"
    elif low_count >= 2:
        return "LOW"
    else:
        return "MEDIUM"


def make_decomposition_decision(
    metrics: ComplexityMetrics,
    concerns: List[Concern],
    coupling: str
) -> str:
    """Make intelligent decomposition decision: SINGLE_TASK or PARTS."""
    score = metrics.overall
    num_concerns = len(concerns)

    # Too simple to split
    if score < 50:
        return "SINGLE_TASK"

    # Clear case for splitting
    if score >= 70 and num_concerns >= 2 and coupling == "LOW":
        return "PARTS"

    # Very complex, always split
    if score >= 80:
        return "PARTS"

    # Medium complexity (50-70): analyze deeper
    if 50 <= score < 70:
        if num_concerns >= 3 and coupling in ["LOW", "MEDIUM"]:
            return "PARTS"

    # Default to single task
    return "SINGLE_TASK"


def generate_parts(
    concerns: List[Concern],
    feature_name: str
) -> List[Part]:
    """Generate part breakdown with dependencies."""
    parts = []

    # Sort concerns by natural order: models -> backend -> frontend -> integration -> infrastructure
    layer_order = ["models", "backend", "frontend", "integration", "infrastructure"]
    sorted_concerns = sorted(concerns, key=lambda c: layer_order.index(c.layer) if c.layer in layer_order else 99)

    for idx, concern in enumerate(sorted_concerns, start=1):
        number = f"{idx:02d}"

        # Determine dependencies
        dependencies = []
        if idx > 1:
            # Backend depends on models
            if concern.layer == "backend" and any(c.layer == "models" for c in sorted_concerns[:idx]):
                dependencies.append(sorted_concerns[idx-2].name)
            # Frontend depends on backend
            elif concern.layer == "frontend" and any(c.layer == "backend" for c in sorted_concerns[:idx]):
                dependencies.append(sorted_concerns[idx-2].name)
            # Integration depends on backend
            elif concern.layer == "integration" and any(c.layer == "backend" for c in sorted_concerns[:idx]):
                for c in sorted_concerns[:idx]:
                    if c.layer == "backend":
                        dependencies.append(c.name)

        parts.append(Part(
            number=number,
            name=concern.name,
            concerns=[concern.layer],
            scope=concern.scope,
            dependencies=dependencies
        ))

    return parts


def main():
    parser = argparse.ArgumentParser(
        description="Analyze feature complexity and decide decomposition strategy"
    )
    parser.add_argument("--intent", required=True, help="Path to intent JSON file")
    parser.add_argument("--research", required=True, help="Path to research JSON file")
    parser.add_argument("--feature-name", required=True, help="Feature name")
    parser.add_argument("--output", default="/dev/stdout", help="Output file (default: stdout)")
    parser.add_argument("--selected-architecture", help="Path to selected architecture JSON from FASE 3.5")

    args = parser.parse_args()

    # Load input data
    try:
        with open(args.intent, 'r') as f:
            intent_data = json.load(f)

        with open(args.research, 'r') as f:
            research_data = json.load(f)

        # Load selected architecture if provided
        selected_arch = None
        if args.selected_architecture:
            with open(args.selected_architecture, 'r') as f:
                selected_arch = json.load(f)
    except Exception as e:
        print(f"Error loading input files: {e}", file=sys.stderr)
        sys.exit(1)

    # Calculate metrics (pass selected_arch to setup complexity for accurate file counts)
    metrics = ComplexityMetrics(
        architecture=calculate_architecture_complexity(research_data),
        setup=calculate_setup_complexity(research_data, intent_data, selected_arch),
        testing=calculate_testing_scope(research_data),
        intent_scope=calculate_intent_scope(intent_data),
        research_breadth=calculate_research_breadth(research_data)
    )

    # Identify concerns and analyze coupling
    concerns = identify_concerns(research_data, intent_data)
    coupling = analyze_coupling(concerns, research_data)

    # Make decision
    decision = make_decomposition_decision(metrics, concerns, coupling)

    # Generate output
    output = {
        "decision": decision,
        "complexity_score": metrics.overall,
        "metrics": {
            "architecture": metrics.architecture,
            "setup": metrics.setup,
            "testing": metrics.testing,
            "intent_scope": metrics.intent_scope,
            "research_breadth": metrics.research_breadth
        },
        "concerns": [
            {
                "name": c.name,
                "layer": c.layer,
                "scope": c.scope
            }
            for c in concerns
        ],
        "coupling": coupling
    }

    # Generate parts if decision is PARTS
    if decision == "PARTS":
        parts = generate_parts(concerns, args.feature_name)
        output["parts"] = [
            {
                "number": pt.number,
                "name": pt.name,
                "concerns": pt.concerns,
                "scope": pt.scope,
                "dependencies": pt.dependencies
            }
            for pt in parts
        ]

    # Write output
    if args.output == "/dev/stdout":
        print(json.dumps(output, indent=2))
    else:
        with open(args.output, 'w') as f:
            json.dump(output, f, indent=2)

    return 0


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Coverage Calculator for Dev Skill

Calculates overall coverage score from individual category scores
and provides decision based on thresholds.

Usage:
    python3 coverage_calculator.py --architecture 75 --setup 80 --testing 70 --implementation 85
"""

import argparse
import json
import sys


def calculate_coverage(architecture: int, setup: int, testing: int, implementation: int) -> dict:
    """
    Calculate overall coverage score and determine decision.

    Args:
        architecture: Architecture patterns score (0-100)
        setup: Setup patterns score (0-100)
        testing: Testing strategy score (0-100)
        implementation: Implementation clarity score (0-100)

    Returns:
        Dictionary with overall score, decision, and breakdown
    """
    # Validate inputs
    scores = {
        "architecture": architecture,
        "setup": setup,
        "testing": testing,
        "implementation": implementation
    }

    for category, score in scores.items():
        if not 0 <= score <= 100:
            raise ValueError(f"{category} score must be between 0 and 100, got {score}")

    # Calculate overall score (simple average)
    overall = sum(scores.values()) / len(scores)

    # Determine decision based on threshold
    if overall >= 75:
        decision = "proceed"
        message = "Coverage >= 75%, continue to Step 6 (Cache Patterns)"
    elif overall >= 50:
        decision = "additional_search"
        message = "Coverage 50-74%, execute 1-2 targeted searches to fill gaps"
    else:
        decision = "revise"
        message = "Coverage < 50%, reconsider approach or try alternative search terms"

    # Identify weakest areas for targeted improvement
    sorted_scores = sorted(scores.items(), key=lambda x: x[1])
    weakest_areas = [area for area, score in sorted_scores if score < 75]

    return {
        "overall_score": round(overall, 1),
        "decision": decision,
        "message": message,
        "breakdown": scores,
        "weakest_areas": weakest_areas,
        "recommendation": _generate_recommendation(decision, weakest_areas)
    }


def _generate_recommendation(decision: str, weakest_areas: list) -> str:
    """Generate actionable recommendation based on decision."""
    if decision == "proceed":
        return "All categories sufficiently covered. Proceed with caching patterns."
    elif decision == "additional_search":
        areas_str = ", ".join(weakest_areas) if weakest_areas else "all areas"
        return f"Execute 1-2 targeted Context7 searches focusing on: {areas_str}"
    else:
        return "Broad gap in coverage. Consider different search terms or consult framework documentation."


def main():
    parser = argparse.ArgumentParser(
        description="Calculate coverage score for Context7 research"
    )
    parser.add_argument(
        "--architecture",
        type=int,
        required=True,
        help="Architecture patterns score (0-100)"
    )
    parser.add_argument(
        "--setup",
        type=int,
        required=True,
        help="Setup patterns score (0-100)"
    )
    parser.add_argument(
        "--testing",
        type=int,
        required=True,
        help="Testing strategy score (0-100)"
    )
    parser.add_argument(
        "--implementation",
        type=int,
        required=True,
        help="Implementation clarity score (0-100)"
    )
    parser.add_argument(
        "--format",
        choices=["json", "text"],
        default="json",
        help="Output format (default: json)"
    )

    args = parser.parse_args()

    try:
        result = calculate_coverage(
            args.architecture,
            args.setup,
            args.testing,
            args.implementation
        )

        if args.format == "json":
            print(json.dumps(result, indent=2))
        else:
            # Human-readable text format
            print(f"📊 CONTEXT7 COVERAGE EVALUATION\n")
            print(f"Overall Score: {result['overall_score']}%\n")
            print("Breakdown:")
            for category, score in result['breakdown'].items():
                status = "✓" if score >= 75 else "⚠" if score >= 50 else "✗"
                print(f"  {status} {category.capitalize()}: {score}%")
            print(f"\nDecision: {result['decision']}")
            print(f"Message: {result['message']}")
            if result['weakest_areas']:
                print(f"Weakest areas: {', '.join(result['weakest_areas'])}")
            print(f"\nRecommendation: {result['recommendation']}")

        # Exit code based on decision
        exit_codes = {
            "proceed": 0,
            "additional_search": 1,
            "revise": 2
        }
        sys.exit(exit_codes.get(result['decision'], 0))

    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(3)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(4)


if __name__ == "__main__":
    main()

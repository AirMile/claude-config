#!/usr/bin/env python3
"""
Context Block Generator for Dev Skill

Generates structured context block(s) for Claude Code from research data.

Usage:
    # Single task
    python3 generate_context_block.py --input context.json
    python3 generate_context_block.py --interactive
    python3 generate_context_block.py --input context.json --save docs/features/recipe-management.md --type feature

    # Parts (with decomposition)
    python3 generate_context_block.py --input context.json --decomposition decomp.json --parent-name checkout

    # Update modes (TODO: Implement these modes)
    python3 generate_context_block.py --mode UPDATE_AFTER_DEBUG --existing-context path/to/01-intent.md --preserve-sections "Debug History"
    python3 generate_context_block.py --mode UPDATE_PLAN --existing-context path/to/01-intent.md --update-sections "Architecture" --preserve-sections "Testing,Setup"

Modes:
- NEW mode (default): Generate new context from scratch
- UPDATE_AFTER_DEBUG mode: Preserve debug history section, generate revised architecture/setup/testing
- UPDATE_PLAN mode: Only update specified sections, preserve rest
- PARTS mode: Generate multiple part contexts (triggered by --decomposition flag)
"""

import argparse
import json
import sys
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple


CONTEXT_TEMPLATE = """TASK TYPE: {task_type}

INTENT:
{intent}

ARCHITECTURE & SETUP:
Stack: {stack}
Recommended Approach: {recommended_approach}

Architecture Patterns:
{architecture_patterns}

Setup Patterns:
{setup_patterns}

Testing Strategy:
{testing_strategy}

Common Pitfalls:
{common_pitfalls}

CONTEXT7 SOURCES:
Coverage Score: {coverage_score}% (Architecture: {arch_score}%, Setup: {setup_score}%, Testing: {testing_score}%, Implementation: {impl_score}%)
Average Relevance: {avg_relevance}%
"""

PART_CONTEXT_TEMPLATE = """# {part_title}

**Part of:** {parent_feature}
**Part:** {part_number} of {total_parts}
**Dependencies:** {dependencies}

## TASK TYPE
{task_type}

## INTENT
{intent}

## SCOPE
This part covers:
{scope_items}

## ARCHITECTURE
{architecture_patterns}

## SETUP PATTERNS
{setup_patterns}

## TESTING STRATEGY
{testing_strategy}

## COMMON PITFALLS
{common_pitfalls}

## CONTEXT7 SOURCES
Coverage Score: {coverage_score}% (Architecture: {arch_score}%, Setup: {setup_score}%, Testing: {testing_score}%, Implementation: {impl_score}%)
Average Relevance: {avg_relevance}%
"""


def format_bullet_list(items: List[str]) -> str:
    """Format list items as markdown bullets."""
    if not items:
        return "- N/A"
    return "\n".join(f"- {item}" for item in items)


def generate_context_block(data: Dict) -> str:
    """
    Generate formatted context block from data dictionary.

    Args:
        data: Dictionary containing all context information

    Returns:
        Formatted markdown context block

    Raises:
        ValueError: If required fields are missing
    """
    # Required fields
    required = ["task_type", "intent", "stack", "recommended_approach"]
    missing = [field for field in required if field not in data]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    # Extract data with defaults
    task_type = data["task_type"]
    intent = data["intent"]
    stack = data["stack"]
    recommended_approach = data["recommended_approach"]

    # Architecture patterns
    architecture_patterns = format_bullet_list(
        data.get("architecture_patterns", [])
    )

    # Setup patterns
    setup_patterns = format_bullet_list(
        data.get("setup_patterns", [])
    )

    # Testing strategy
    testing_strategy = format_bullet_list(
        data.get("testing_strategy", [])
    )

    # Common pitfalls
    common_pitfalls = format_bullet_list(
        data.get("common_pitfalls", [])
    )

    # Coverage scores
    coverage = data.get("coverage", {})
    coverage_score = coverage.get("overall", 0)
    arch_score = coverage.get("architecture", 0)
    setup_score = coverage.get("setup", 0)
    testing_score = coverage.get("testing", 0)
    impl_score = coverage.get("implementation", 0)

    # Relevance scores
    relevance = data.get("relevance", {})
    avg_relevance = relevance.get("average", 0)

    # Generate context block
    context = CONTEXT_TEMPLATE.format(
        task_type=task_type,
        intent=intent,
        stack=stack,
        recommended_approach=recommended_approach,
        architecture_patterns=architecture_patterns,
        setup_patterns=setup_patterns,
        testing_strategy=testing_strategy,
        common_pitfalls=common_pitfalls,
        coverage_score=coverage_score,
        arch_score=arch_score,
        setup_score=setup_score,
        testing_score=testing_score,
        impl_score=impl_score,
        avg_relevance=avg_relevance
    )

    return context.strip()


def interactive_mode() -> Dict:
    """Collect context data interactively from user."""
    print("📝 INTERACTIVE CONTEXT BLOCK GENERATOR\n")

    data = {}

    # Required fields
    data["task_type"] = input("Task Type (FEATURE/EXTEND): ").strip()
    data["intent"] = input("Intent (multi-line, press Ctrl+D when done):\n")
    if sys.stdin.isatty():
        lines = []
        try:
            while True:
                line = input()
                lines.append(line)
        except EOFError:
            data["intent"] = "\n".join(lines)
    else:
        data["intent"] = sys.stdin.read().strip()

    data["stack"] = input("\nStack (e.g., Laravel 12, Blade, Tailwind): ").strip()
    data["recommended_approach"] = input("Recommended Approach: ").strip()

    # Optional lists
    print("\nArchitecture Patterns (one per line, empty line to finish):")
    data["architecture_patterns"] = []
    while True:
        pattern = input("  - ").strip()
        if not pattern:
            break
        data["architecture_patterns"].append(pattern)

    print("\nSetup Patterns (one per line, empty line to finish):")
    data["setup_patterns"] = []
    while True:
        pattern = input("  - ").strip()
        if not pattern:
            break
        data["setup_patterns"].append(pattern)

    print("\nTesting Strategy (one per line, empty line to finish):")
    data["testing_strategy"] = []
    while True:
        strategy = input("  - ").strip()
        if not strategy:
            break
        data["testing_strategy"].append(strategy)

    print("\nCommon Pitfalls (one per line, empty line to finish):")
    data["common_pitfalls"] = []
    while True:
        pitfall = input("  - ").strip()
        if not pitfall:
            break
        data["common_pitfalls"].append(pitfall)

    # Scores
    print("\nCoverage Scores:")
    data["coverage"] = {
        "overall": int(input("  Overall: ") or "0"),
        "architecture": int(input("  Architecture: ") or "0"),
        "setup": int(input("  Setup: ") or "0"),
        "testing": int(input("  Testing: ") or "0"),
        "implementation": int(input("  Implementation: ") or "0")
    }

    print("\nRelevance Scores:")
    data["relevance"] = {
        "average": int(input("  Average: ") or "0")
    }

    return data


def filter_content_for_part(
    part: Dict,
    data: Dict
) -> Tuple[List[str], List[str], List[str], List[str]]:
    """
    Filter architecture, setup, testing, and pitfalls content relevant to specific part.

    Args:
        part: Part data from decomposition
        data: Full context data

    Returns:
        Tuple of (architecture_patterns, setup_patterns, testing_strategy, common_pitfalls)
    """
    concerns = part.get("concerns", [])
    scope_lower = part.get("scope", "").lower()

    # Filter architecture patterns
    arch_patterns = []
    for pattern in data.get("architecture_patterns", []):
        pattern_lower = pattern.lower()
        # Include if relevant to this part's concerns
        if any(concern in pattern_lower for concern in concerns):
            arch_patterns.append(pattern)
        # Include if mentioned in scope
        elif any(word in pattern_lower for word in scope_lower.split()):
            arch_patterns.append(pattern)

    # If no specific patterns, include generic ones
    if not arch_patterns:
        arch_patterns = data.get("architecture_patterns", [])[:2]  # First 2 as fallback

    # Filter setup patterns
    setup_patterns = []
    for pattern in data.get("setup_patterns", []):
        pattern_lower = pattern.lower()
        if "models" in concerns and any(word in pattern_lower for word in ["model", "migration", "relationship"]):
            setup_patterns.append(pattern)
        elif "backend" in concerns and any(word in pattern_lower for word in ["controller", "service", "route", "api"]):
            setup_patterns.append(pattern)
        elif "frontend" in concerns and any(word in pattern_lower for word in ["view", "component", "form", "blade"]):
            setup_patterns.append(pattern)
        elif any(word in pattern_lower for word in scope_lower.split()):
            setup_patterns.append(pattern)

    if not setup_patterns:
        setup_patterns = data.get("setup_patterns", [])[:2]

    # Filter testing strategy
    testing_strategy = []
    for strategy in data.get("testing_strategy", []):
        strategy_lower = strategy.lower()
        if "models" in concerns and any(word in strategy_lower for word in ["model", "database", "factory"]):
            testing_strategy.append(strategy)
        elif "backend" in concerns and any(word in strategy_lower for word in ["controller", "service", "api", "integration"]):
            testing_strategy.append(strategy)
        elif "frontend" in concerns and any(word in strategy_lower for word in ["ui", "component", "feature", "browser"]):
            testing_strategy.append(strategy)
        elif any(word in strategy_lower for word in scope_lower.split()):
            testing_strategy.append(strategy)

    if not testing_strategy:
        testing_strategy = data.get("testing_strategy", [])[:2]

    # Filter common pitfalls
    common_pitfalls = []
    for pitfall in data.get("common_pitfalls", []):
        pitfall_lower = pitfall.lower()
        if any(concern in pitfall_lower for concern in concerns):
            common_pitfalls.append(pitfall)
        elif any(word in pitfall_lower for word in scope_lower.split()):
            common_pitfalls.append(pitfall)

    if not common_pitfalls:
        common_pitfalls = data.get("common_pitfalls", [])[:2]

    return arch_patterns, setup_patterns, testing_strategy, common_pitfalls


def generate_part_context(
    part: Dict,
    parent_name: str,
    total_parts: int,
    data: Dict
) -> str:
    """
    Generate context block for a single part.

    Args:
        part: Part data from decomposition
        parent_name: Parent feature name
        total_parts: Total number of parts
        data: Full context data

    Returns:
        Formatted markdown context block for part
    """
    # Extract part info
    part_number = part["number"]
    part_name = part["name"]
    part_title = f"{part_name.replace('-', ' ').title()}"

    # Dependencies
    dependencies = part.get("dependencies", [])
    if dependencies:
        deps_str = ", ".join(dependencies)
    else:
        deps_str = "None"

    # Filter content relevant to this part
    arch_patterns, setup_patterns, testing_strategy, common_pitfalls = filter_content_for_part(
        part, data
    )

    # Scope items from part
    scope_items = format_bullet_list([part.get("scope", "")])

    # Format filtered content
    architecture_patterns = format_bullet_list(arch_patterns)
    setup_patterns_str = format_bullet_list(setup_patterns)
    testing_strategy_str = format_bullet_list(testing_strategy)
    common_pitfalls_str = format_bullet_list(common_pitfalls)

    # Extract scores (same for all parts - from parent research)
    coverage = data.get("coverage", {})
    coverage_score = coverage.get("overall", 0)
    arch_score = coverage.get("architecture", 0)
    setup_score = coverage.get("setup", 0)
    testing_score = coverage.get("testing", 0)
    impl_score = coverage.get("implementation", 0)

    relevance = data.get("relevance", {})
    avg_relevance = relevance.get("average", 0)

    # Generate part context
    context = PART_CONTEXT_TEMPLATE.format(
        part_title=part_title,
        parent_feature=parent_name,
        part_number=part_number,
        total_parts=total_parts,
        dependencies=deps_str,
        task_type=data.get("task_type", "FEATURE"),
        intent=part.get("scope", ""),  # Use part scope as intent
        scope_items=scope_items,
        architecture_patterns=architecture_patterns,
        setup_patterns=setup_patterns_str,
        testing_strategy=testing_strategy_str,
        common_pitfalls=common_pitfalls_str,
        coverage_score=coverage_score,
        arch_score=arch_score,
        setup_score=setup_score,
        testing_score=testing_score,
        impl_score=impl_score,
        avg_relevance=avg_relevance
    )

    return context.strip()


def generate_parts(
    decomposition: Dict,
    parent_name: str,
    data: Dict,
    base_path: Path = None
) -> List[Tuple[str, str, str]]:
    """
    Generate multiple part contexts from decomposition.

    Args:
        decomposition: Decomposition data with parts
        parent_name: Parent feature name
        data: Full context data
        base_path: Base path for feature folders (e.g., .workspace/features/)

    Returns:
        List of (feature_folder, context_path, context_content) tuples
    """
    parts = decomposition.get("parts", [])
    total_parts = len(parts)

    results = []

    for part in parts:
        # Generate part context
        context = generate_part_context(
            part,
            parent_name,
            total_parts,
            data
        )

        # Determine paths
        part_number = part["number"]
        part_name = part["name"]
        feature_name = f"{parent_name}-{part_number}-{part_name}"

        if base_path:
            feature_folder = base_path / feature_name
            context_path = feature_folder / "01-intent.md"
        else:
            feature_folder = feature_name
            context_path = f"{feature_name}/01-intent.md"

        results.append((str(feature_folder), str(context_path), context))

    return results


def main():
    parser = argparse.ArgumentParser(
        description="Generate context block for Claude Code"
    )
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument(
        "--input",
        help="Path to JSON file with context data"
    )
    group.add_argument(
        "--interactive",
        action="store_true",
        help="Interactive mode to collect data"
    )
    parser.add_argument(
        "--output",
        help="Output file (default: stdout)"
    )
    parser.add_argument(
        "--save",
        help="Save context to markdown file (e.g., docs/features/recipe-management.md)"
    )
    parser.add_argument(
        "--type",
        choices=["feature", "extend"],
        help="Type of context (feature or extend) - used with --save for subdirectory"
    )
    parser.add_argument(
        "--decomposition",
        help="Path to decomposition JSON file (for part generation)"
    )
    parser.add_argument(
        "--parent-name",
        help="Parent feature name (required with --decomposition)"
    )
    parser.add_argument(
        "--base-path",
        default=".workspace/features",
        help="Base path for feature folders (default: .workspace/features)"
    )

    args = parser.parse_args()

    # Validate decomposition args
    if args.decomposition and not args.parent_name:
        print("Error: --parent-name required when using --decomposition", file=sys.stderr)
        sys.exit(1)

    try:
        # Load or collect data
        if args.input:
            with open(args.input, 'r', encoding='utf-8') as f:
                data = json.load(f)
        else:
            data = interactive_mode()

        # Check if we're doing part generation
        if args.decomposition:
            # Load decomposition data
            with open(args.decomposition, 'r', encoding='utf-8') as f:
                decomposition = json.load(f)

            # Validate decomposition decision
            if decomposition.get("decision") != "PARTS":
                print("Error: Decomposition decision is not PARTS", file=sys.stderr)
                sys.exit(1)

            # Generate parts
            base_path = Path(args.base_path)
            part_results = generate_parts(
                decomposition,
                args.parent_name,
                data,
                base_path
            )

            # Create folders and write files
            for feature_folder, context_path, context_content in part_results:
                folder_path = Path(feature_folder)
                folder_path.mkdir(parents=True, exist_ok=True)

                context_file = Path(context_path)
                with open(context_file, 'w', encoding='utf-8') as f:
                    f.write(context_content)

                print(f"✓ {context_path}", file=sys.stderr)

            # Print summary
            print(f"\n✅ Created {len(part_results)} part features", file=sys.stderr)
            sys.exit(0)

        # Single task generation (original behavior)
        context_block = generate_context_block(data)

        # Handle --save (new functionality)
        if args.save:
            save_path = Path(args.save)

            # Create parent directory if it doesn't exist
            save_path.parent.mkdir(parents=True, exist_ok=True)

            # Write context block to file
            with open(save_path, 'w', encoding='utf-8') as f:
                f.write(context_block)

            print(f"✅ Context opgeslagen in: {args.save}", file=sys.stderr)

        # Handle --output (legacy functionality)
        elif args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(context_block)
            print(f"✅ Context block written to: {args.output}", file=sys.stderr)

        # Print to stdout if neither --save nor --output
        else:
            print("\n" + "="*60)
            print("CONTEXT FOR CLAUDE CODE")
            print("="*60 + "\n")
            print(context_block)

        sys.exit(0)

    except FileNotFoundError as e:
        print(f"Error: Input file not found: {e}", file=sys.stderr)
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in input file: {e}", file=sys.stderr)
        sys.exit(2)
    except ValueError as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(3)
    except Exception as e:
        print(f"Unexpected error: {e}", file=sys.stderr)
        sys.exit(4)


if __name__ == "__main__":
    main()

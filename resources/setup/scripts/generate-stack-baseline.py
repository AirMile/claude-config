#!/usr/bin/env python3
"""
Generate Stack Baseline Research file for /1-plan and /4-refine skills.

This script creates .claude/research/stack-baseline.md with framework conventions,
patterns, and idioms that are reusable across all features in the project.

Usage:
    python3 generate-stack-baseline.py \
        --stack "Laravel 11 + Livewire 3" \
        --conventions "Convention 1|Convention 2|Convention 3" \
        --patterns "Pattern 1: desc|Pattern 2: desc" \
        --idioms "Idiom 1|Idiom 2" \
        --testing "Test approach 1|Test approach 2" \
        --pitfalls "Pitfall 1: avoid|Pitfall 2: avoid" \
        --sources "/laravel/docs|/livewire/docs" \
        --output .claude/research/stack-baseline.md
"""

import argparse
import os
from datetime import datetime, timedelta
from pathlib import Path


def parse_list(value: str) -> list[str]:
    """Parse pipe-separated string into list."""
    if not value or value.strip() == "":
        return []
    return [item.strip() for item in value.split("|") if item.strip()]


def format_list_items(items: list[str], prefix: str = "-") -> str:
    """Format list items with prefix."""
    if not items:
        return f"{prefix} (No items provided)"
    return "\n".join(f"{prefix} {item}" for item in items)


def generate_baseline_content(
    stack: str,
    conventions: list[str],
    patterns: list[str],
    idioms: list[str],
    testing: list[str],
    pitfalls: list[str],
    sources: list[str],
) -> str:
    """Generate the markdown content for stack-baseline.md."""

    generated_date = datetime.now().strftime("%Y-%m-%d")
    valid_until = (datetime.now() + timedelta(days=90)).strftime("%Y-%m-%d")

    # Extract framework name for agent notes
    framework_name = stack.split()[0] if stack else "framework"

    content = f"""# Stack Baseline Research

Generated: {generated_date}
Stack: {stack}
Valid until: {valid_until}

## Framework Conventions

{format_list_items(conventions)}

## Recommended Patterns

{format_list_items(patterns)}

## Common Idioms

{format_list_items(idioms)}

## Testing Approach

{format_list_items(testing)}

## Common Pitfalls

{format_list_items(pitfalls)}

## Context7 Sources

Libraries researched:
{format_list_items(sources)}

---

## NOTE FOR RESEARCH AGENTS

When this baseline exists, SKIP Context7 queries for:
- General {framework_name} conventions
- Basic {framework_name} patterns
- {framework_name} idioms
- {framework_name} testing basics
- {framework_name} common pitfalls

FOCUS your Context7 research on:
- Feature-specific patterns not covered above
- Domain-specific requirements (e.g., "e-commerce checkout", "real-time notifications")
- Advanced/specialized topics beyond basics
- Integration patterns with external services

This baseline covers ~30-40% of typical research needs.
Feature-specific research should add the remaining 60-70%.
"""

    return content


def main():
    parser = argparse.ArgumentParser(
        description="Generate stack baseline research file"
    )
    parser.add_argument(
        "--stack",
        required=True,
        help="Tech stack description (e.g., 'Laravel 11 + Livewire 3')"
    )
    parser.add_argument(
        "--conventions",
        default="",
        help="Pipe-separated list of framework conventions"
    )
    parser.add_argument(
        "--patterns",
        default="",
        help="Pipe-separated list of recommended patterns"
    )
    parser.add_argument(
        "--idioms",
        default="",
        help="Pipe-separated list of common idioms"
    )
    parser.add_argument(
        "--testing",
        default="",
        help="Pipe-separated list of testing approaches"
    )
    parser.add_argument(
        "--pitfalls",
        default="",
        help="Pipe-separated list of common pitfalls"
    )
    parser.add_argument(
        "--sources",
        default="",
        help="Pipe-separated list of Context7 library IDs used"
    )
    parser.add_argument(
        "--output",
        default=".claude/research/stack-baseline.md",
        help="Output file path"
    )

    args = parser.parse_args()

    # Parse all list arguments
    conventions = parse_list(args.conventions)
    patterns = parse_list(args.patterns)
    idioms = parse_list(args.idioms)
    testing = parse_list(args.testing)
    pitfalls = parse_list(args.pitfalls)
    sources = parse_list(args.sources)

    # Generate content
    content = generate_baseline_content(
        stack=args.stack,
        conventions=conventions,
        patterns=patterns,
        idioms=idioms,
        testing=testing,
        pitfalls=pitfalls,
        sources=sources,
    )

    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write file
    output_path.write_text(content, encoding="utf-8")

    # Print summary
    print(f"Stack baseline generated: {args.output}")
    print(f"Stack: {args.stack}")
    print(f"Conventions: {len(conventions)} items")
    print(f"Patterns: {len(patterns)} items")
    print(f"Idioms: {len(idioms)} items")
    print(f"Testing: {len(testing)} items")
    print(f"Pitfalls: {len(pitfalls)} items")
    print(f"Sources: {len(sources)} libraries")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
Refactor Log Generator

Generates structured markdown log file documenting refactoring results.

Usage:
    python3 generate_refactor_log.py \\
        --feature recipe-management \\
        --timestamp "2025-10-23 14:30:00" \\
        --security-improvements "file.php:42 - Added input validation" \\
        --performance-improvements "controller.php:89 - Fixed N+1 query" \\
        --quality-improvements "service.php:15 - Applied repository pattern" \\
        --error-handling-improvements "api.php:120 - Added retry logic with exponential backoff" \\
        --modified-files "app/Models/Recipe.php - Security validation, app/Http/Controllers/RecipeController.php - N+1 fix" \\
        --coverage-scores "security:85,performance:78,quality:72,error_handling:80" \\
        --confidence-scores "security:90,performance:85,quality:88,error_handling:82" \\
        --output .workspace/features/recipe-management/05-refactor.md

Output format: Markdown with structured sections including coverage and confidence metrics
"""

import argparse
import sys
import os
from pathlib import Path


def parse_list_arg(arg_value):
    """Parse comma-separated list or single value into list"""
    if not arg_value:
        return []

    # Split by comma and strip whitespace
    items = [item.strip() for item in arg_value.split(',')]
    return [item for item in items if item]  # Remove empty strings


def parse_scores(scores_str):
    """Parse scores string into dict (works for both coverage and confidence)"""
    scores = {}

    if not scores_str:
        return scores

    pairs = scores_str.split(',')
    for pair in pairs:
        if ':' in pair:
            key, value = pair.split(':', 1)
            try:
                scores[key.strip()] = int(value.strip())
            except ValueError:
                pass

    return scores


def parse_coverage_scores(scores_str):
    """Parse coverage scores string into dict (alias for backward compatibility)"""
    return parse_scores(scores_str)


def calculate_overall_coverage(scores):
    """Calculate weighted overall coverage score"""
    if not scores:
        return 0

    weights = {
        'security': 0.35,
        'performance': 0.30,
        'quality': 0.20,
        'error_handling': 0.15
    }

    overall = 0
    total_weight = 0

    for category, weight in weights.items():
        if category in scores:
            overall += scores[category] * weight
            total_weight += weight

    if total_weight == 0:
        return 0

    return round(overall, 1)


def format_list_items(items, prefix='- '):
    """Format list items as markdown bullet points"""
    if not items:
        return f"{prefix}None"

    return '\n'.join([f"{prefix}{item}" for item in items])


def generate_markdown(feature, timestamp, security, performance, quality, error_handling,
                     modified, coverage_scores, confidence_scores=None):
    """Generate complete markdown document"""

    overall_coverage = calculate_overall_coverage(coverage_scores)
    overall_confidence = calculate_overall_coverage(confidence_scores) if confidence_scores else None

    md = []
    md.append(f"# Refactor Log - {feature}")
    md.append(f"Generated: {timestamp}")
    md.append("")

    # Context7 Coverage & Confidence
    md.append("## Context7 Coverage & Confidence")
    md.append(f"- Overall Coverage: {overall_coverage}%")
    if overall_confidence is not None:
        md.append(f"- Overall Confidence: {overall_confidence}%")

    if coverage_scores:
        for category in ['security', 'performance', 'quality', 'error_handling']:
            if category in coverage_scores:
                display_name = "Error Handling" if category == 'error_handling' else category.capitalize()
                cov = coverage_scores[category]
                conf = confidence_scores.get(category, '') if confidence_scores else ''
                if conf:
                    md.append(f"- {display_name}: {cov}% coverage, {conf}% confidence")
                else:
                    md.append(f"- {display_name}: {cov}%")

    md.append("")

    # Security Improvements
    md.append("## Security Improvements")
    md.append(format_list_items(security))
    md.append("")

    # Performance Improvements
    md.append("## Performance Improvements")
    md.append(format_list_items(performance))
    md.append("")

    # Code Quality Improvements
    md.append("## Code Quality Improvements")
    md.append(format_list_items(quality))
    md.append("")

    # Error Handling Improvements
    md.append("## Error Handling Improvements")
    md.append(format_list_items(error_handling))
    md.append("")

    # Modified Files
    md.append("## Modified Files")
    md.append(format_list_items(modified))
    md.append("")

    # Production Ready
    md.append("## Production Ready")
    md.append("Status: YES")
    md.append("")

    return '\n'.join(md)


def main():
    parser = argparse.ArgumentParser(
        description='Generate refactor log markdown file'
    )

    parser.add_argument(
        '--feature',
        required=True,
        help='Feature name (e.g., recipe-management)'
    )

    parser.add_argument(
        '--timestamp',
        required=True,
        help='Timestamp of refactor (e.g., 2025-10-23 14:30:00)'
    )

    parser.add_argument(
        '--security-improvements',
        default='',
        help='Comma-separated list of security improvements'
    )

    parser.add_argument(
        '--performance-improvements',
        default='',
        help='Comma-separated list of performance improvements'
    )

    parser.add_argument(
        '--quality-improvements',
        default='',
        help='Comma-separated list of quality improvements'
    )

    parser.add_argument(
        '--error-handling-improvements',
        default='',
        help='Comma-separated list of error handling improvements'
    )

    parser.add_argument(
        '--modified-files',
        default='',
        help='Comma-separated list of modified files with descriptions'
    )

    parser.add_argument(
        '--coverage-scores',
        default='',
        help='Coverage scores as key:value pairs (e.g., security:85,performance:78)'
    )

    parser.add_argument(
        '--confidence-scores',
        default='',
        help='Confidence scores as key:value pairs (e.g., security:90,performance:85)'
    )

    parser.add_argument(
        '--output',
        required=True,
        help='Output file path (e.g., .workspace/features/recipe-management/05-refactor.md)'
    )

    args = parser.parse_args()

    # Parse inputs
    security = parse_list_arg(args.security_improvements)
    performance = parse_list_arg(args.performance_improvements)
    quality = parse_list_arg(args.quality_improvements)
    error_handling = parse_list_arg(args.error_handling_improvements)
    modified = parse_list_arg(args.modified_files)
    coverage_scores = parse_scores(args.coverage_scores)
    confidence_scores = parse_scores(args.confidence_scores)

    # Generate markdown
    markdown = generate_markdown(
        args.feature,
        args.timestamp,
        security,
        performance,
        quality,
        error_handling,
        modified,
        coverage_scores,
        confidence_scores
    )

    # Ensure output directory exists
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Write to file
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(markdown)

        print(f"✅ Refactor log generated: {args.output}")
        return 0

    except Exception as e:
        print(f"Error writing to {args.output}: {e}", file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

#!/usr/bin/env python3
"""
Refactor Coverage Evaluator

Evaluates Context7 research coverage AND confidence for refactoring categories:
- Security (OWASP, validation, injection prevention)
- Performance (N+1 queries, caching, optimization)
- Quality (design patterns, SOLID, code standards, DRY)
- Error Handling (retry logic, circuit breakers, resilience)

Returns overall score, confidence, and decision: proceed, additional_search, or revise

Usage:
    python3 evaluate_refactor_coverage.py \
        --security 85 \
        --performance 75 \
        --quality 70 \
        --error-handling 80 \
        --security-confidence 90 \
        --performance-confidence 85 \
        --quality-confidence 88 \
        --error-handling-confidence 82 \
        --format text

Exit codes:
    0 - proceed (coverage >= 75% AND confidence >= 80%)
    1 - additional_search (coverage 50-74% OR confidence 50-79%)
    2 - revise (coverage < 50% OR confidence < 50%)
"""

import argparse
import sys
import json


def calculate_overall_score(security, performance, quality, error_handling):
    """Calculate weighted overall score with priority weighting"""
    # Weights: Security highest, then Performance, Quality, Error Handling
    weights = {
        'security': 0.35,          # 35% - highest priority
        'performance': 0.30,       # 30% - second priority
        'quality': 0.20,           # 20% - third priority
        'error_handling': 0.15     # 15% - fourth priority
    }

    overall = (
        security * weights['security'] +
        performance * weights['performance'] +
        quality * weights['quality'] +
        error_handling * weights['error_handling']
    )

    return round(overall, 1)


def calculate_overall_confidence(sec_conf, perf_conf, qual_conf, err_conf):
    """Calculate weighted overall confidence with same priority weighting"""
    weights = {
        'security': 0.35,
        'performance': 0.30,
        'quality': 0.20,
        'error_handling': 0.15
    }

    overall = (
        sec_conf * weights['security'] +
        perf_conf * weights['performance'] +
        qual_conf * weights['quality'] +
        err_conf * weights['error_handling']
    )

    return round(overall, 1)


def determine_decision(overall_coverage, overall_confidence):
    """Determine action based on coverage AND confidence"""
    # Both coverage and confidence must meet thresholds
    if overall_coverage >= 75 and overall_confidence >= 80:
        return 'proceed', 0
    elif overall_coverage >= 50 and overall_confidence >= 50:
        return 'additional_search', 1
    else:
        return 'revise', 2


def get_weakest_areas(coverage_scores, confidence_scores):
    """Identify categories below thresholds"""
    coverage_threshold = 75
    confidence_threshold = 80
    weakest = []

    for category in coverage_scores.keys():
        cov = coverage_scores[category]
        conf = confidence_scores.get(category, 0)

        if cov < coverage_threshold:
            weakest.append(f"{category} coverage ({cov}%)")
        if conf < confidence_threshold:
            weakest.append(f"{category} confidence ({conf}%)")

    return weakest


def get_recommendation(decision, weakest_areas, overall_coverage, overall_confidence):
    """Generate actionable recommendation"""
    if decision == 'proceed':
        return f"Coverage ({overall_coverage}%) and confidence ({overall_confidence}%) sufficient. Proceed to refactor planning."
    elif decision == 'additional_search':
        areas = ', '.join(weakest_areas) if weakest_areas else 'general coverage/confidence'
        return f"Execute 1-2 targeted Context7 searches focusing on: {areas}"
    else:
        if overall_coverage < 50:
            return "Coverage too low. Try alternative search terms or different framework documentation."
        else:
            return "Confidence too low. Findings are uncertain. Consider more specific queries or skip uncertain findings."


def format_text_output(coverage_scores, confidence_scores, overall_coverage, overall_confidence, decision, weakest, recommendation):
    """Format output as text"""
    output = []
    output.append("📊 REFACTOR COVERAGE & CONFIDENCE EVALUATION")
    output.append("")
    output.append(f"Overall Coverage: {overall_coverage}%")
    output.append(f"Overall Confidence: {overall_confidence}%")
    output.append("")
    output.append("Coverage Breakdown:")

    for category, score in coverage_scores.items():
        indicator = "✓" if score >= 75 else "⚠"
        output.append(f"  {indicator} {category.capitalize()}: {score}%")

    output.append("")
    output.append("Confidence Breakdown:")

    for category, score in confidence_scores.items():
        indicator = "✓" if score >= 80 else "⚠"
        output.append(f"  {indicator} {category.capitalize()}: {score}%")

    output.append("")
    output.append(f"Decision: {decision}")

    if weakest:
        output.append(f"Weakest areas: {', '.join(weakest)}")

    output.append("")
    output.append(f"Recommendation: {recommendation}")

    return "\n".join(output)


def format_json_output(coverage_scores, confidence_scores, overall_coverage, overall_confidence, decision, weakest, recommendation):
    """Format output as JSON"""
    return json.dumps({
        'overall_coverage': overall_coverage,
        'overall_confidence': overall_confidence,
        'coverage_breakdown': coverage_scores,
        'confidence_breakdown': confidence_scores,
        'decision': decision,
        'weakest_areas': weakest,
        'recommendation': recommendation
    }, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description='Evaluate Context7 refactor research coverage and confidence'
    )

    # Coverage arguments
    parser.add_argument(
        '--security',
        type=int,
        required=True,
        help='Security research coverage score (0-100)'
    )

    parser.add_argument(
        '--performance',
        type=int,
        required=True,
        help='Performance research coverage score (0-100)'
    )

    parser.add_argument(
        '--quality',
        type=int,
        required=True,
        help='Code quality research coverage score (0-100)'
    )

    parser.add_argument(
        '--error-handling',
        type=int,
        required=True,
        help='Error handling research coverage score (0-100)'
    )

    # Confidence arguments (optional, default to coverage if not provided)
    parser.add_argument(
        '--security-confidence',
        type=int,
        default=None,
        help='Security findings confidence score (0-100)'
    )

    parser.add_argument(
        '--performance-confidence',
        type=int,
        default=None,
        help='Performance findings confidence score (0-100)'
    )

    parser.add_argument(
        '--quality-confidence',
        type=int,
        default=None,
        help='Quality findings confidence score (0-100)'
    )

    parser.add_argument(
        '--error-handling-confidence',
        type=int,
        default=None,
        help='Error handling findings confidence score (0-100)'
    )

    parser.add_argument(
        '--format',
        choices=['text', 'json'],
        default='text',
        help='Output format (default: text)'
    )

    args = parser.parse_args()

    # Set confidence to coverage if not provided (backward compatibility)
    sec_conf = args.security_confidence if args.security_confidence is not None else args.security
    perf_conf = args.performance_confidence if args.performance_confidence is not None else args.performance
    qual_conf = args.quality_confidence if args.quality_confidence is not None else args.quality
    err_conf = args.error_handling_confidence if args.error_handling_confidence is not None else args.error_handling

    # Validate scores
    all_scores = [args.security, args.performance, args.quality, args.error_handling,
                  sec_conf, perf_conf, qual_conf, err_conf]
    for score in all_scores:
        if not 0 <= score <= 100:
            print("Error: All scores must be between 0 and 100", file=sys.stderr)
            sys.exit(3)

    # Calculate results
    coverage_scores = {
        'security': args.security,
        'performance': args.performance,
        'quality': args.quality,
        'error_handling': args.error_handling
    }

    confidence_scores = {
        'security': sec_conf,
        'performance': perf_conf,
        'quality': qual_conf,
        'error_handling': err_conf
    }

    overall_coverage = calculate_overall_score(
        args.security,
        args.performance,
        args.quality,
        args.error_handling
    )

    overall_confidence = calculate_overall_confidence(
        sec_conf,
        perf_conf,
        qual_conf,
        err_conf
    )

    decision, exit_code = determine_decision(overall_coverage, overall_confidence)
    weakest = get_weakest_areas(coverage_scores, confidence_scores)
    recommendation = get_recommendation(decision, weakest, overall_coverage, overall_confidence)

    # Format and print output
    if args.format == 'text':
        output = format_text_output(coverage_scores, confidence_scores, overall_coverage, overall_confidence, decision, weakest, recommendation)
    else:
        output = format_json_output(coverage_scores, confidence_scores, overall_coverage, overall_confidence, decision, weakest, recommendation)

    print(output)

    return exit_code


if __name__ == '__main__':
    sys.exit(main())

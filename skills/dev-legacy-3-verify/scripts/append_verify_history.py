#!/usr/bin/env python3
"""
Append debug history to 01-intent.md when starting from scratch.

Usage:
    python append_debug_history.py <feature_name> <timestamp> <total_attempts> <attempt_summaries_json>
"""

import sys
import json
from pathlib import Path
from typing import List, Dict


def append_debug_history(
    feature_name: str,
    timestamp: str,
    total_attempts: int,
    attempt_summaries: List[Dict[str, str]],
    failure_reasons: List[str],
    lessons_learned: List[str],
    recommendations: List[str],
    scratch_type: str = "IMPLEMENTATION"
) -> str:
    """
    Append debug history section to 01-intent.md.

    Args:
        feature_name: Name of the feature
        timestamp: When scratch decision was made
        total_attempts: Number of debug attempts made
        attempt_summaries: List of dicts with attempt number and brief description
        failure_reasons: List of why implementation failed
        lessons_learned: List of insights from debug attempts
        recommendations: List of recommendations for next step
        scratch_type: ARCHITECTURAL or IMPLEMENTATION (default: IMPLEMENTATION)

    Returns:
        Path to updated context file
    """

    # Construct path
    context_file = Path(".workspace/features") / feature_name / "01-intent.md"

    if not context_file.exists():
        raise FileNotFoundError(f"Context file not found: {context_file}")

    # Generate debug history section
    next_step = "/1-plan" if scratch_type == "ARCHITECTURAL" else "/2-code"

    debug_history = f"""

---

## Debug History - Failed Implementation Attempt

**Date:** {timestamp}
**Total attempts made:** {total_attempts}
**Scratch Type:** {scratch_type}
**Recommended Next Step:** Run `{next_step}`

### Summary of Attempts

"""

    # Add attempt summaries
    for attempt in attempt_summaries:
        debug_history += f"- **Attempt {attempt['number']}:** {attempt['description']}\n"

    debug_history += "\n### Why Implementation Failed\n\n"

    # Add failure reasons
    for reason in failure_reasons:
        debug_history += f"- {reason}\n"

    debug_history += "\n### Lessons Learned\n\n"

    # Add lessons
    for lesson in lessons_learned:
        debug_history += f"- {lesson}\n"

    # Recommendations section title depends on scratch type
    if scratch_type == "ARCHITECTURAL":
        debug_history += "\n### Recommendations for /1-plan (Architectural Review)\n\n"
    else:
        debug_history += "\n### Recommendations for Next /2-code Attempt\n\n"

    # Add recommendations
    for rec in recommendations:
        debug_history += f"- {rec}\n"

    # Append to file
    with open(context_file, 'a', encoding='utf-8') as f:
        f.write(debug_history)

    return str(context_file)


def main():
    if len(sys.argv) < 4:
        print("Usage: python append_debug_history.py <feature_name> <timestamp> <total_attempts> [<data_json>]")
        print("  data_json: JSON with attempt_summaries, failure_reasons, lessons_learned, recommendations, scratch_type")
        sys.exit(1)

    feature_name = sys.argv[1]
    timestamp = sys.argv[2]
    total_attempts = int(sys.argv[3])

    # Parse JSON data if provided, otherwise use defaults
    if len(sys.argv) > 4:
        data = json.loads(sys.argv[4])
        attempt_summaries = data.get('attempt_summaries', [])
        failure_reasons = data.get('failure_reasons', [])
        lessons_learned = data.get('lessons_learned', [])
        recommendations = data.get('recommendations', [])
        scratch_type = data.get('scratch_type', 'IMPLEMENTATION')
    else:
        # Defaults for manual usage
        attempt_summaries = [
            {"number": i, "description": f"Attempt {i} description"}
            for i in range(1, total_attempts + 1)
        ]
        failure_reasons = ["Root cause analysis needed"]
        lessons_learned = ["Insights from debugging"]
        recommendations = ["Consider different approach"]
        scratch_type = "IMPLEMENTATION"

    try:
        context_file = append_debug_history(
            feature_name,
            timestamp,
            total_attempts,
            attempt_summaries,
            failure_reasons,
            lessons_learned,
            recommendations,
            scratch_type
        )
        print(f"✓ Debug history appended to: {context_file}")
        print(f"✓ Scratch type: {scratch_type}")
        print(f"✓ Recommended next step: {'/1-plan' if scratch_type == 'ARCHITECTURAL' else '/2-code'}")
    except Exception as e:
        print(f"✗ Error appending debug history: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

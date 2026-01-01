#!/usr/bin/env python3
"""
Generate standardized attempt log file for debug attempts.

Usage:
    python create_attempt_log.py <feature_name> <attempt_number> <timestamp>
"""

import sys
import os
from pathlib import Path


def create_attempt_log(feature_name: str, attempt_number: int, timestamp: str) -> str:
    """
    Generate attempt log template.

    Args:
        feature_name: Name of the feature being debugged
        attempt_number: Current attempt number
        timestamp: Current timestamp

    Returns:
        Path to created attempt log file
    """

    # Construct path
    features_dir = Path(".workspace/features") / feature_name / "04-debug"
    features_dir.mkdir(parents=True, exist_ok=True)

    attempt_file = features_dir / f"attempt-{attempt_number:02d}.md"

    # Generate template
    template = f"""# Debug Attempt {attempt_number} - {feature_name}

**Timestamp:** {timestamp}
**Status:** In Progress

## Failure Analysis

### Test Failures Identified
<!-- Automated test failures, Chrome Extension test failures, Manual test failures -->

### Error Patterns
<!-- Grouped failures by root cause -->

### Files/Functions Involved
<!-- Which parts of the codebase are affected -->

## Context7 Research

### Search Queries Used
<!-- List of Context7 searches performed -->

### Findings
<!-- Key patterns and solutions found -->

### Relevance Score
<!-- Overall Context7 research quality: X% -->

## Debug Plan

### Root Cause Hypothesis
<!-- Description of likely root cause -->

### Fix Approach
1. <!-- First change to make -->
2. <!-- Second change to make -->
3. <!-- Third change to make -->

### Files to Modify
- <!-- file path --> - <!-- what to change -->
- <!-- file path --> - <!-- what to change -->

### Estimated Impact
<!-- Low / Medium / High -->

## Changes Applied

### Modified Files
- <!-- file path --> - <!-- change description -->
- <!-- file path --> - <!-- change description -->

### Deviations from Plan
<!-- Any changes made differently than planned -->

## Test Results

### Automated Tests
- Total tests: <!-- count -->
- Passed: <!-- count -->
- Failed: <!-- count -->
- Errors: <!-- list if any -->

### Test Plan Generated
<!-- Reference to 3-level test plan in this file or separate section -->

## Manual Test Plan

### Chrome Extension Tests

**Copy-paste this prompt into Claude Chrome Extension:**

```
Test the following fixed user flows on [URL]:

1. [User Flow 1 that was broken]
   - Step 1: [action]
   - Step 2: [action]
   - Expected: [result]
   - Verify fix: [what should work now]

2. [User Flow 2]
   - Step 1: [action]
   - Expected: [result]
```

### Manual Visual Tests

**Visual Regression:**
1. Navigate to [page that had issues]
2. Verify [visual element is fixed]
3. Check [responsive behavior]
4. Validate [interaction that failed before]

## User Feedback

### Chrome Extension Test Results
<!-- User provides results after testing -->

### Manual Test Results
<!-- User provides visual test results -->

### Additional Observations
<!-- Any other issues found or unexpected behavior -->

## Decision

### Overall Test Status
<!-- SUCCESS / PARTIAL / FAILURE -->

### Decision Made
<!-- Continue / Scratch / Success -->

### Reasoning
<!-- Why this decision was made -->

### Next Steps
<!-- What happens next based on decision -->
"""

    # Write file
    with open(attempt_file, 'w', encoding='utf-8') as f:
        f.write(template)

    return str(attempt_file)


def main():
    if len(sys.argv) != 4:
        print("Usage: python create_attempt_log.py <feature_name> <attempt_number> <timestamp>")
        sys.exit(1)

    feature_name = sys.argv[1]
    attempt_number = int(sys.argv[2])
    timestamp = sys.argv[3]

    try:
        attempt_file = create_attempt_log(feature_name, attempt_number, timestamp)
        print(f"✓ Attempt log created: {attempt_file}")
    except Exception as e:
        print(f"✗ Error creating attempt log: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

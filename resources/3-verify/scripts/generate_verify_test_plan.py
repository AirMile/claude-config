#!/usr/bin/env python3
"""
Generate 3-level test plan after debug fix is applied.

Usage:
    python generate_debug_test_plan.py <feature_name> <attempt_number> <timestamp> <test_data_json>
"""

import sys
import json
from pathlib import Path
from typing import Dict, List


def generate_test_plan(
    feature_name: str,
    attempt_number: int,
    timestamp: str,
    automated_results: Dict,
    chrome_tests: List[Dict],
    manual_tests: List[Dict],
    url: str = "[URL]"
) -> str:
    """
    Generate 3-level test plan.

    Args:
        feature_name: Name of the feature
        attempt_number: Current attempt number
        timestamp: Current timestamp
        automated_results: Dict with test counts and failures
        chrome_tests: List of chrome extension test scenarios
        manual_tests: List of manual test scenarios
        url: Application URL for testing

    Returns:
        Test plan markdown content
    """

    test_plan = f"""# Debug Test Plan - Attempt {attempt_number}

**Feature:** {feature_name}
**Generated:** {timestamp}

---

## Automated Tests (Claude Code Executed)

### Results:
- **Total tests:** {automated_results.get('total', 0)}
- **Passed:** {automated_results.get('passed', 0)}
- **Failed:** {automated_results.get('failed', 0)}

"""

    # Add errors if any
    if automated_results.get('errors'):
        test_plan += "### Errors:\n"
        for error in automated_results['errors']:
            test_plan += f"- {error}\n"
        test_plan += "\n"

    # Add failure details if any
    if automated_results.get('failures'):
        test_plan += "### Failed Tests:\n"
        for failure in automated_results['failures']:
            test_plan += f"- **{failure.get('test', 'Unknown')}**: {failure.get('message', 'No message')}\n"
        test_plan += "\n"

    test_plan += """---

## Manual Tests - Claude Chrome Extension

**Instructions:** Copy-paste the prompt below into Claude Chrome Extension to test the fixed functionality.

### Test Prompt:

```
Test the following fixed user flows on """ + url + """:

"""

    # Add chrome extension tests
    for i, test in enumerate(chrome_tests, 1):
        test_plan += f"{i}. **{test.get('name', 'User Flow')}**\n"
        for step_num, step in enumerate(test.get('steps', []), 1):
            test_plan += f"   - Step {step_num}: {step}\n"
        test_plan += f"   - **Expected:** {test.get('expected', 'Success')}\n"
        if test.get('verify'):
            test_plan += f"   - **Verify fix:** {test['verify']}\n"
        test_plan += "\n"

    test_plan += """```

**After testing:** Report results back with pass/fail status for each flow.

---

## Manual Tests - User Executes

### Visual Regression Tests

"""

    # Add manual visual tests
    for i, test in enumerate(manual_tests, 1):
        test_plan += f"{i}. **{test.get('name', 'Visual Test')}**\n"
        for step_num, step in enumerate(test.get('steps', []), 1):
            test_plan += f"   - {step}\n"
        if test.get('expected'):
            test_plan += f"   - **Expected:** {test['expected']}\n"
        test_plan += "\n"

    test_plan += """---

## Feedback Template

When you've completed the Chrome Extension and Manual tests, provide feedback in this format:

```
Chrome Extension tests:
- Flow 1: ✓ Passed / ✗ Failed - [details]
- Flow 2: ✓ Passed / ✗ Failed - [details]

Manual tests:
- Test 1: ✓ Passed / ✗ Failed - [details]
- Test 2: ✓ Passed / ✗ Failed - [details]

Additional observations:
- [any other issues found]
```
"""

    return test_plan


def main():
    if len(sys.argv) < 5:
        print("Usage: python generate_debug_test_plan.py <feature_name> <attempt_number> <timestamp> <test_data_json>")
        print("  test_data_json: JSON with automated_results, chrome_tests, manual_tests, url")
        sys.exit(1)

    feature_name = sys.argv[1]
    attempt_number = int(sys.argv[2])
    timestamp = sys.argv[3]
    test_data = json.loads(sys.argv[4])

    automated_results = test_data.get('automated_results', {
        'total': 0,
        'passed': 0,
        'failed': 0,
        'errors': [],
        'failures': []
    })

    chrome_tests = test_data.get('chrome_tests', [
        {
            'name': 'Fixed user flow',
            'steps': ['Action 1', 'Action 2'],
            'expected': 'Success',
            'verify': 'What should work now'
        }
    ])

    manual_tests = test_data.get('manual_tests', [
        {
            'name': 'Visual test',
            'steps': ['Navigate to page', 'Verify element'],
            'expected': 'Element displays correctly'
        }
    ])

    url = test_data.get('url', '[URL]')

    try:
        test_plan = generate_test_plan(
            feature_name,
            attempt_number,
            timestamp,
            automated_results,
            chrome_tests,
            manual_tests,
            url
        )
        print(test_plan)
    except Exception as e:
        print(f"✗ Error generating test plan: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

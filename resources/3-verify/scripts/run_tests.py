#!/usr/bin/env python3
"""
Universal test runner that detects and executes tests for various frameworks.

Supports:
- Laravel: pest, phpunit
- Node.js: jest, vitest, mocha
- Python: pytest, unittest
- Others: detects from project config

Usage:
    python run_tests.py [--framework <framework>] [--output-json]
"""

import subprocess
import sys
import json
import os
from pathlib import Path
from typing import Dict, Optional, Tuple


class TestRunner:
    """Universal test runner for multiple frameworks."""

    def __init__(self):
        self.framework = None
        self.command = None

    def detect_framework(self) -> Optional[str]:
        """
        Auto-detect test framework from project files.

        Returns:
            Framework name or None if not detected
        """

        # Check for Laravel (pest/phpunit)
        if Path("artisan").exists() or Path("composer.json").exists():
            if Path("vendor/bin/pest").exists():
                self.framework = "pest"
                self.command = ["./vendor/bin/pest"]
                return "pest"
            elif Path("vendor/bin/phpunit").exists():
                self.framework = "phpunit"
                self.command = ["./vendor/bin/phpunit"]
                return "phpunit"

        # Check for Node.js frameworks
        if Path("package.json").exists():
            try:
                with open("package.json") as f:
                    package = json.load(f)
                    scripts = package.get("scripts", {})
                    dev_deps = package.get("devDependencies", {})

                    # Check for test script
                    if "test" in scripts:
                        test_script = scripts["test"]

                        if "jest" in test_script or "jest" in dev_deps:
                            self.framework = "jest"
                            self.command = ["npm", "test"]
                            return "jest"
                        elif "vitest" in test_script or "vitest" in dev_deps:
                            self.framework = "vitest"
                            self.command = ["npm", "test"]
                            return "vitest"
                        elif "mocha" in test_script or "mocha" in dev_deps:
                            self.framework = "mocha"
                            self.command = ["npm", "test"]
                            return "mocha"
            except Exception:
                pass

        # Check for Python frameworks
        if Path("pytest.ini").exists() or Path("setup.py").exists():
            # Try pytest first
            if subprocess.run(["which", "pytest"], capture_output=True).returncode == 0:
                self.framework = "pytest"
                self.command = ["pytest"]
                return "pytest"
            # Fallback to unittest
            elif subprocess.run(["which", "python3"], capture_output=True).returncode == 0:
                self.framework = "unittest"
                self.command = ["python3", "-m", "unittest", "discover"]
                return "unittest"

        return None

    def run_tests(self) -> Tuple[int, str, str]:
        """
        Execute tests using detected framework.

        Returns:
            Tuple of (return_code, stdout, stderr)
        """
        if not self.command:
            raise RuntimeError("No test framework detected or specified")

        try:
            result = subprocess.run(
                self.command,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return 1, "", "Test execution timeout (5 minutes)"
        except Exception as e:
            return 1, "", f"Error running tests: {str(e)}"

    def parse_output(self, stdout: str, stderr: str, return_code: int) -> Dict:
        """
        Parse test output into structured format.

        Args:
            stdout: Standard output from test run
            stderr: Standard error from test run
            return_code: Exit code from test command

        Returns:
            Dict with parsed test results
        """
        result = {
            "framework": self.framework,
            "success": return_code == 0,
            "return_code": return_code,
            "total": 0,
            "passed": 0,
            "failed": 0,
            "errors": [],
            "failures": [],
            "raw_output": stdout + stderr
        }

        # Framework-specific parsing
        if self.framework in ["pest", "phpunit"]:
            result.update(self._parse_php_output(stdout, stderr))
        elif self.framework in ["jest", "vitest", "mocha"]:
            result.update(self._parse_node_output(stdout, stderr))
        elif self.framework in ["pytest", "unittest"]:
            result.update(self._parse_python_output(stdout, stderr))

        return result

    def _parse_php_output(self, stdout: str, stderr: str) -> Dict:
        """Parse PHP test output (pest/phpunit)."""
        data = {}

        # Simple parsing - look for test counts
        output = stdout + stderr

        if "OK" in output or "PASS" in output:
            # Extract test count if possible
            import re
            match = re.search(r'(\d+)\s+test', output, re.IGNORECASE)
            if match:
                count = int(match.group(1))
                data["total"] = count
                data["passed"] = count
                data["failed"] = 0
        else:
            # Look for failure indicators
            if "FAIL" in output or "FAILED" in output:
                match = re.search(r'(\d+)\s+failed', output, re.IGNORECASE)
                if match:
                    data["failed"] = int(match.group(1))

        return data

    def _parse_node_output(self, stdout: str, stderr: str) -> Dict:
        """Parse Node.js test output (jest/vitest/mocha)."""
        data = {}
        output = stdout + stderr

        # Look for jest/vitest summary
        import re

        # Pattern: "Tests: X passed, Y total"
        match = re.search(r'Tests:\s+(\d+)\s+passed.*?(\d+)\s+total', output)
        if match:
            data["passed"] = int(match.group(1))
            data["total"] = int(match.group(2))
            data["failed"] = data["total"] - data["passed"]

        # Pattern: "X failing"
        match = re.search(r'(\d+)\s+failing', output)
        if match:
            data["failed"] = int(match.group(1))

        return data

    def _parse_python_output(self, stdout: str, stderr: str) -> Dict:
        """Parse Python test output (pytest/unittest)."""
        data = {}
        output = stdout + stderr

        import re

        # Pytest pattern: "X passed in Y seconds"
        match = re.search(r'(\d+)\s+passed', output)
        if match:
            data["passed"] = int(match.group(1))
            data["total"] = data["passed"]

        # Pattern: "X failed"
        match = re.search(r'(\d+)\s+failed', output)
        if match:
            data["failed"] = int(match.group(1))
            data["total"] = data.get("total", 0) + data["failed"]

        return data


def main():
    output_json = "--output-json" in sys.argv
    framework_arg = None

    # Check for framework argument
    if "--framework" in sys.argv:
        idx = sys.argv.index("--framework")
        if idx + 1 < len(sys.argv):
            framework_arg = sys.argv[idx + 1]

    runner = TestRunner()

    # Detect or use specified framework
    if framework_arg:
        runner.framework = framework_arg
        # Set command based on framework
        framework_commands = {
            "pest": ["./vendor/bin/pest"],
            "phpunit": ["./vendor/bin/phpunit"],
            "jest": ["npm", "test"],
            "vitest": ["npm", "test"],
            "mocha": ["npm", "test"],
            "pytest": ["pytest"],
            "unittest": ["python3", "-m", "unittest", "discover"]
        }
        runner.command = framework_commands.get(framework_arg)
        if not runner.command:
            print(f"Unknown framework: {framework_arg}", file=sys.stderr)
            sys.exit(1)
    else:
        detected = runner.detect_framework()
        if not detected:
            print("Could not detect test framework. Use --framework to specify.", file=sys.stderr)
            print("Supported: pest, phpunit, jest, vitest, mocha, pytest, unittest", file=sys.stderr)
            sys.exit(1)

    # Run tests
    return_code, stdout, stderr = runner.run_tests()

    # Parse results
    results = runner.parse_output(stdout, stderr, return_code)

    # Output results
    if output_json:
        print(json.dumps(results, indent=2))
    else:
        print(f"Framework: {results['framework']}")
        print(f"Total: {results['total']}")
        print(f"Passed: {results['passed']}")
        print(f"Failed: {results['failed']}")
        print(f"Success: {results['success']}")
        if results['errors']:
            print("\nErrors:")
            for error in results['errors']:
                print(f"  - {error}")
        if not results['success']:
            print("\nRaw output:")
            print(results['raw_output'])

    sys.exit(0 if results['success'] else 1)


if __name__ == "__main__":
    main()

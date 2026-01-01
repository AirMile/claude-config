#!/usr/bin/env python3
"""
Generate TESTS.md with comprehensive test plan.
Includes automated tests (unit, API) and manual tests (visual).
"""

import os
import sys
from datetime import datetime


def get_current_date():
    """Get current date in YYYY-MM-DD format."""
    return datetime.now().strftime("%Y-%m-%d")


def analyze_files_for_tests(file_paths):
    """Analyze modified files to determine what needs testing."""
    test_info = {
        'controllers': [],
        'api_endpoints': [],
        'components': [],
        'services': [],
        'models': []
    }
    
    for file_path in file_paths:
        file_lower = file_path.lower()
        
        if 'controller' in file_lower:
            test_info['controllers'].append(file_path)
        
        if 'api' in file_lower or 'route' in file_lower:
            test_info['api_endpoints'].append(file_path)
        
        if 'component' in file_lower or 'view' in file_lower or '.jsx' in file_lower or '.vue' in file_lower:
            test_info['components'].append(file_path)
        
        if 'service' in file_lower:
            test_info['services'].append(file_path)
        
        if 'model' in file_lower or 'entity' in file_lower:
            test_info['models'].append(file_path)
    
    return test_info


def generate_unit_tests_section(test_info):
    """Generate unit tests section."""
    section = """### Unit Tests

"""
    
    if test_info['controllers']:
        section += "**Controller Tests:**\n"
        for controller in test_info['controllers']:
            section += f"- [ ] Test {os.path.basename(controller)} methods\n"
            section += f"  - Verify input validation\n"
            section += f"  - Test error handling\n"
            section += f"  - Check return values\n"
        section += "\n"
    
    if test_info['services']:
        section += "**Service Tests:**\n"
        for service in test_info['services']:
            section += f"- [ ] Test {os.path.basename(service)} business logic\n"
            section += f"  - Test happy path scenarios\n"
            section += f"  - Test edge cases\n"
        section += "\n"
    
    if test_info['models']:
        section += "**Model Tests:**\n"
        for model in test_info['models']:
            section += f"- [ ] Test {os.path.basename(model)} validation\n"
            section += f"  - Test required fields\n"
            section += f"  - Test constraints\n"
        section += "\n"
    
    if not any([test_info['controllers'], test_info['services'], test_info['models']]):
        section += "*No unit tests identified*\n\n"
    
    return section


def generate_api_tests_section(test_info):
    """Generate API tests section."""
    section = """### API Tests

"""
    
    if test_info['api_endpoints']:
        for endpoint in test_info['api_endpoints']:
            section += f"**{os.path.basename(endpoint)}:**\n"
            section += f"- [ ] Test GET requests\n"
            section += f"  - Verify successful responses\n"
            section += f"  - Test with valid/invalid parameters\n"
            section += f"- [ ] Test POST requests\n"
            section += f"  - Verify data creation\n"
            section += f"  - Test validation errors\n"
            section += f"- [ ] Test authentication/authorization\n"
            section += f"  - Verify protected endpoints\n"
            section += f"  - Test unauthorized access\n"
            section += "\n"
    else:
        section += "*No API tests identified*\n\n"
    
    return section


def generate_visual_tests_section(test_info):
    """Generate visual regression tests section."""
    section = """### Visual Regression Tests

**Instructions for manual testing:**

"""

    if test_info['components']:
        for component in test_info['components']:
            component_name = os.path.basename(component).replace('.jsx', '').replace('.vue', '').replace('.js', '')
            section += f"**{component_name} Component:**\n"
            section += f"1. Navigate to the page with {component_name}\n"
            section += f"2. Verify layout + responsive behavior (mobile/desktop)\n"
            section += f"3. Test all interactions (buttons, forms, hover states)\n"
            section += f"\n"
    else:
        section += "1. Navigate to modified pages\n"
        section += "2. Verify layout + responsive behavior (mobile/desktop)\n"
        section += "3. Test all interactive elements\n"
        section += "\n"

    return section


def generate_test_plan(file_paths, feature_name="Feature"):
    """Generate complete TESTS.md content."""
    date = get_current_date()
    
    # Analyze files
    test_info = analyze_files_for_tests(file_paths)
    
    content = f"""# Test Plan - {feature_name}

Generated: {date}

## Manual Tests (User Executes)

These tests require human verification.

{generate_visual_tests_section(test_info)}

---

## Automated Tests (Claude Code Executes)

These tests should be written and executed by Claude Code.

{generate_unit_tests_section(test_info)}

{generate_api_tests_section(test_info)}

---

## Test Results

*Record test results here after execution*

### Manual Tests
- Visual Tests: ☐ Completed

### Automated Tests
- Unit Tests: __ / __ passed
- API Tests: __ / __ passed

### Issues Found
*List any issues discovered during testing*

---

*This file was automatically generated by the /2-code skill*
"""
    
    return content


def main():
    """Main entry point."""
    if len(sys.argv) < 2:
        print("Usage: python generate_test_plan.py <file1> [file2] ... [--feature-name='Feature Name']")
        print("Example: python generate_test_plan.py src/UserController.js --feature-name='User Management'")
        sys.exit(1)
    
    # Parse arguments
    file_paths = []
    feature_name = "Feature"
    
    for arg in sys.argv[1:]:
        if arg.startswith('--feature-name='):
            feature_name = arg.split('=', 1)[1].strip("'\"")
        else:
            file_paths.append(arg)
    
    if not file_paths:
        print("Error: No files specified")
        sys.exit(1)
    
    # Generate test plan
    content = generate_test_plan(file_paths, feature_name)
    
    # Write to TESTS.md
    tests_path = os.path.join(os.getcwd(), 'TESTS.md')
    with open(tests_path, 'w') as f:
        f.write(content)
    
    print(f"✓ Generated TESTS.md for {feature_name}")
    print(f"  Files analyzed: {len(file_paths)}")
    
    sys.exit(0)


if __name__ == '__main__':
    main()

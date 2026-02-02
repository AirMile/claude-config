#!/usr/bin/env python3
"""
Generate API documentation from Laravel routes.
Scans routes/api.php and routes/web.php, extracts endpoints, methods, middleware.
Outputs to docs/api.md in a structured format.
"""

import os
import sys
import re
from datetime import datetime


def get_current_date():
    """Get current date in YYYY-MM-DD format."""
    return datetime.now().strftime("%Y-%m-%d")


def scan_route_file(filepath):
    """
    Scan a Laravel route file and extract route definitions.

    Returns:
        list: [{
            "method": "GET",
            "uri": "/api/users",
            "name": "users.index",
            "controller": "UserController@index",
            "middleware": ["auth:sanctum"]
        }]
    """
    if not os.path.exists(filepath):
        return []

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    routes = []

    # Pattern for Route::get('/path', [Controller::class, 'method'])
    pattern1 = r"Route::(get|post|put|patch|delete|options)\s*\(\s*['\"]([^'\"]+)['\"]\s*,\s*\[([^\]]+)\]"

    # Pattern for Route::get('/path', function() {})
    pattern2 = r"Route::(get|post|put|patch|delete|options)\s*\(\s*['\"]([^'\"]+)['\"]\s*,\s*function"

    matches1 = re.finditer(pattern1, content, re.MULTILINE)
    matches2 = re.finditer(pattern2, content, re.MULTILINE)

    for match in matches1:
        method = match.group(1).upper()
        uri = match.group(2)
        controller_part = match.group(3)

        # Extract controller and action
        controller_match = re.search(r'(\w+)::class.*?[\'"](\w+)[\'"]', controller_part)
        if controller_match:
            controller = controller_match.group(1)
            action = controller_match.group(2)
        else:
            controller = "Unknown"
            action = "Unknown"

        route_info = {
            "method": method,
            "uri": uri,
            "controller": f"{controller}@{action}",
            "middleware": [],
            "name": None
        }

        # Try to find middleware
        # Look ahead in the file for ->middleware() on same route
        route_block_start = match.start()
        route_block = content[route_block_start:route_block_start+500]

        middleware_match = re.search(r"->middleware\(\s*['\"]([^'\"]+)['\"]\s*\)", route_block)
        if middleware_match:
            route_info["middleware"] = [middleware_match.group(1)]

        # Try to find route name
        name_match = re.search(r"->name\(\s*['\"]([^'\"]+)['\"]\s*\)", route_block)
        if name_match:
            route_info["name"] = name_match.group(1)

        routes.append(route_info)

    # Closure routes (pattern2)
    for match in matches2:
        method = match.group(1).upper()
        uri = match.group(2)

        route_info = {
            "method": method,
            "uri": uri,
            "controller": "Closure",
            "middleware": [],
            "name": None
        }

        routes.append(route_info)

    return routes


def group_routes_by_resource(routes):
    """
    Group routes by resource (e.g., /api/users, /api/posts).

    Returns:
        dict: {
            "users": [list of routes],
            "posts": [list of routes]
        }
    """
    grouped = {}

    for route in routes:
        uri = route["uri"]

        # Extract resource name from URI
        # /api/users → users
        # /api/users/{id} → users
        # /users → users
        parts = uri.strip('/').split('/')

        if parts[0] == 'api':
            resource = parts[1] if len(parts) > 1 else 'api'
        else:
            resource = parts[0] if parts else 'root'

        if resource not in grouped:
            grouped[resource] = []

        grouped[resource].append(route)

    return grouped


def generate_api_docs(routes, root_path):
    """Generate markdown documentation from routes."""
    date = get_current_date()

    doc = f"""# API Documentation

Last updated: {date}

## Overview

This document describes the available API endpoints in this application.

**Base URL:** `/api`

**Authentication:** Most endpoints require authentication via Laravel Sanctum.

**Headers:**
```
Authorization: Bearer {{token}}
Accept: application/json
Content-Type: application/json
```

---

"""

    # Group routes by resource
    grouped = group_routes_by_resource(routes)

    for resource, resource_routes in sorted(grouped.items()):
        doc += f"## {resource.capitalize()} Endpoints\n\n"

        for route in resource_routes:
            method = route["method"]
            uri = route["uri"]
            controller = route["controller"]
            middleware = route["middleware"]
            name = route["name"]

            doc += f"### {method} {uri}\n\n"

            if name:
                doc += f"**Route Name:** `{name}`\n\n"

            doc += f"**Controller:** `{controller}`\n\n"

            if middleware:
                doc += f"**Middleware:** `{', '.join(middleware)}`\n\n"

            # Add placeholder for request/response
            doc += f"**Request:**\n```json\n{{\n  // TODO: Document request body\n}}\n```\n\n"
            doc += f"**Response:**\n```json\n{{\n  // TODO: Document response body\n}}\n```\n\n"
            doc += "---\n\n"

    doc += f"""
## Error Responses

### Validation Error (422)
```json
{{
  "message": "The given data was invalid.",
  "errors": {{
    "field": ["Error message"]
  }}
}}
```

### Unauthorized (401)
```json
{{
  "message": "Unauthenticated."
}}
```

### Forbidden (403)
```json
{{
  "message": "This action is unauthorized."
}}
```

### Not Found (404)
```json
{{
  "message": "Resource not found."
}}
```

---

*Auto-generated by /2-code skill - {date}*
*Manual updates: Add request/response examples for each endpoint*
"""

    return doc


def update_api_docs(root_path=None):
    """Update API documentation file."""
    if root_path is None:
        root_path = os.getcwd()

    print(f"Scanning Laravel routes in {root_path}...")

    # Scan route files
    api_routes_path = os.path.join(root_path, 'routes', 'api.php')
    web_routes_path = os.path.join(root_path, 'routes', 'web.php')

    routes = []

    if os.path.exists(api_routes_path):
        routes.extend(scan_route_file(api_routes_path))
        print(f"  Found {len(routes)} routes in routes/api.php")

    web_routes_count = len(routes)
    if os.path.exists(web_routes_path):
        routes.extend(scan_route_file(web_routes_path))
        web_added = len(routes) - web_routes_count
        print(f"  Found {web_added} routes in routes/web.php")

    if not routes:
        print("No routes found. Skipping API documentation generation.")
        return False

    # Generate documentation
    doc_content = generate_api_docs(routes, root_path)

    # Create docs folder if needed
    docs_dir = os.path.join(root_path, 'docs')
    os.makedirs(docs_dir, exist_ok=True)

    # Write to docs/api.md
    api_docs_path = os.path.join(docs_dir, 'api.md')
    with open(api_docs_path, 'w', encoding='utf-8') as f:
        f.write(doc_content)

    print(f"✓ Generated docs/api.md")
    print(f"  Total endpoints: {len(routes)}")

    return True


def main():
    """Main entry point."""
    root_path = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()

    try:
        success = update_api_docs(root_path)
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"Error updating API docs: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()

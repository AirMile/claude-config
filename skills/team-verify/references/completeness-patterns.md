# Completeness Patterns

Patterns for matching requirements against code diffs. Used by the Explore agent in FASE 0.5.

## Matching Strategy

For each requirement, the agent should look for evidence in the diff using these approaches (in order of reliability):

### 1. File-Level Match

Compare `files[]` from feature.json against changed files in the diff.

- `action: "create"` → file should appear as new in diff
- `action: "modify"` → file should appear as modified in diff
- Match by exact path first, then by filename if path differs

### 2. Requirement-Level Match

For each requirement, look for implementation evidence:

| Requirement Pattern     | What to Look For in Diff                                                |
| ----------------------- | ----------------------------------------------------------------------- |
| "User can {action}"     | Route/endpoint handling that action, UI component for that action       |
| "Validate {field}"      | Validation logic (Zod schema, regex, conditional checks) for that field |
| "Display {data}"        | Component rendering that data, API endpoint returning that data         |
| "Store {entity}"        | Database model/migration/query for that entity                          |
| "Send {notification}"   | Email/push/webhook sending logic                                        |
| "Authenticate {method}" | Auth middleware, token handling, session logic                          |
| "Rate limit {endpoint}" | Middleware or decorator applying rate limits                            |
| "Handle error {case}"   | Try/catch, error boundary, error response for that case                 |

### 3. Acceptance Criteria Match

Parse acceptance criteria into testable assertions:

- "should redirect to {path}" → look for redirect/navigate logic to that path
- "should show {message}" → look for that message string or i18n key
- "should return {status}" → look for HTTP status code in response
- "should not allow {action}" → look for guard/validation preventing that action

## Status Classification

| Status    | Criteria                                                                                                                |
| --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `FOUND`   | Clear implementation evidence in diff matching the requirement                                                          |
| `PARTIAL` | Some evidence found but acceptance criteria not fully met (e.g., server-side validation exists but client-side missing) |
| `MISSING` | No relevant code found in diff for this requirement                                                                     |

## False Positive Handling

Reduce false positives by:

- Only count code that is functionally related (not just string matches)
- Check that the implementation is complete (e.g., a route handler that returns TODO is not FOUND)
- Commented-out code does not count as implementation
- Test files alone do not count as implementation (tests test the implementation)

## False Negative Handling

Reduce false negatives by:

- Check for alternative implementations (e.g., middleware vs inline check for auth)
- Consider framework conventions (e.g., Next.js file-based routing means a file IS the route)
- Look for indirect implementation (e.g., a shared utility that handles the requirement)
- If a requirement maps to configuration (env vars, config files), check those too

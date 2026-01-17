# Stack Detection

## Purpose

This resource defines how to detect and parse the project stack from CLAUDE.md.

## Parsing Rules

### 1. Read CLAUDE.md Project Section

Look for the `## Project` section and parse these fields:

| Field | Pattern | Example |
|-------|---------|---------|
| Frontend | `**Frontend**:` | React 19, Vite 7, TypeScript |
| Backend | `**Backend**:` | Laravel 11, PHP 8.3 |
| Styling | `**Styling**:` | Tailwind CSS v4 |
| Testing Frontend | `**Frontend**:` under `### Testing` | Vitest, React Testing Library |
| Testing Backend | `**Backend**:` under `### Testing` | PHPUnit, Pest |

### 2. Stack Type Classification

Based on parsed fields, classify the project:

| Condition | Stack Type | Test Resource |
|-----------|------------|---------------|
| Frontend only | `frontend` | testing/vitest-rtl.md |
| Backend only | `backend` | testing/phpunit.md |
| Both present | `fullstack` | Both resources |

### 3. Framework Detection

**Frontend frameworks:**

| Contains | Framework | Resource |
|----------|-----------|----------|
| React, Vite | react-vite | stacks/react-vite.md |
| React, Next | react-next | stacks/react-next.md |
| Vue, Vite | vue-vite | stacks/vue-vite.md |

**Backend frameworks:**

| Contains | Framework | Resource |
|----------|-----------|----------|
| Laravel | laravel | stacks/laravel.md |
| Express, Node | node-express | stacks/node-express.md |
| NestJS | nestjs | stacks/nestjs.md |

### 4. Fallback Detection

If `### Stack` section not found, fallback to file detection:

| File Exists | Stack |
|-------------|-------|
| `package.json` + `vite.config.*` | react-vite |
| `package.json` + `next.config.*` | react-next |
| `composer.json` + `artisan` | laravel |
| `package.json` + `tsconfig.json` (no vite/next) | node |

## Usage in Commands

```markdown
## FASE 0: Load Context

1. Read `.claude/CLAUDE.md`
2. Parse `## Project` → `### Stack` section
3. Determine stack type (frontend/backend/fullstack)
4. Load appropriate resources:
   - Stack resource: `.claude/resources/stacks/{framework}.md`
   - Testing resource: `.claude/resources/testing/{test-framework}.md`
5. Continue with stack-specific context loaded
```

## Example Parsing

**Input (CLAUDE.md):**
```markdown
## Project

**Name**: My App
**Type**: Fullstack

### Stack
**Frontend**: React 19, Vite 7, TypeScript
**Backend**: Laravel 11, PHP 8.3

### Testing
**Frontend**: Vitest, React Testing Library
**Backend**: PHPUnit
```

**Output:**
```
Stack Type: fullstack
Frontend Framework: react-vite
Backend Framework: laravel
Frontend Testing: vitest-rtl
Backend Testing: phpunit

Resources to load:
- .claude/resources/stacks/react-vite.md
- .claude/resources/stacks/laravel.md
- .claude/resources/testing/vitest-rtl.md
- .claude/resources/testing/phpunit.md
```

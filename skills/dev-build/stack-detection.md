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

| Condition | Stack Type |
|-----------|------------|
| Frontend only | `frontend` |
| Backend only | `backend` |
| Both present | `fullstack` |

### 3. Framework Detection

**Frontend frameworks:**

| Contains | Framework |
|----------|-----------|
| React, Vite | react-vite |
| React, Next | react-next |
| Vue, Vite | vue-vite |

**Backend frameworks:**

| Contains | Framework |
|----------|-----------|
| Laravel | laravel |
| Express, Node | node-express |
| NestJS | nestjs |

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
4. Continue with stack-specific context loaded
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
```

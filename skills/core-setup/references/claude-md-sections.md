# CLAUDE.md Section Templates

## User Preferences Template

```markdown
## User Preferences

Language: English
```

**Note**: This section should be at the top of CLAUDE.md. All skills read this section to determine user's preferred language for output. Supported languages:
- English (default)
- Nederlands
- Deutsch
- Français
- Español

---

## Project Template (Compact)

```markdown
## Project

**Name**: [Project Name]
**Type**: [Project type, e.g., "Web Frontend (React SPA)", "Web Backend (Laravel API)"]
**Description**: [Brief description]
**Stack**: [Framework + version + key dependencies on one line]
**Created**: [Date]

### Documentation Generators
**Enabled:** [comma-separated list]
**Available:** [comma-separated list]
```

**Type examples:**
- `Web Frontend (React SPA)` | `Web Frontend (Next.js SSR)`
- `Web Backend (Laravel API)` | `Web Backend (Express REST)`
- `Game (Godot)` | `Game (Unity)`
- `Fullstack (Laravel + React)`

**Stack examples:**
- Frontend: `React 19 + Vite 7 + Tailwind CSS v4 + React Router v7`
- Backend: `Laravel 11 + PostgreSQL 16 + Redis 7`
- Game: `Godot 4.3 + GDScript + Git LFS`

**Note:** Separate Tech Stack, Workspace Configuration, and Development Setup sections are deprecated. Use the compact format above.

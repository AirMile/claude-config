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

## Development Setup Templates (DEPRECATED)

> **Note:** These templates are no longer added to CLAUDE.md. Development commands are in package.json/composer.json. Project structure can be explored via `ls`. Keep for reference only.

## Project Structure Templates (DEPRECATED)

> **Note:** These templates are no longer added to CLAUDE.md. Use `ls` to explore structure.

---

## Reference Templates (for README.md, not CLAUDE.md)

### Laravel Project Structure
```
app/
├── Http/
│   ├── Controllers/
│   ├── Middleware/
│   └── Requests/
├── Models/
├── Services/
└── Repositories/
database/
├── migrations/
├── factories/
└── seeders/
resources/
├── views/
├── js/
└── css/
routes/
├── web.php
├── api.php
└── console.php
\`\`\`
```

## API Documentation Template

```markdown
## API Documentation

### Base URL
- Development: `http://localhost:3001/api`
- Production: `https://api.example.com`

### Authentication
All authenticated endpoints require Bearer token in header:
\`\`\`
Authorization: Bearer <token>
\`\`\`

### Endpoints

#### Auth
- `POST /auth/login` - User login
- `POST /auth/register` - User registration
- `POST /auth/logout` - User logout
- `GET /auth/me` - Get current user

#### Resources
- `GET /users` - List users
- `GET /users/:id` - Get user by ID
- `POST /users` - Create user
- `PUT /users/:id` - Update user
- `DELETE /users/:id` - Delete user
```

## Testing Template

```markdown
## Testing

### Test Structure
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- E2E tests: `tests/e2e/`

### Running Tests

\`\`\`bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- UserService.test.js

# Run in watch mode
npm run test:watch
\`\`\`

### Test Database
Tests use a separate database that is reset before each test run.
```

## Deployment Template

```markdown
## Deployment

### Production Build

\`\`\`bash
npm run build
\`\`\`

### Environment Variables
Required production environment variables:
- `DATABASE_URL` - Production database connection
- `API_KEY` - External service API key
- `JWT_SECRET` - JWT signing secret

### Deployment Process
1. Push to main branch
2. CI/CD pipeline runs tests
3. Build Docker image
4. Deploy to [platform]

### Monitoring
- Error tracking: Sentry
- Performance: New Relic
- Logs: [Log service]
```

## Contributing Template

```markdown
## Contributing

### Development Workflow
1. Create feature branch from `main`
2. Make changes and commit
3. Write/update tests
4. Create pull request
5. Code review
6. Merge to main

### Commit Convention
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance
```
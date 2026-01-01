# Architecture Patterns - Web/App Projects

Guidelines for structuring web and application code to be maintainable, scalable, and plug-and-play.

## Core Principle: Separation of Concerns

Code should be organized in three layers:
1. **Config** - Configuration and constants
2. **Controller/Adapter** - Business logic and data handling
3. **Component** - Presentation and UI

## Central Configuration Pattern

**Rule:** All configuration lives in central config files. Components NEVER contain hardcoded values.

### Config Files Structure

```
project/
├── config/
│   ├── theme.css          (colors, spacing, typography)
│   ├── api.config.js      (endpoints, timeouts)
│   ├── constants.js       (magic numbers, limits)
│   └── app.config.js      (general app settings)
```

### Frontend: CSS Variables

**Central theme file:**
```css
/* config/theme.css */
:root {
  /* Colors */
  --color-primary: #3B82F6;
  --color-secondary: #10B981;
  --color-danger: #EF4444;
  --color-text: #1F2937;
  --color-bg: #FFFFFF;
  
  /* Spacing */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* Typography */
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  
  /* Borders */
  --border-radius: 8px;
  --border-width: 1px;
}
```

**Component usage:**
```css
/* components/Button.css */
.button {
  background: var(--color-primary);  /* NOT #3B82F6 */
  padding: var(--spacing-md);         /* NOT 16px */
  border-radius: var(--border-radius); /* NOT 8px */
}
```

### Backend: Config Modules

**Central config file:**
```javascript
// config/api.config.js
export default {
  endpoints: {
    users: '/api/users',
    products: '/api/products',
    orders: '/api/orders'
  },
  timeout: 5000,
  retryAttempts: 3,
  pageSize: 20
};
```

**Controller usage:**
```javascript
// controllers/UserController.js
import apiConfig from '../config/api.config.js';

export function fetchUsers() {
  return fetch(apiConfig.endpoints.users, {
    timeout: apiConfig.timeout  // NOT hardcoded 5000
  });
}
```

### Laravel Projects

**Config in config/ directory:**
```php
// config/app.php
return [
    'name' => env('APP_NAME', 'Laravel'),
    'pagination' => [
        'per_page' => 15,
        'max_per_page' => 100,
    ],
    'upload' => [
        'max_size' => 10485760, // 10MB
        'allowed_types' => ['jpg', 'png', 'pdf'],
    ],
];
```

**Usage in controllers:**
```php
// app/Http/Controllers/UserController.php
use Illuminate\Support\Facades\Config;

public function index() {
    $perPage = Config::get('app.pagination.per_page'); // NOT 15
    return User::paginate($perPage);
}
```

## Single-File Component Structure

When everything must be in one file, use clear section markers:

```javascript
// ============================================
// CONFIG SECTION
// ============================================

// If no external config file exists, define config here
const CONFIG = {
  primaryColor: '#3B82F6',
  apiEndpoint: '/api/users',
  pageSize: 10,
  timeout: 5000
};

// ============================================
// CONTROLLER SECTION
// ============================================

async function fetchUsers(page) {
  const response = await fetch(
    `${CONFIG.apiEndpoint}?page=${page}&size=${CONFIG.pageSize}`,
    { timeout: CONFIG.timeout }
  );
  return response.json();
}

// ============================================
// COMPONENT SECTION
// ============================================

function UserList() {
  const [users, setUsers] = useState([]);
  
  return (
    <div style={{ backgroundColor: CONFIG.primaryColor }}>
      {/* Component code */}
    </div>
  );
}

export default UserList;
```

## Multi-File Component Structure

When files can be separated:

```
feature/
├── config/
│   └── feature.config.js    ← All constants here
├── controllers/
│   └── FeatureController.js ← Import config
├── components/
│   └── Feature.jsx          ← Import config
└── index.js
```

## What Goes in Config?

**ALWAYS extract to config:**
- Colors (hex codes, RGB values)
- Spacing values (margins, padding, gaps)
- Font sizes
- Border radius, widths
- API endpoints
- Timeouts, retry attempts
- Page sizes, limits
- Magic numbers (thresholds, delays)
- Feature flags
- Environment-dependent values

**NEVER hardcode in components:**
```javascript
// ❌ BAD
<div style={{ color: '#3B82F6', padding: '16px' }}>

// ✅ GOOD
<div style={{ color: theme.colors.primary, padding: theme.spacing.md }}>
```

```javascript
// ❌ BAD
if (users.length > 100) {
  
// ✅ GOOD
if (users.length > CONFIG.maxUsersPerPage) {
```

```javascript
// ❌ BAD
setTimeout(retry, 5000);

// ✅ GOOD
setTimeout(retry, CONFIG.retryDelay);
```

## Plug and Play Components

**Goal:** Components should be easy to reuse, modify, and swap.

**Principles:**
1. **Minimal coupling** - Components don't directly reference other components unnecessarily
2. **Config-driven** - Behavior controlled by config, not code changes
3. **Clear interfaces** - Props/parameters are well-defined
4. **Single responsibility** - Each component does one thing well

**Example:**
```javascript
// ❌ BAD - Tightly coupled
function UserCard({ userId }) {
  const user = UserService.getUser(userId);  // Direct coupling
  return <div style={{ color: '#3B82F6' }}>  // Hardcoded
    {user.name}
  </div>;
}

// ✅ GOOD - Plug and play
function UserCard({ user, theme }) {
  return <div style={{ color: theme.colors.primary }}>
    {user.name}
  </div>;
}
```

## File Organization Checklist

Before writing code, ask:

- [ ] Is there a central config file for this domain? (theme, api, constants)
- [ ] If not, should I create one?
- [ ] Am I about to hardcode a color, spacing, or magic number?
- [ ] Can this value change in the future?
- [ ] Will someone need to find and change this value across multiple files?
- [ ] Is this component reusable enough?
- [ ] Can I swap this component without breaking other code?

## When to Create Config Files

**Create central config when:**
- Starting a new project
- Adding first color/spacing value
- Adding third API endpoint
- Finding yourself copying the same constant

**Expand existing config when:**
- Adding new colors, spacing, or constants
- Extending API endpoints
- Adding feature flags
- Project grows beyond initial scope

## Framework-Specific Notes

### Laravel
- Config in `config/` directory
- Use `config('app.name')` syntax
- Environment variables in `.env`
- Never hardcode in controllers/views

### React/Vue/Svelte
- CSS variables in `index.css` or `App.css`
- JS config in `src/config/`
- Import and use throughout components
- Theme providers for global state

### Node.js/Express
- Config in `config/` directory
- Use environment variables
- dotenv for local development
- Never commit secrets

### Next.js
- Public env vars in `next.config.js`
- CSS variables in `globals.css`
- API config in `lib/config/`

## Summary

**Golden rule:** Change config in 1 place → effect everywhere.

If you find yourself searching multiple files to change a color, endpoint, or constant, the architecture is wrong. Refactor to central config immediately.

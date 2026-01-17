# Vitest + React Testing Library

## Overview

Testing resource for React projects using Vitest and React Testing Library (RTL).

## Dependencies

```json
{
  "devDependencies": {
    "vitest": "^2.1.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@testing-library/jest-dom": "^6.4.0",
    "@vitest/coverage-v8": "^2.1.0",
    "jsdom": "^24.0.0",
    "msw": "^2.4.0"
  }
}
```

## File Structure

```
src/
├── components/
│   └── Button.tsx
├── hooks/
│   └── useAuth.ts
└── services/
    └── api.ts

tests/
├── setup.ts              # Global test setup
├── mocks/
│   └── handlers.ts       # MSW handlers
├── unit/
│   ├── components/
│   │   └── Button.test.tsx
│   └── hooks/
│       └── useAuth.test.ts
└── integration/
    └── auth-flow.test.tsx
```

## Configuration

**vitest.config.ts:**
```typescript
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['node_modules/', 'tests/']
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
```

**tests/setup.ts:**
```typescript
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})
```

## Commands

| Action | Command |
|--------|---------|
| Run all | `npm run test` |
| Watch mode | `npm run test -- --watch` |
| Specific file | `npm run test -- tests/unit/Button.test.tsx` |
| Coverage | `npm run test -- --coverage` |
| UI mode | `npm run test -- --ui` |

## Test Template

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComponentName } from '@/components/ComponentName'

describe('ComponentName', () => {
  beforeEach(() => {
    // Setup before each test
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // REQ-XXX: {requirement description}
  it('should {expected behavior}', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<ComponentName prop="value" />)

    // Act
    await user.click(screen.getByRole('button'))

    // Assert
    expect(screen.getByText('Result')).toBeInTheDocument()
  })
})
```

## Query Priority

Use queries in this order (most to least preferred):

1. **getByRole** - Accessible queries (buttons, links, headings)
2. **getByLabelText** - Form inputs with labels
3. **getByPlaceholderText** - Inputs without labels
4. **getByText** - Non-interactive text content
5. **getByTestId** - Last resort fallback

```typescript
// Preferred
screen.getByRole('button', { name: /submit/i })
screen.getByRole('textbox', { name: /email/i })
screen.getByRole('heading', { level: 1 })

// Acceptable
screen.getByLabelText('Email address')
screen.getByPlaceholderText('Enter email')

// Last resort
screen.getByTestId('custom-element')
```

## Assertions

**Vitest assertions:**
```typescript
expect(value).toBe(expected)           // Strict equality
expect(value).toEqual(expected)        // Deep equality
expect(value).toBeTruthy()             // Truthy
expect(value).toBeNull()               // Is null
expect(array).toContain(item)          // Contains
expect(fn).toHaveBeenCalled()          // Called
expect(fn).toHaveBeenCalledWith(args)  // Called with args
expect(fn).toHaveBeenCalledTimes(n)    // Call count
```

**jest-dom assertions:**
```typescript
expect(element).toBeInTheDocument()    // Exists in DOM
expect(element).toBeVisible()          // Is visible
expect(element).toHaveTextContent(txt) // Has text
expect(element).toHaveAttribute(attr)  // Has attribute
expect(element).toBeDisabled()         // Is disabled
expect(element).toHaveFocus()          // Has focus
expect(element).toHaveClass(className) // Has CSS class
expect(element).toHaveValue(value)     // Input value
```

## User Interactions

```typescript
const user = userEvent.setup()

// Click
await user.click(element)
await user.dblClick(element)

// Type
await user.type(input, 'text')
await user.clear(input)

// Keyboard
await user.keyboard('{Enter}')
await user.keyboard('{Tab}')

// Select
await user.selectOptions(select, 'option-value')

// Hover
await user.hover(element)
await user.unhover(element)
```

## Async Testing

```typescript
// Wait for element
await waitFor(() => {
  expect(screen.getByText('Loaded')).toBeInTheDocument()
})

// Wait with timeout
await waitFor(() => {
  expect(screen.getByText('Done')).toBeInTheDocument()
}, { timeout: 3000 })

// Find queries (auto-wait)
const button = await screen.findByRole('button')
```

## Mocking

**Functions:**
```typescript
const mockFn = vi.fn()
const mockWithReturn = vi.fn().mockReturnValue('value')
const mockAsync = vi.fn().mockResolvedValue({ data: 'result' })
```

**Modules:**
```typescript
vi.mock('@/services/api', () => ({
  fetchData: vi.fn().mockResolvedValue({ data: 'mocked' })
}))
```

**Timers:**
```typescript
vi.useFakeTimers()
vi.advanceTimersByTime(1000)
vi.useRealTimers()
```

## MSW API Mocking

**tests/mocks/handlers.ts:**
```typescript
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/user', () => {
    return HttpResponse.json({ id: 1, name: 'Test User' })
  }),

  http.post('/api/login', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ token: 'mock-token' })
  }),

  http.get('/api/error', () => {
    return HttpResponse.json({ error: 'Not found' }, { status: 404 })
  })
]
```

**Integration test setup:**
```typescript
import { setupServer } from 'msw/node'
import { handlers } from '../mocks/handlers'

const server = setupServer(...handlers)

beforeAll(() => server.listen())
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

## Output Parsing

**PASS (show as 1 line):**
```
TESTS: 15/15 PASS (2.3s)
```

**FAIL (show max 10 lines):**
```
TESTS: 13/15 PASS (2.3s)
FAILED:
- Button.test.tsx:23 - expected 'Submit' but got 'Loading'
- useAuth.test.ts:45 - hook returned undefined
```

**PENDING (show max 5 lines):**
```
TESTS: 4/15 PASS, 11 SKIPPED (1.2s)
```

## Common Patterns

### Testing Hooks

```typescript
import { renderHook, act } from '@testing-library/react'
import { useCounter } from '@/hooks/useCounter'

it('should increment counter', () => {
  const { result } = renderHook(() => useCounter())

  act(() => {
    result.current.increment()
  })

  expect(result.current.count).toBe(1)
})
```

### Testing with Context

```typescript
const wrapper = ({ children }) => (
  <AuthProvider>
    <ThemeProvider>
      {children}
    </ThemeProvider>
  </AuthProvider>
)

render(<Component />, { wrapper })
```

### Testing Forms

```typescript
it('should submit form with valid data', async () => {
  const user = userEvent.setup()
  const onSubmit = vi.fn()
  render(<ContactForm onSubmit={onSubmit} />)

  await user.type(screen.getByLabelText('Email'), 'test@example.com')
  await user.type(screen.getByLabelText('Message'), 'Hello')
  await user.click(screen.getByRole('button', { name: /submit/i }))

  expect(onSubmit).toHaveBeenCalledWith({
    email: 'test@example.com',
    message: 'Hello'
  })
})
```

## Gotchas

1. **Always use `userEvent.setup()`** - Creates new user instance per test
2. **Await all user events** - They're async in v14+
3. **Use `findBy*` for async elements** - Not `getBy*` with waitFor
4. **Clean up mocks in afterEach** - Prevents test pollution
5. **Don't test implementation details** - Test behavior, not internals

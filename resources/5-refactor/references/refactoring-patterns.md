# Refactoring Patterns Reference

Common DRY violation patterns and extraction techniques for the refactor skill.

## Quick Reference

| Pattern | Detection | Confidence | Action |
|---------|-----------|------------|--------|
| Exact duplicate (>5 lines) | Identical code | 95% | Extract immediately |
| Similar logic (>70%) | Near-identical | 80-90% | Extract with parameters |
| Repeated conditional | Same if/else | 85% | Extract to function |
| Copy-paste across files | Same code, different files | 90% | Extract to shared module |
| 3+ similar locations | Pattern appears 3+ times | 90% | Extract to utility |

---

## DRY Violation Patterns

### 1. Exact Duplicate Code

**Detection:** Identical code blocks >5 lines in same or different files.

**Confidence:** 95%

**Example:**
```typescript
// file1.ts:45-52
try {
  const result = await api.call();
  logger.info('Success', result);
  return result;
} catch (e) {
  logger.error('Failed', e);
  throw new ApiError(e.message);
}

// file2.ts:120-127 (exact same code)
try {
  const result = await api.call();
  logger.info('Success', result);
  return result;
} catch (e) {
  logger.error('Failed', e);
  throw new ApiError(e.message);
}
```

**Extraction:**
```typescript
// utils/apiHelper.ts
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    const result = await apiCall();
    logger.info(`${context}: Success`, result);
    return result;
  } catch (e) {
    logger.error(`${context}: Failed`, e);
    throw new ApiError(e.message);
  }
}

// Usage
const result = await safeApiCall(() => api.call(), 'UserFetch');
```

---

### 2. Similar Logic Patterns (>70% similarity)

**Detection:** Code blocks that are structurally similar but differ in details.

**Confidence:** 80-90%

**Example:**
```typescript
// createUser.ts
const user = new User();
user.name = data.name;
user.email = data.email;
user.validate();
await user.save();
logger.info('User created', user.id);

// createProduct.ts
const product = new Product();
product.name = data.name;
product.price = data.price;
product.validate();
await product.save();
logger.info('Product created', product.id);
```

**Extraction:**
```typescript
// utils/entityFactory.ts
export async function createEntity<T extends BaseEntity>(
  EntityClass: new () => T,
  data: Partial<T>,
  entityName: string
): Promise<T> {
  const entity = new EntityClass();
  Object.assign(entity, data);
  entity.validate();
  await entity.save();
  logger.info(`${entityName} created`, entity.id);
  return entity;
}

// Usage
const user = await createEntity(User, data, 'User');
const product = await createEntity(Product, data, 'Product');
```

---

### 3. Repeated Conditionals

**Detection:** Same if/else or switch structure in multiple places.

**Confidence:** 85%

**Example:**
```typescript
// Multiple files have this same pattern
if (user.role === 'admin') {
  return adminDashboard();
} else if (user.role === 'manager') {
  return managerDashboard();
} else if (user.role === 'user') {
  return userDashboard();
} else {
  return guestDashboard();
}
```

**Extraction:**
```typescript
// utils/dashboardRouter.ts
const dashboardMap: Record<string, () => Dashboard> = {
  admin: adminDashboard,
  manager: managerDashboard,
  user: userDashboard,
};

export function getDashboard(role: string): Dashboard {
  return (dashboardMap[role] || guestDashboard)();
}

// Usage
return getDashboard(user.role);
```

---

### 4. Validation Logic Duplication

**Detection:** Same validation rules in multiple controllers/handlers.

**Confidence:** 90%

**Example (Laravel):**
```php
// CreateRecipeController
$validated = $request->validate([
    'name' => 'required|string|max:255',
    'description' => 'required|string',
    'ingredients' => 'required|array',
]);

// UpdateRecipeController
$validated = $request->validate([
    'name' => 'required|string|max:255',
    'description' => 'required|string',
    'ingredients' => 'required|array',
]);
```

**Extraction:**
```php
// app/Http/Requests/RecipeRequest.php
class RecipeRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'ingredients' => 'required|array',
        ];
    }
}

// Usage in both controllers
public function store(RecipeRequest $request) { ... }
public function update(RecipeRequest $request) { ... }
```

---

### 5. Error Handling Duplication

**Detection:** Same try/catch pattern in multiple places.

**Confidence:** 88%

**Example:**
```typescript
// Multiple API endpoints
try {
  // ... business logic
} catch (error) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: 'Not found' });
  }
  logger.error(error);
  return res.status(500).json({ error: 'Internal server error' });
}
```

**Extraction:**
```typescript
// middleware/errorHandler.ts
export function handleError(error: Error, res: Response) {
  if (error instanceof ValidationError) {
    return res.status(400).json({ error: error.message });
  }
  if (error instanceof NotFoundError) {
    return res.status(404).json({ error: 'Not found' });
  }
  logger.error(error);
  return res.status(500).json({ error: 'Internal server error' });
}

// Or use Express error middleware
app.use((error, req, res, next) => handleError(error, res));
```

---

## When NOT to DRY (False Positives)

### 1. Accidental Similarity

**Confidence:** <50% - SKIP

Code that looks similar but serves different purposes and will likely diverge.

**Example:**
```typescript
// User validation - will likely add user-specific rules
if (!user.name) throw new Error('Name required');
if (!user.email) throw new Error('Email required');

// Product validation - will likely add product-specific rules
if (!product.name) throw new Error('Name required');
if (!product.price) throw new Error('Price required');
```

**Why skip:** These validations will likely diverge as requirements evolve. Premature abstraction creates coupling.

---

### 2. Two Occurrences Only

**Confidence:** 60-70% - SUGGESTION only

The "Rule of Three": Don't extract until you see the pattern three times.

**Example:**
```typescript
// Only appears twice - not worth extracting yet
formatDate(date1);
formatDate(date2);
```

**Why wait:** Extracting after two occurrences often leads to wrong abstractions.

---

### 3. Business Logic That Should Differ

**Confidence:** <50% - SKIP

Similar code that represents different business concepts.

**Example:**
```typescript
// Calculate user discount
const userDiscount = basePrice * 0.1;

// Calculate product tax (looks similar but different concept)
const productTax = basePrice * 0.1;
```

**Why skip:** These represent different business rules that may change independently.

---

### 4. Simple One-Liners

**Confidence:** 40% - SKIP

Very simple code that's clearer inline than extracted.

**Example:**
```typescript
// Don't extract this
const isAdmin = user.role === 'admin';
const isManager = user.role === 'manager';
```

**Why skip:** Extraction adds indirection without meaningful benefit.

---

## Framework-Specific Patterns

### Laravel

| Pattern | Detection | Extraction Target |
|---------|-----------|-------------------|
| Repeated validation | Same rules in controllers | FormRequest class |
| Query scopes | Same where() chains | Model scope method |
| Authorization logic | Same Gate checks | Policy class |
| Event dispatching | Same event in multiple places | Event + Listener |

### Node.js/Express

| Pattern | Detection | Extraction Target |
|---------|-----------|-------------------|
| Error handling | Same try/catch | Error middleware |
| Request validation | Same validation logic | Validation middleware |
| Auth checks | Same token validation | Auth middleware |
| Response formatting | Same JSON structure | Response helper |

### React/TypeScript

| Pattern | Detection | Extraction Target |
|---------|-----------|-------------------|
| Component logic | Same useState/useEffect | Custom hook |
| API calls | Same fetch pattern | API service |
| Form handling | Same form logic | Form hook or component |
| Conditional rendering | Same if/else in JSX | Render helper |

---

## Confidence Scoring Guidelines

### High Confidence (85-100%)
- Exact duplicate code >5 lines
- Same validation rules in 3+ places
- Identical error handling patterns
- Copy-paste confirmed by structure

### Medium Confidence (70-85%)
- Similar patterns with minor differences
- 2 occurrences (rule of three not met)
- Structural similarity >70%

### Low Confidence (50-70%)
- Accidental similarity
- Different business concepts
- Likely to diverge
- Simple one-liners

### Skip (<50%)
- Personal preference
- Over-engineering risk
- Premature abstraction
- Business logic that should differ

---

## Usage in Refactor Skill

During Phase 4 (Create Refactor Plan), use this reference to:

1. **Identify DRY violations** using the patterns above
2. **Assess confidence** based on pattern type
3. **Only include >=80% confidence** in the refactor plan
4. **Provide before/after snippets** showing the extraction
5. **Suggest appropriate extraction target** (function, class, module)

**Remember:** Don't suggest extraction for false positives. Over-DRY is worse than under-DRY.

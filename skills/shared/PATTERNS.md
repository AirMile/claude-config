# Frontend Design Patterns

Design patterns reference for React/Next.js implementation. Used by wireframe, style, and scaffold skills.

---

## Component Patterns

### Compound Components

**When:** Multi-part UI with shared state.

```tsx
// Definition
interface CardContextType {
  variant: 'default' | 'elevated' | 'outlined'
}

const CardContext = createContext<CardContextType | null>(null)

function Card({ variant = 'default', children }: CardProps) {
  return (
    <CardContext.Provider value={{ variant }}>
      <div className={styles[variant]}>{children}</div>
    </CardContext.Provider>
  )
}

Card.Header = function CardHeader({ children }: { children: ReactNode }) {
  return <div className={styles.header}>{children}</div>
}

Card.Body = function CardBody({ children }: { children: ReactNode }) {
  return <div className={styles.body}>{children}</div>
}

Card.Footer = function CardFooter({ children }: { children: ReactNode }) {
  return <div className={styles.footer}>{children}</div>
}

// Usage
<Card variant="elevated">
  <Card.Header>Title</Card.Header>
  <Card.Body>Content here</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>
```

**Benefits:**

- Flexible composition
- Shared context without prop drilling
- Clear hierarchy

---

### Render Props / Children as Function

**When:** Sharing behavior without inheritance.

```tsx
// Definition
interface ToggleRenderProps {
  isOn: boolean;
  toggle: () => void;
}

function Toggle({
  children,
}: {
  children: (props: ToggleRenderProps) => ReactNode;
}) {
  const [isOn, setIsOn] = useState(false);
  return <>{children({ isOn, toggle: () => setIsOn(!isOn) })}</>;
}

// Usage
<Toggle>
  {({ isOn, toggle }) => (
    <button onClick={toggle}>{isOn ? "On" : "Off"}</button>
  )}
</Toggle>;
```

**Modern alternative:** Custom hooks are often cleaner:

```tsx
function useToggle(initial = false) {
  const [isOn, setIsOn] = useState(initial);
  return { isOn, toggle: () => setIsOn(!isOn), setIsOn };
}

// Usage
function MyComponent() {
  const { isOn, toggle } = useToggle();
  return <button onClick={toggle}>{isOn ? "On" : "Off"}</button>;
}
```

---

### Controlled vs Uncontrolled

**When:** Determining form handling strategy.

```tsx
// Uncontrolled (internal state)
function UncontrolledInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    console.log(inputRef.current?.value);
  };

  return <input ref={inputRef} defaultValue="initial" />;
}

// Controlled (external state)
function ControlledInput({ value, onChange }: Props) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}

// Hybrid (support both)
function FlexibleInput({ value, defaultValue, onChange }: Props) {
  const [internalValue, setInternalValue] = useState(defaultValue ?? "");
  const isControlled = value !== undefined;

  const currentValue = isControlled ? value : internalValue;

  const handleChange = (newValue: string) => {
    if (!isControlled) setInternalValue(newValue);
    onChange?.(newValue);
  };

  return (
    <input
      value={currentValue}
      onChange={(e) => handleChange(e.target.value)}
    />
  );
}
```

**Rule of thumb:**

- Uncontrolled: Simple forms, no real-time validation
- Controlled: Complex forms, validation, dependent fields

---

### Slot Pattern

**When:** Flexible layout with named regions.

```tsx
interface LayoutProps {
  header?: ReactNode;
  sidebar?: ReactNode;
  main: ReactNode;
  footer?: ReactNode;
}

function PageLayout({ header, sidebar, main, footer }: LayoutProps) {
  return (
    <div className={styles.layout}>
      {header && <header className={styles.header}>{header}</header>}
      <div className={styles.content}>
        {sidebar && <aside className={styles.sidebar}>{sidebar}</aside>}
        <main className={styles.main}>{main}</main>
      </div>
      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  );
}

// Usage
<PageLayout
  header={<Navigation />}
  sidebar={<FilterPanel />}
  main={<ProductList />}
  footer={<Pagination />}
/>;
```

---

### Polymorphic Components

**When:** Component needs to render as different HTML elements.

```tsx
type PolymorphicProps<E extends ElementType> = {
  as?: E
  children: ReactNode
} & ComponentPropsWithoutRef<E>

function Button<E extends ElementType = 'button'>({
  as,
  children,
  ...props
}: PolymorphicProps<E>) {
  const Component = as ?? 'button'
  return <Component {...props}>{children}</Component>
}

// Usage
<Button>Click me</Button>                    // renders <button>
<Button as="a" href="/page">Link</Button>    // renders <a>
<Button as={Link} to="/page">Router</Button> // renders React Router Link
```

---

## State Patterns

### URL State (searchParams)

**When:** Filters, pagination, shareable state.

```tsx
// Next.js App Router
"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";

function useUrlState<T extends Record<string, string>>(defaults: T) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const value = searchParams.get(key);
      if (value) result[key as keyof T] = value as T[keyof T];
    }
    return result;
  }, [searchParams, defaults]);

  const setState = useCallback(
    (updates: Partial<T>) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [searchParams, router, pathname],
  );

  return [state, setState] as const;
}

// Usage
function ProductFilters() {
  const [filters, setFilters] = useUrlState({
    category: "",
    sort: "newest",
    page: "1",
  });

  return (
    <select
      value={filters.sort}
      onChange={(e) => setFilters({ sort: e.target.value })}
    >
      <option value="newest">Newest</option>
      <option value="price">Price</option>
    </select>
  );
}
```

---

### Context + Reducer

**When:** Complex shared state with actions.

```tsx
// Types
interface CartState {
  items: CartItem[];
  total: number;
}

type CartAction =
  | { type: "ADD_ITEM"; payload: CartItem }
  | { type: "REMOVE_ITEM"; payload: string }
  | { type: "CLEAR" };

// Reducer
function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "ADD_ITEM":
      return {
        ...state,
        items: [...state.items, action.payload],
        total: state.total + action.payload.price,
      };
    case "REMOVE_ITEM":
      const item = state.items.find((i) => i.id === action.payload);
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.payload),
        total: state.total - (item?.price ?? 0),
      };
    case "CLEAR":
      return { items: [], total: 0 };
    default:
      return state;
  }
}

// Context
const CartContext = createContext<{
  state: CartState;
  dispatch: Dispatch<CartAction>;
} | null>(null);

function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [], total: 0 });
  return (
    <CartContext.Provider value={{ state, dispatch }}>
      {children}
    </CartContext.Provider>
  );
}

// Hook
function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
```

---

### Server State (React Query / SWR)

**When:** Async data with caching.

```tsx
// React Query pattern
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function useProducts(filters: ProductFilters) {
  return useQuery({
    queryKey: ["products", filters],
    queryFn: () => fetchProducts(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

function useAddProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: addProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });
}

// Usage
function ProductList() {
  const { data, isLoading, error } = useProducts({ category: "electronics" });
  const addProduct = useAddProduct();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <ul>
      {data?.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ul>
  );
}
```

---

## Layout Patterns

### Responsive Patterns

```tsx
// Mobile: Stack
// Tablet: 2 columns
// Desktop: 3-4 columns

function ResponsiveGrid({ children }: { children: ReactNode }) {
  return (
    <div className={styles.grid}>
      {children}
    </div>
  )
}

// CSS (mobile-first)
.grid {
  display: grid;
  gap: var(--spacing-4);
  grid-template-columns: 1fr; /* Mobile: 1 column */
}

@media (min-width: 640px) {
  .grid {
    grid-template-columns: repeat(2, 1fr); /* Tablet: 2 columns */
  }
}

@media (min-width: 1024px) {
  .grid {
    grid-template-columns: repeat(3, 1fr); /* Desktop: 3 columns */
  }
}

@media (min-width: 1280px) {
  .grid {
    grid-template-columns: repeat(4, 1fr); /* Large: 4 columns */
  }
}
```

---

### Sticky Header Pattern

```tsx
function StickyHeader({ children }: { children: ReactNode }) {
  return (
    <header className={styles.stickyHeader}>
      {children}
    </header>
  )
}

// CSS
.stickyHeader {
  position: sticky;
  top: 0;
  z-index: var(--z-header);
  background: var(--color-background);
  border-bottom: 1px solid var(--color-border);
  backdrop-filter: blur(8px);
}
```

---

### Split View Pattern

```tsx
interface SplitViewProps {
  list: ReactNode
  detail: ReactNode
  showDetail: boolean
}

function SplitView({ list, detail, showDetail }: SplitViewProps) {
  return (
    <div className={styles.splitView}>
      <div className={cn(styles.listPane, showDetail && styles.hidden)}>
        {list}
      </div>
      <div className={cn(styles.detailPane, !showDetail && styles.hidden)}>
        {detail}
      </div>
    </div>
  )
}

// CSS
.splitView {
  display: flex;
  height: 100%;
}

.listPane {
  width: 100%;
  overflow-y: auto;
}

.detailPane {
  display: none;
}

@media (min-width: 768px) {
  .listPane {
    width: 320px;
    flex-shrink: 0;
    border-right: 1px solid var(--color-border);
  }

  .detailPane {
    display: block;
    flex: 1;
  }

  .hidden {
    display: block; /* Override mobile hidden on tablet+ */
  }
}
```

---

## Atomic Design Mapping

### Level Definitions

| Level        | Description                 | Examples                           | Complexity          |
| ------------ | --------------------------- | ---------------------------------- | ------------------- |
| **Atom**     | Smallest UI element         | Button, Input, Badge, Icon         | Single element      |
| **Molecule** | Group of 2-3 atoms          | SearchBar, FormField, NavItem      | 2-3 atoms           |
| **Organism** | Multiple molecules          | Header, Card, Sidebar, ProductTile | Multiple molecules  |
| **Template** | Page layout without content | PageLayout, DashboardTemplate      | Regions only        |
| **Page**     | Template + real content     | HomePage, ProductPage              | Full implementation |

### Component Mapping

```
ATOM → Single element, no composition
├── Button
├── Input
├── Badge
├── Avatar
├── Icon
└── Spinner

MOLECULE → 2-3 atoms composed
├── SearchBar (Input + Button + Icon)
├── FormField (Label + Input + Error)
├── NavItem (Icon + Text)
├── Rating (Icon × N)
└── Breadcrumb (Links + Separators)

ORGANISM → Multiple molecules, section-level
├── Header (Logo + Nav + SearchBar + Avatar)
├── Card (Image + Title + Description + Actions)
├── Sidebar (NavItems + Sections)
├── ProductTile (Image + Rating + Price + AddToCart)
└── CommentThread (Avatar + Content + Actions + Replies)

TEMPLATE → Layout structure, content-agnostic
├── PageLayout (Header slot + Main slot + Footer slot)
├── DashboardLayout (Sidebar + Content + Widgets)
├── AuthLayout (Logo + Form slot)
└── ListDetailLayout (List slot + Detail slot)

PAGE → Complete implementation
├── HomePage
├── ProductListPage
├── ProductDetailPage
├── CheckoutPage
└── SettingsPage
```

### Storybook Organization

```
stories/
├── atoms/
│   ├── Button.stories.tsx
│   ├── Input.stories.tsx
│   └── ...
├── molecules/
│   ├── SearchBar.stories.tsx
│   ├── FormField.stories.tsx
│   └── ...
├── organisms/
│   ├── Header.stories.tsx
│   ├── ProductCard.stories.tsx
│   └── ...
├── templates/
│   ├── PageLayout.stories.tsx
│   └── ...
└── pages/
    ├── HomePage.stories.tsx
    └── ...
```

---

## Error Handling Patterns

### Error Boundary

```tsx
"use client";

import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div role="alert">
            <h2>Something went wrong</h2>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Try again
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Usage
<ErrorBoundary fallback={<ProductErrorState />}>
  <ProductList />
</ErrorBoundary>;
```

---

### Async Error Handling

```tsx
// Pattern: Result type
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

async function fetchProduct(id: string): Promise<Result<Product>> {
  try {
    const response = await fetch(`/api/products/${id}`);
    if (!response.ok) {
      return { success: false, error: new Error(`HTTP ${response.status}`) };
    }
    const data = await response.json();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

// Usage
const result = await fetchProduct("123");
if (result.success) {
  console.log(result.data);
} else {
  console.error(result.error);
}
```

---

## Performance Patterns

### Memoization

```tsx
// useMemo for expensive calculations
function ProductList({ products, filters }: Props) {
  const filteredProducts = useMemo(
    () => products.filter((p) => matchesFilters(p, filters)),
    [products, filters],
  );

  return (
    <ul>
      {filteredProducts.map((p) => (
        <ProductCard key={p.id} product={p} />
      ))}
    </ul>
  );
}

// React.memo for component re-renders
const ProductCard = memo(function ProductCard({
  product,
}: {
  product: Product;
}) {
  return <div>{product.name}</div>;
});

// useCallback for stable function references
function Parent() {
  const [count, setCount] = useState(0);

  const handleClick = useCallback(() => {
    setCount((c) => c + 1);
  }, []);

  return <Child onClick={handleClick} />;
}
```

---

### Code Splitting

```tsx
// Dynamic import
const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <Skeleton />,
  ssr: false, // Only load on client
});

// Route-based splitting (Next.js does this automatically)
// pages/heavy-page.tsx is split automatically

// Component-based splitting
const LazyChart = lazy(() => import("./Chart"));

function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <LazyChart data={data} />
    </Suspense>
  );
}
```

---

## Data Fetching Patterns

### Server Component Data Loading (Next.js App Router)

**When:** Fetching data in Server Components without client-side state.

```tsx
// app/dashboard/page.tsx (Server Component)
import { getMetrics } from "@/services/metrics";

export default async function DashboardPage() {
  const metrics = await getMetrics();

  return (
    <div className="grid grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <MetricCard key={metric.id} {...metric} />
      ))}
    </div>
  );
}
```

```tsx
// src/services/metrics.ts
import { z } from "zod";

const MetricSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.number(),
  trend: z.number().optional(),
});

type Metric = z.infer<typeof MetricSchema>;

export async function getMetrics(): Promise<Metric[]> {
  const res = await fetch(`${process.env.API_URL}/metrics`, {
    next: { revalidate: 60 }, // ISR: revalidate every 60s
  });
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.status}`);
  const data = await res.json();
  return z.array(MetricSchema).parse(data);
}
```

**Benefits:**

- Zero client-side JS for data fetching
- Automatic deduplication by React
- Type-safe with Zod validation

---

### API Service Layer Pattern

**When:** Shared data access functions for multiple components.

```
src/services/
├── users.ts        # User CRUD operations
├── products.ts     # Product queries + mutations
└── api-client.ts   # Shared fetch wrapper
```

```tsx
// src/services/api-client.ts
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "/api";

export async function apiClient<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
```

```tsx
// src/services/users.ts
import { apiClient } from "./api-client";
import type { User, CreateUserInput } from "@/types/user";

export const usersService = {
  getAll: () => apiClient<User[]>("/users"),
  getById: (id: string) => apiClient<User>(`/users/${id}`),
  create: (data: CreateUserInput) =>
    apiClient<User>("/users", { method: "POST", body: JSON.stringify(data) }),
};
```

---

### Loading State Patterns (Skeleton)

**When:** Loading async data with visual feedback.

```tsx
// Skeleton component
function MetricCardSkeleton() {
  return (
    <div className="bg-card border border-border rounded-lg p-4 animate-pulse">
      <div className="h-4 w-24 bg-muted rounded mb-2" />
      <div className="h-8 w-32 bg-muted rounded mb-1" />
      <div className="h-3 w-20 bg-muted rounded" />
    </div>
  );
}

// With Suspense (Server Components)
import { Suspense } from "react";

function Dashboard() {
  return (
    <Suspense fallback={<MetricCardSkeleton />}>
      <MetricCard />
    </Suspense>
  );
}

// With React Query (Client Components)
function MetricCard({ id }: { id: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["metric", id],
    queryFn: () => metricsService.getById(id),
  });

  if (isLoading) return <MetricCardSkeleton />;
  if (error) return <MetricCardError error={error} />;
  return <MetricCardContent {...data} />;
}
```

---

### Error State Patterns

**When:** Handling API errors gracefully with user-friendly UI.

```tsx
// Inline error
function MetricCardError({
  error,
  onRetry,
}: {
  error: Error;
  onRetry?: () => void;
}) {
  return (
    <div className="bg-card border border-error/20 rounded-lg p-4" role="alert">
      <p className="text-sm text-error">Could not load data</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-primary mt-2">
          Try again
        </button>
      )}
    </div>
  );
}

// ErrorBoundary (class component — catches render errors)
// See Error Handling Patterns section

// React Query error with retry
function DataSection() {
  const { data, error, refetch } = useQuery({
    queryKey: ["data"],
    queryFn: fetchData,
    retry: 2,
  });

  if (error) return <ErrorMessage error={error} onRetry={refetch} />;
  return <DataContent data={data} />;
}
```

---

## Integration with Skills

### Wireframe → Pattern Mapping

When wireframe has `data-component`, map to pattern:

```
data-component="Card" → Compound Components pattern
data-component="Layout" → Slot Pattern
data-component="Form" → Controlled pattern
data-component="List" → Server State pattern
```

### Style → Pattern Mapping

When generating style tokens, use patterns:

```
Layout tokens → Responsive Patterns CSS
Component tokens → Compound Components styles
State tokens → Controlled/Uncontrolled indicators
```

### Scaffold → Pattern Implementation

When scaffolding components:

```
Atom → Simple functional component
Molecule → Composition of atom imports
Organism → Compound component pattern
Template → Slot pattern
Page → Full pattern integration
```

---

## Motion Patterns

Managed by `/frontend-animations`. Use when `theme.motion.pack` is set. All patterns include `prefers-reduced-motion` fallback.

### Spring Press

**When:** Interactive cards, buttons, or list items needing tactile feedback. Requires Playful or Expressive pack.

```css
/* Pure CSS — static approximation */
.spring-press {
  transition: transform var(--spring-snappy-duration)
    var(--spring-snappy-bezier);
}
.spring-press:active {
  transform: scale(0.94);
}
@media (prefers-reduced-motion: reduce) {
  .spring-press {
    transition: none;
  }
}
```

```tsx
// React — motion.dev (uses real spring physics)
import { motion } from "motion/react";
import springTokens from "@/tokens/spring.json";

<motion.button
  whileTap={{ scale: 0.94 }}
  transition={{ type: "spring", ...springTokens.snappy }}
>
  Press me
</motion.button>;
```

---

### Hover Elevate

**When:** Cards or list items that benefit from depth cue on hover. Standard pack and above.

```css
.hover-elevate {
  transition:
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) var(--ease-out);
}
.hover-elevate:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
@media (prefers-reduced-motion: reduce) {
  .hover-elevate:hover {
    transform: none;
  }
}
```

---

### View Transition Route

**When:** Navigating between pages in an SPA. Expressive pack. Uses the browser View Transitions API.

```tsx
// Next.js App Router
import { useRouter } from "next/navigation";

function navigateWithTransition(href: string) {
  if (!document.startViewTransition) {
    router.push(href);
    return;
  }
  document.startViewTransition(() => router.push(href));
}
```

```css
/* Matching CSS — pairs with ease-ios-spring */
::view-transition-old(root) {
  animation: 350ms var(--ease-ios-in) both fade-out-slide;
}
::view-transition-new(root) {
  animation: 500ms var(--ease-ios-spring) both fade-in-slide;
}
@keyframes fade-out-slide {
  to {
    opacity: 0;
    transform: translateX(-20px);
  }
}
@keyframes fade-in-slide {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
}
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0.01ms !important;
  }
}
```

---

### List Stagger Reveal

**When:** Lists, grids, or feeds that enter viewport. Standard pack and above.

```css
.stagger-item {
  animation: stagger-in var(--duration-normal) var(--ease-out) both;
  animation-delay: calc(var(--i, 0) * 60ms);
}
@keyframes stagger-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .stagger-item {
    animation: none;
    opacity: 1;
  }
}
```

```tsx
// React — assign CSS custom property for index
{
  items.map((item, i) => (
    <li
      key={item.id}
      className="stagger-item"
      style={{ "--i": i } as React.CSSProperties}
    >
      {item.name}
    </li>
  ));
}
```

---

### Success Pulse

**When:** Confirming a completed action (save, submit, payment). Playful pack; opt-in per component via `design.components[i].motion.onSuccess: "success.pulse"`.

```css
.success-pulse {
  animation: success-pulse 500ms var(--spring-bouncy-bezier) both;
}
@keyframes success-pulse {
  0% {
    transform: scale(1);
  }
  40% {
    transform: scale(1.08);
    box-shadow: 0 0 0 4px
      color-mix(in oklch, var(--color-success) 30%, transparent);
  }
  100% {
    transform: scale(1);
    box-shadow: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .success-pulse {
    animation: none;
  }
}
```

---

### Glass Card (opt-in)

**When:** `theme.surfaces.glass.enabled = true` (Expressive pack). Navigation bars, sheets, modals over rich backgrounds.

```css
.glass-card {
  background: var(--surface-glass-tint);
  border: var(--surface-glass-border);
  border-radius: var(--rounded-xl);

  @supports (backdrop-filter: blur()) {
    backdrop-filter: blur(var(--surface-glass-blur))
      saturate(var(--surface-glass-saturation));
  }
}
```

Rules (see DESIGN.md Glass Surfaces section): max one per viewport, never on elements > 60vh, always with solid fallback.

---

### iOS Modal Drawer

**When:** Bottom sheet or side drawer on mobile. Expressive pack. Matches native iOS sheet feel.

```css
.ios-drawer {
  transform: translateY(100%);
  transition: transform var(--duration-ios-modal) var(--ease-ios-spring);
}
.ios-drawer[data-open="true"] {
  transform: translateY(0);
}
.ios-drawer[data-open="false"] {
  transform: translateY(100%);
  transition-timing-function: var(--ease-ios-in);
  transition-duration: calc(var(--duration-ios-modal) * 0.75);
}
@media (prefers-reduced-motion: reduce) {
  .ios-drawer {
    transition: none;
  }
}
```

---

### prefers-reduced-motion Fallback (canonical wrapper)

**When:** Any custom `@keyframes` or choreography token. Always wrap.

```css
/* Declare animation freely */
.animated-element {
  animation: my-animation 300ms var(--ease-out) both;
}

/* Suppress spatial movement — keep opacity for functional feedback */
@media (prefers-reduced-motion: reduce) {
  .animated-element {
    animation: fade-only 150ms ease both;
  }
}

@keyframes my-animation {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@keyframes fade-only {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
```

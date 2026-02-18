# Frontend Design Patterns

Design patterns reference voor React/Next.js implementatie. Gebruikt door wireframe, style, en scaffold skills.

---

## Component Patterns

### Compound Components

**Wanneer:** Multi-part UI met gedeelde state.

```tsx
// Definitie
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

// Gebruik
<Card variant="elevated">
  <Card.Header>Titel</Card.Header>
  <Card.Body>Content hier</Card.Body>
  <Card.Footer>Acties</Card.Footer>
</Card>
```

**Voordelen:**

- Flexibele compositie
- Gedeelde context zonder prop drilling
- Duidelijke hiërarchie

---

### Render Props / Children as Function

**Wanneer:** Behavior delen zonder inheritance.

```tsx
// Definitie
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

// Gebruik
<Toggle>
  {({ isOn, toggle }) => (
    <button onClick={toggle}>{isOn ? "Aan" : "Uit"}</button>
  )}
</Toggle>;
```

**Modern alternatief:** Custom hooks zijn vaak cleaner:

```tsx
function useToggle(initial = false) {
  const [isOn, setIsOn] = useState(initial);
  return { isOn, toggle: () => setIsOn(!isOn), setIsOn };
}

// Gebruik
function MyComponent() {
  const { isOn, toggle } = useToggle();
  return <button onClick={toggle}>{isOn ? "Aan" : "Uit"}</button>;
}
```

---

### Controlled vs Uncontrolled

**Wanneer:** Form handling strategy bepalen.

```tsx
// Uncontrolled (interne state)
function UncontrolledInput() {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    console.log(inputRef.current?.value);
  };

  return <input ref={inputRef} defaultValue="initial" />;
}

// Controlled (externe state)
function ControlledInput({ value, onChange }: Props) {
  return <input value={value} onChange={(e) => onChange(e.target.value)} />;
}

// Hybrid (beide ondersteunen)
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

**Vuistregel:**

- Uncontrolled: Eenvoudige forms, geen real-time validation
- Controlled: Complex forms, validation, dependent fields

---

### Slot Pattern

**Wanneer:** Flexibele layout met named regions.

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

// Gebruik
<PageLayout
  header={<Navigation />}
  sidebar={<FilterPanel />}
  main={<ProductList />}
  footer={<Pagination />}
/>;
```

---

### Polymorphic Components

**Wanneer:** Component moet als verschillende HTML elements renderen.

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

// Gebruik
<Button>Click me</Button>                    // renders <button>
<Button as="a" href="/page">Link</Button>    // renders <a>
<Button as={Link} to="/page">Router</Button> // renders React Router Link
```

---

## State Patterns

### URL State (searchParams)

**Wanneer:** Filters, pagination, shareable state.

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

// Gebruik
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
      <option value="newest">Nieuwste</option>
      <option value="price">Prijs</option>
    </select>
  );
}
```

---

### Context + Reducer

**Wanneer:** Complex shared state met actions.

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

**Wanneer:** Async data met caching.

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

// Gebruik
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

| Level        | Beschrijving                 | Voorbeelden                        | Complexity          |
| ------------ | ---------------------------- | ---------------------------------- | ------------------- |
| **Atom**     | Kleinste UI element          | Button, Input, Badge, Icon         | Single element      |
| **Molecule** | Groep van 2-3 atoms          | SearchBar, FormField, NavItem      | 2-3 atoms           |
| **Organism** | Meerdere molecules           | Header, Card, Sidebar, ProductTile | Multiple molecules  |
| **Template** | Pagina layout zonder content | PageLayout, DashboardTemplate      | Regions only        |
| **Page**     | Template + echte content     | HomePage, ProductPage              | Full implementation |

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
            <h2>Er ging iets mis</h2>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              Probeer opnieuw
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Gebruik
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

// Gebruik
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
// useMemo voor expensive berekeningen
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

// React.memo voor component re-renders
const ProductCard = memo(function ProductCard({
  product,
}: {
  product: Product;
}) {
  return <div>{product.name}</div>;
});

// useCallback voor stable function references
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
// pages/heavy-page.tsx wordt automatisch gesplit

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

**Wanneer:** Data ophalen in Server Components zonder client-side state.

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
    next: { revalidate: 60 }, // ISR: revalidate elke 60s
  });
  if (!res.ok) throw new Error(`Failed to fetch metrics: ${res.status}`);
  const data = await res.json();
  return z.array(MetricSchema).parse(data);
}
```

**Voordelen:**

- Zero client-side JS voor data fetching
- Automatische deduplicatie door React
- Type-safe met Zod validatie

---

### API Service Layer Pattern

**Wanneer:** Gedeelde data access functies voor meerdere components.

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

**Wanneer:** Async data laden met visuele feedback.

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

// Met Suspense (Server Components)
import { Suspense } from "react";

function Dashboard() {
  return (
    <Suspense fallback={<MetricCardSkeleton />}>
      <MetricCard />
    </Suspense>
  );
}

// Met React Query (Client Components)
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

**Wanneer:** API errors graceful afhandelen met gebruikersvriendelijke UI.

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
      <p className="text-sm text-error">Kon data niet laden</p>
      {onRetry && (
        <button onClick={onRetry} className="text-xs text-primary mt-2">
          Opnieuw proberen
        </button>
      )}
    </div>
  );
}

// ErrorBoundary (class component — catches render errors)
// Zie Error Handling Patterns sectie

// React Query error met retry
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

## Integration met Skills

### Wireframe → Pattern Mapping

Wanneer wireframe `data-component` heeft, map naar pattern:

```
data-component="Card" → Compound Components pattern
data-component="Layout" → Slot Pattern
data-component="Form" → Controlled pattern
data-component="List" → Server State pattern
```

### Style → Pattern Mapping

Wanneer style tokens genereren, gebruik patterns:

```
Layout tokens → Responsive Patterns CSS
Component tokens → Compound Components styles
State tokens → Controlled/Uncontrolled indicators
```

### Scaffold → Pattern Implementation

Wanneer components scaffolden:

```
Atom → Simple functional component
Molecule → Composition of atom imports
Organism → Compound component pattern
Template → Slot pattern
Page → Full pattern integration
```

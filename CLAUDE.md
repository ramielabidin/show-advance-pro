# CLAUDE.md

## App Overview

**Advance** is a tour management app for independent musicians. Core features: dashboard, shows (create/edit/advance), tours, settings (team, documents, contacts), PDF/email advance parsing, and show PDF export.

## Tech Stack

- **React 18 + TypeScript** (Vite, path alias `@/` → `src/`)
- **Routing**: React Router v6 — routes defined in `src/main.tsx`
- **Data fetching**: TanStack React Query v5 + Supabase JS client
- **Forms**: React Hook Form + Zod (via shadcn `<Form />` wrapper)
- **UI components**: shadcn UI in `src/components/ui/`, built on Radix UI primitives
- **Icons**: Lucide React
- **Toasts**: Sonner (`toast.success()` / `toast.error()`)
- **Drawers**: Vaul
- **Dark mode**: next-themes (class-based)
- **Fonts**: DM Sans (body), DM Serif Display (display), JetBrains Mono (mono)
- **TypeScript config**: `strict: false`, `noImplicitAny: false` — don't add strict types where the rest of the codebase doesn't use them

## Project Structure

```
src/
  pages/           # Route-level components (*Page.tsx)
  components/
    ui/            # shadcn primitives — don't edit these directly
    *Provider.tsx  # Context providers
    *Dialog.tsx    # Modal workflows (self-contained with state + mutations)
    *Editor.tsx    # Complex form sections
  hooks/           # Custom hooks (use*.ts)
  integrations/supabase/
    client.ts      # Supabase client (typed with Database type)
    types.ts       # Auto-generated DB types
  lib/
    types.ts       # Domain types (Show, Tour, ScheduleEntry, etc.)
    utils.ts       # Utility functions (cn, normalizePhone, formatCityState)
supabase/
  migrations/      # Numbered SQL migrations
```

**Naming conventions:**
- Route pages → `*Page.tsx`
- Modal workflows → `*Dialog.tsx`
- Complex form sections → `*Editor.tsx`
- Custom hooks → `use*.ts`

## Data Fetching

Always wrap Supabase calls in React Query:

```ts
// Queries
const { data } = useQuery({
  queryKey: ["shows", teamId],
  queryFn: async () => {
    const { data, error } = await supabase.from("shows").select("*").eq("team_id", teamId);
    if (error) throw error;
    return data;
  },
  enabled: !!teamId,
});

// Mutations — always invalidate on success
const mutation = useMutation({
  mutationFn: async (payload) => {
    const { error } = await supabase.from("shows").insert(payload);
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["shows"] });
    toast.success("Show created");
  },
  onError: (err: Error) => toast.error(err.message),
});
```

**Query key conventions:** `["shows"]`, `["show", id]`, `["tours"]`, `["band-documents", teamId]` — invalidate the top-level key to bust all related queries.

## Auth & Team Context

- Auth state: `useAuth()` → `{ session, user, loading }`
- Current team: `useTeam()` → `{ teamId, isOwner, ... }`
- Always include `team_id` in inserts — Supabase RLS enforces team isolation and will silently reject rows without it
- All tables have RLS enabled; the service role (edge functions only) bypasses it

## Error Handling

Use toast callbacks on mutations, not try/catch with console.log:

```ts
onSuccess: () => toast.success("Saved"),
onError: (err: Error) => toast.error(err.message),
```

For Supabase queries outside mutations, throw the error and let React Query surface it:

```ts
if (error) throw error;
```

## UI & Design

When making any frontend changes — components, pages, modals, layouts, styling — read and follow `docs/design-system.md` before writing any code.

For logic-only changes (edge functions, migrations, Supabase queries, API routes, utility functions, type definitions), skip the design system doc entirely.

The app uses a dark-mode-first aesthetic (light-mode is also available). Key principles:
- Dark backgrounds, high contrast typography
- Minimal, utilitarian UI — no decorative gradients or heavy shadows
- Smooth, intentional micro-animations (not gratuitous)
- Every user-facing detail should feel considered

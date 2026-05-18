---
title: "Pagination: Server Computes pageCount, Client Uses nuqs for State"
date: 2026-05-18
category: docs/solutions/conventions/
module: "People Directory, Groups"
problem_type: convention
component: frontend_stimulus
severity: high
applies_when:
  - Adding a new paginated data table in a Next.js App Router codebase
  - A client component needs to render pagination controls
  - A database module defines a page size constant for paginated queries
  - Refactoring an existing table that imports page size constants from a DB module
tags:
  - pagination
  - server-client-boundary
  - bundle-error
  - drizzle-orm
  - nextjs-app-router
  - nuqs
  - constants
---

# Pagination: Server Computes pageCount, Client Uses nuqs for State

## Context

During development of the people directory, `people-table.tsx` (a `"use client"` component) imported `PEOPLE_PAGE_SIZE` from `@/db/people` to compute `pageCount` for the pagination control. This caused build failures:

```
Module not found: Can't resolve 'net'
Module not found: Can't resolve 'tls'
```

The import chain: `people-table.tsx` → `src/db/people.ts` → `drizzle-orm/node-postgres` → `pg` → Node.js `net`/`tls`. These built-ins have no browser equivalent and cannot be polyfilled — webpack fails hard.

A first-pass fix moved `PEOPLE_PAGE_SIZE` to `src/lib/utils.ts`. This resolved the bundling error but was rejected: it leaked a database implementation detail (page size is a query-tuning parameter) into a general utility file, and kept pagination math on the client — meaning if the page size changes, both the DB query and client computation must stay in sync.

## Guidance

**Three rules that always apply together:**

1. **Page size constants are unexported local constants in the DB module** — they never leave the server.
2. **Query functions return `pageCount` (and `total`) as data** — the server does the `Math.ceil`.
3. **Client components use [nuqs](https://nuqs.47ng.com/) to manage the `page` URL param** — never `useSearchParams`, `router.push`, or `URLSearchParams`.

### Database layer

```typescript
// src/db/people.ts
const PEOPLE_PAGE_SIZE = 100; // unexported — server only

export interface PaginatedUsers {
  users: PublicUser[];
  total: number;
  pageCount: number; // computed here, passed as data
}

export async function getAllUserPublicData({
  page = 1,
  search = "",
}: { page?: number; search?: string } = {}): Promise<PaginatedUsers> {
  const offset = (page - 1) * PEOPLE_PAGE_SIZE;
  // ...query...
  return {
    users: rows.map(/* ... */),
    total,
    pageCount: Math.ceil(total / PEOPLE_PAGE_SIZE),
  };
}
```

For nested pagination (e.g. group members), follow the same shape — compute inside the DB function:

```typescript
// src/db/groups.ts
const MEMBERS_PAGE_SIZE = 20; // unexported

export interface GroupDetail {
  totalMembers: number;
  memberPageCount: number; // computed server-side
  // ...other fields
}
```

### Server page component

Read `searchParams`, parse `page`, call the DB function, forward `pageCount` and `total` as props:

```typescript
// src/app/(authenticated)/(app)/people/directory/page.tsx
export default async function DirectoryPage({ searchParams }: DirectoryPageProps) {
  const { page: pageParam, q: search = "" } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const { users, total, pageCount } = await getAllUserPublicData({ page, search });

  return (
    <DirectoryPageClient
      users={users}
      total={total}
      pageCount={pageCount}   // plain number — no constant import needed
      initialSearch={search}
    />
  );
}
```

### Client component

Accept `pageCount` as a prop and use **nuqs** for the `page` and `q` URL params:

```typescript
// src/components/people-table.tsx
"use client";

import { parseAsInteger, parseAsString, useQueryState } from "nuqs";

interface PeopleTableProps {
  data: PublicUser[];
  total: number;
  pageCount: number; // received as prop, not computed here
  initialSearch: string;
}

export function PeopleTable({ data, total, pageCount, initialSearch }: PeopleTableProps) {
  const [page, setPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1).withOptions({ shallow: false }),
  );
  const [search, setSearch] = useQueryState(
    "q",
    parseAsString
      .withDefault(initialSearch)
      .withOptions({ throttleMs: 300, clearOnDefault: true, shallow: false }),
  );

  // Use pageCount directly — no math, no DB imports
  return (
    <>
      {/* table */}
      {pageCount > 1 && (
        <div className="flex items-center gap-2">
          <Button onClick={() => setPage(page - 1)} disabled={page <= 1}>Previous</Button>
          <span>{page} / {pageCount}</span>
          <Button onClick={() => setPage(page + 1)} disabled={page >= pageCount}>Next</Button>
        </div>
      )}
    </>
  );
}
```

## Why This Matters

**Bundle leakage is non-obvious and breaks hard.** A client component importing from `@/db/*` — even just a number constant — pulls the entire module graph into the browser bundle, including Drizzle's Node.js adapter and `pg`. The error (`Cannot resolve 'net'`) points at `pg` internals, not at the line in your component, so it takes real investigation to trace back.

**The client has no business knowing the page size.** `pageCount` is a derived value: `Math.ceil(total / PAGE_SIZE)`. The page size is a server-side query tuning parameter. The client needs the result, not the inputs. Keeping this computation on the server means page size can change in one place without any client-side updates.

**nuqs is the only approved way to manage URL state.** It handles serialization, SSR hydration, deduplication, and shallow routing correctly. `useSearchParams` requires a Suspense boundary to work correctly in App Router and doesn't support throttling or type-safe parsing out of the box.

## When to Apply

- Any new query function that accepts a `page` parameter must return `pageCount` and `total` in its result type.
- Any new client component that renders a paginator must declare `pageCount: number` in its props and must not import from `@/db/*`.
- Any client component with a search or filter input must manage the URL param with `useQueryState` from nuqs.
- Any existing component that currently computes `pageCount` from an imported constant must be refactored to receive it as a prop.

## Examples

**Anti-pattern — client imports page size constant:**

```typescript
// people-table.tsx — WRONG
"use client";
import { PEOPLE_PAGE_SIZE } from "@/db/people"; // pulls pg → net/tls into browser bundle

function PeopleTable({ data, total }: { data: PublicUser[]; total: number }) {
  const pageCount = Math.ceil(total / PEOPLE_PAGE_SIZE); // client does pagination math
}
```

**Anti-pattern — constant moved to utils (wrong fix):**

```typescript
// src/lib/utils.ts — STILL WRONG
export const PEOPLE_PAGE_SIZE = 20; // DB implementation detail has no place here
```

**Correct pattern — end to end:**

```typescript
// src/db/people.ts (server only)
const PEOPLE_PAGE_SIZE = 100; // unexported
export async function getAllUserPublicData(...) {
  return { users, total, pageCount: Math.ceil(total / PEOPLE_PAGE_SIZE) };
}

// src/app/.../page.tsx (server component)
const { users, total, pageCount } = await getAllUserPublicData({ page, search });
return <PeopleTable data={users} total={total} pageCount={pageCount} initialSearch={search} />;

// src/components/people-table.tsx (client component)
"use client";
import { parseAsInteger, useQueryState } from "nuqs";
interface PeopleTableProps { data: PublicUser[]; total: number; pageCount: number; initialSearch: string; }
function PeopleTable({ data, total, pageCount }: PeopleTableProps) {
  const [page, setPage] = useQueryState("page", parseAsInteger.withDefault(1).withOptions({ shallow: false }));
  // pageCount is a plain number prop — no DB imports, no math
}
```

## Related

- `docs/solutions/conventions/reusable-permission-policy-api-2026-05-02.md` — related server/client boundary convention for authorization
- [nuqs docs](https://nuqs.47ng.com/) — the approved URL state library
- `docs/plans/2026-05-12-002-feat-payments-three-table-layout-plan.md` — real-world example of the same data shape (`getApprovedPaymentsPage` returning `{ rows, total }`)

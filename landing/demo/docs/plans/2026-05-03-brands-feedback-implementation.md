# Brands UX Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply four UX feedback fixes to the demo web app — drop the fake browser chrome, make the Brands table fully functional (row click + dropdown menu + working search), give brand-detail an always-visible upload card, and make the Source-PDF card entirely clickable.

**Architecture:** Pure React + CSS work in `apps/web`. No API or schema changes. Reuse existing shadcn primitives (`DropdownMenu`, `Dialog`, `Button`, `Input`) and the existing `api.brands.rename` / `api.brands.archive` client methods. New small components for the two dialogs and the replace-PDF card.

**Tech Stack:** React 19, TanStack Router (file-based) + Query, shadcn/ui (Radix), Tailwind 4 OKLCH tokens, Playwright + axe-core.

**Spec:** `landing/demo/docs/specs/2026-05-03-brands-feedback-design.md`

---

## File map

Modify:
- `apps/web/src/components/Shell.tsx` — drop `.chrome` block (lines 25-50).
- `apps/web/src/components/Shell.css` — drop `.chrome*` rules; adjust `.app` grid.
- `apps/web/src/features/brands/BrandsList.tsx` — row navigation, dropdown menu, search wired.
- `apps/web/src/features/brands/brands.css` — `.brands-table tr[role="button"]` cursor + hover; new `.dropdown-action` styles.
- `apps/web/src/features/brand-detail/BrandDetail.tsx` — always render upload card variant.
- `apps/web/src/features/brand-detail/UploadCard.tsx` — split into empty-state-only (no copy change required, scope checks variant).
- `apps/web/src/features/brand-detail/SourcePdfCard.tsx` — wrap entire card in `<a>`.
- `apps/web/src/features/brand-detail/brand-detail.css` — `.source-card-link` hover state; `.replace-card` styles.

Create:
- `apps/web/src/features/brands/RenameBrandDialog.tsx`
- `apps/web/src/features/brands/DeleteBrandDialog.tsx`
- `apps/web/src/features/brand-detail/ReplaceWithPdfCard.tsx`

Tests touched:
- `e2e/tests/smoke.spec.ts` — gets a rename + delete step.
- `e2e/tests/visual.spec.ts-snapshots/*` — re-captured for `/brands` and `/brands/:id`.

---

## Task 1: Drop fake browser chrome

**Files:**
- Modify: `apps/web/src/components/Shell.tsx`
- Modify: `apps/web/src/components/Shell.css`

- [ ] **Step 1: Read `Shell.tsx` to confirm the chrome block bounds**

Run: `grep -n 'chrome\|<aside\|<main' apps/web/src/components/Shell.tsx | head`

Expected: a `.chrome` div spans roughly lines 25-50, sibling to `.app`.

- [ ] **Step 2: Remove the chrome JSX from `Shell.tsx`**

Open `apps/web/src/components/Shell.tsx`. Delete the entire block:

```tsx
      <div className="chrome">
        <div className="chrome-dots" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="chrome-url">
          <svg ...><rect .../><path .../></svg>
          <span>studio.superside.app{path === "/" ? "/brands" : path}</span>
        </div>
        <div className="chrome-actions" aria-hidden="true">
          <span className="chrome-btn"></span>
          <span className="chrome-btn"></span>
        </div>
      </div>
```

If `path` is now unused, also drop the corresponding hook at the top of the component (TanStack Router's `useRouterState({ select: (s) => s.location.pathname })`).

- [ ] **Step 3: Remove chrome CSS from `Shell.css`**

In `apps/web/src/components/Shell.css`, delete every rule that targets `.chrome`, `.chrome-dots`, `.chrome-url`, `.chrome-actions`, or `.chrome-btn`. Adjust the page-shell padding so the sidebar and main content do not look pushed-up: top padding ~`1.5rem` on `.sidebar` and `.app-main`.

- [ ] **Step 4: Verify in browser**

Run from `landing/demo/`:

```bash
pnpm --filter @studio/web typecheck
```

Expected: clean exit. Visit http://localhost:5173/brands — no fake URL bar at the top.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Shell.tsx apps/web/src/components/Shell.css
git commit -m "demo: drop fake browser chrome from Shell"
```

---

## Task 2: BrandsList — controlled search + filtered render

**Files:**
- Modify: `apps/web/src/features/brands/BrandsList.tsx`

- [ ] **Step 1: Add search state and filtered list**

In `BrandsList.tsx`, replace the existing component head:

```tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
// existing imports remain
```

Inside the component, before `return`:

```tsx
const navigate = useNavigate();
const [query, setQuery] = useState("");
const inputRef = useRef<HTMLInputElement>(null);

const filtered = useMemo(() => {
  const list = q.data ?? [];
  if (!query) return list;
  const needle = query.toLowerCase();
  return list.filter((b) => b.name.toLowerCase().includes(needle));
}, [q.data, query]);

useEffect(() => {
  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, []);
```

- [ ] **Step 2: Replace the readOnly input with a real input**

Find the existing search markup:

```tsx
<input
  type="text"
  placeholder="Search brands"
  aria-label="Search brands"
  tabIndex={-1}
  readOnly
/>
```

Replace with:

```tsx
<input
  ref={inputRef}
  type="text"
  placeholder="Search brands"
  aria-label="Search brands"
  value={query}
  onChange={(e) => setQuery(e.target.value)}
/>
```

- [ ] **Step 3: Render `filtered` instead of `q.data` in the table body**

Replace `{q.data.map((b, i) => {` with `{filtered.map((b, i) => {` (the existing length checks above should also use `filtered`).

Update the empty-state block to handle "no match" vs "no brands":

```tsx
{q.data && q.data.length === 0 && (
  <div className="border border-[var(--color-hairline)] rounded p-6 text-center">
    <p className="text-[var(--color-charcoal)] text-[0.9375rem]">No brands yet.</p>
    <p className="text-[var(--color-stone)] text-[0.8125rem] mt-1">
      Create one to upload a guideline PDF.
    </p>
  </div>
)}

{q.data && q.data.length > 0 && filtered.length === 0 && (
  <div className="border border-[var(--color-hairline)] rounded p-6 text-center">
    <p className="text-[var(--color-charcoal)] text-[0.9375rem]">
      No brands match “{query}”.
    </p>
  </div>
)}
```

The `<table>` block now renders only when `filtered.length > 0`.

- [ ] **Step 4: Typecheck + manual smoke**

```bash
pnpm --filter @studio/web typecheck
```

Visit /brands. Type "slack" → only Slack remains. Hit ⌘K → input focuses. Clear → all rows return.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/brands/BrandsList.tsx
git commit -m "demo: brands search wired client-side with ⌘K"
```

---

## Task 3: BrandsList — row click navigation

**Files:**
- Modify: `apps/web/src/features/brands/BrandsList.tsx`
- Modify: `apps/web/src/features/brands/brands.css`

- [ ] **Step 1: Replace the brand-name `<Link>` with a plain span**

The existing brand cell:

```tsx
<td>
  <Link
    to="/brands/$brandId"
    params={{ brandId: b.id }}
    className="brand-link"
  >
    <span className="brand-glyph" ...>{glyph}</span>
    <span className="brand-name">{b.name}</span>
  </Link>
</td>
```

Becomes:

```tsx
<td>
  <span className="brand-link">
    <span className="brand-glyph" style={{ background: `oklch(85% 0.06 ${hue})` }}>
      {glyph}
    </span>
    <span className="brand-name">{b.name}</span>
  </span>
</td>
```

Drop the now-unused `Link` import.

- [ ] **Step 2: Make the `<tr>` keyboard-navigable**

```tsx
<tr
  key={b.id}
  role="button"
  tabIndex={0}
  aria-label={`Open ${b.name}`}
  onClick={() => navigate({ to: "/brands/$brandId", params: { brandId: b.id } })}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      navigate({ to: "/brands/$brandId", params: { brandId: b.id } });
    }
  }}
>
```

- [ ] **Step 3: Stop propagation on the action cell**

The `<td className="row-action">` (the cell that will host the dropdown in Task 4) wraps with:

```tsx
<td className="row-action" onClick={(e) => e.stopPropagation()}>
  ...
</td>
```

This prevents the dropdown from triggering row navigation.

- [ ] **Step 4: Add hover and pointer styles**

In `brands.css`:

```css
.brands-table tbody tr {
  cursor: pointer;
  transition: background-color 120ms var(--ease-out-quart);
}
.brands-table tbody tr:hover,
.brands-table tbody tr:focus-visible {
  background: var(--color-sunken);
}
.brands-table tbody tr:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
}
```

- [ ] **Step 5: Manual smoke**

Click any cell of the Slack row → `/brands/<id>` opens. Tab into the row, hit Enter → also navigates.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/brands/BrandsList.tsx apps/web/src/features/brands/brands.css
git commit -m "demo: brands rows are clickable + keyboard-navigable"
```

---

## Task 4: RenameBrandDialog component

**Files:**
- Create: `apps/web/src/features/brands/RenameBrandDialog.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { api } from "../../lib/api";

interface Props {
  brandId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameBrandDialog({ brandId, currentName, open, onOpenChange }: Props) {
  const [name, setName] = useState(currentName);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  const m = useMutation({
    mutationFn: (newName: string) => api.brands.rename(brandId, newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      onOpenChange(false);
    },
  });

  const trimmed = name.trim();
  const disabled = trimmed.length === 0 || trimmed === currentName || m.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename brand</DialogTitle>
          <DialogDescription>
            Pick a new name for <strong>{currentName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled) m.mutate(trimmed);
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-brand-name">Brand name</Label>
            <Input
              id="rename-brand-name"
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {m.isError && (
            <p className="text-[0.8125rem] text-[oklch(50%_0.13_25)]">
              {(m.error as Error).message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={disabled}>
              {m.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @studio/web typecheck
```

If `Label` is missing, scaffold it as a minimal pass-through (`function Label(props: ComponentProps<'label'>) { return <label {...props} /> }`) — most shadcn templates already include it.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/brands/RenameBrandDialog.tsx
git commit -m "demo: RenameBrandDialog component"
```

---

## Task 5: DeleteBrandDialog component

**Files:**
- Create: `apps/web/src/features/brands/DeleteBrandDialog.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";

interface Props {
  brandId: string;
  brandName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteBrandDialog({ brandId, brandName, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api.brands.archive(brandId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {brandName}?</DialogTitle>
          <DialogDescription>
            The brand and its guideline history will be hidden from the list. Generations and
            usage rows for audit purposes are kept.
          </DialogDescription>
        </DialogHeader>
        {m.isError && (
          <p className="text-[0.8125rem] text-[oklch(50%_0.13_25)]">
            {(m.error as Error).message}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={m.isPending}
            onClick={() => m.mutate()}
          >
            {m.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Confirm `Button` has a `destructive` variant**

If `apps/web/src/components/ui/button.tsx` does not include `destructive`, add this variant token:

```tsx
// inside the cva variants for Button
destructive:
  "bg-[oklch(50%_0.16_25)] text-[var(--color-cream)] hover:bg-[oklch(45%_0.18_25)]",
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @studio/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/brands/DeleteBrandDialog.tsx apps/web/src/components/ui/button.tsx
git commit -m "demo: DeleteBrandDialog component"
```

---

## Task 6: BrandsList — three-dots dropdown wires Rename + Delete

**Files:**
- Modify: `apps/web/src/features/brands/BrandsList.tsx`
- Modify: `apps/web/src/features/brands/brands.css`

- [ ] **Step 1: Add per-row state for the two dialogs**

The list re-renders frequently; track only the open one to avoid extra re-renders:

```tsx
const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
```

Render the dialogs after the table:

```tsx
{renameTarget && (
  <RenameBrandDialog
    brandId={renameTarget.id}
    currentName={renameTarget.name}
    open
    onOpenChange={(o) => !o && setRenameTarget(null)}
  />
)}
{deleteTarget && (
  <DeleteBrandDialog
    brandId={deleteTarget.id}
    brandName={deleteTarget.name}
    open
    onOpenChange={(o) => !o && setDeleteTarget(null)}
  />
)}
```

Add imports at the top:

```tsx
import { RenameBrandDialog } from "./RenameBrandDialog";
import { DeleteBrandDialog } from "./DeleteBrandDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
```

- [ ] **Step 2: Replace the static SVG with a DropdownMenu**

Inside the row's action `<td>`:

```tsx
<td className="row-action" onClick={(e) => e.stopPropagation()}>
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button
        type="button"
        className="row-menu-btn"
        aria-label={`Actions for ${b.name}`}
      >
        <svg width="14" height="3" viewBox="0 0 14 3" fill="currentColor" aria-hidden="true">
          <circle cx="2" cy="1.5" r="1" />
          <circle cx="7" cy="1.5" r="1" />
          <circle cx="12" cy="1.5" r="1" />
        </svg>
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={() => setRenameTarget({ id: b.id, name: b.name })}>
        Rename
      </DropdownMenuItem>
      <DropdownMenuItem
        className="row-menu-danger"
        onSelect={() => setDeleteTarget({ id: b.id, name: b.name })}
      >
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</td>
```

- [ ] **Step 3: Style the trigger and danger item**

In `brands.css`:

```css
.row-menu-btn {
  background: transparent;
  border: none;
  color: var(--color-stone);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  line-height: 0;
}
.row-menu-btn:hover {
  background: var(--color-sunken);
  color: var(--color-charcoal);
}
.row-menu-danger {
  color: oklch(50% 0.16 25);
}
```

- [ ] **Step 4: Manual smoke**

```bash
# from landing/demo
pnpm --filter @studio/web typecheck
```

In the browser: open the menu on the `testing` row → click Rename → save → row updates. Open the menu again → Delete → confirm → row disappears.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/brands/BrandsList.tsx apps/web/src/features/brands/brands.css
git commit -m "demo: brands row dropdown — rename + delete"
```

---

## Task 7: ReplaceWithPdfCard component

**Files:**
- Create: `apps/web/src/features/brand-detail/ReplaceWithPdfCard.tsx`
- Modify: `apps/web/src/features/brand-detail/brand-detail.css`

- [ ] **Step 1: Create the component**

```tsx
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";

interface Props {
  brandId: string;
}

export function ReplaceWithPdfCard({ brandId }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (f: File) => api.profiles.upload(brandId, f),
    onMutate: () => setStatus("Uploading…"),
    onSuccess: () => {
      setStatus("Queued for extraction");
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
    onError: (e) => setStatus(`Error: ${(e as Error).message}`),
  });

  return (
    <section className="replace-card">
      <header>
        <p className="eyebrow">guideline</p>
        <h2>Replace with new PDF</h2>
      </header>
      <p className="replace-card-body">
        Upload a new brand-guideline PDF. The current version stays current until extraction
        succeeds.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
        }}
      />
      <div className="replace-card-actions">
        <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? "Uploading…" : "Upload PDF"}
        </Button>
      </div>
      {status && <p className="replace-card-status mono">{status}</p>}
    </section>
  );
}
```

- [ ] **Step 2: Add `.replace-card` styles**

Append to `apps/web/src/features/brand-detail/brand-detail.css`:

```css
.replace-card {
  margin-top: 2rem;
  padding: 1.25rem 1.5rem;
  border: 1px solid var(--color-hairline);
  border-radius: 6px;
  background: var(--color-sunken);
}
.replace-card header h2 {
  font-family: var(--font-serif);
  font-size: 1.125rem;
  letter-spacing: -0.005em;
  margin: 0;
}
.replace-card-body {
  font-size: 0.875rem;
  color: var(--color-reading);
  margin: 0.4rem 0 1rem;
  max-width: 60ch;
}
.replace-card-actions {
  display: flex;
  gap: 0.5rem;
}
.replace-card-status {
  font-size: 0.75rem;
  color: var(--color-stone);
  margin: 0.6rem 0 0;
  letter-spacing: 0.02em;
}
```

- [ ] **Step 3: Typecheck**

```bash
pnpm --filter @studio/web typecheck
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/brand-detail/ReplaceWithPdfCard.tsx apps/web/src/features/brand-detail/brand-detail.css
git commit -m "demo: ReplaceWithPdfCard for ready-state brand detail"
```

---

## Task 8: BrandDetail — render ReplaceWithPdfCard when current is ready

**Files:**
- Modify: `apps/web/src/features/brand-detail/BrandDetail.tsx`

- [ ] **Step 1: Import the new component**

Top of file:

```tsx
import { ReplaceWithPdfCard } from "./ReplaceWithPdfCard";
```

- [ ] **Step 2: Render under the editor when current is ready**

Find the existing block:

```tsx
{current?.status === "ready" && current.profile && (
  <ProfileEditor profileId={current.id} initial={current.profile} brandId={brandId} />
)}
```

Replace with:

```tsx
{current?.status === "ready" && current.profile && (
  <>
    <ProfileEditor profileId={current.id} initial={current.profile} brandId={brandId} />
    <ReplaceWithPdfCard brandId={brandId} />
  </>
)}
```

- [ ] **Step 3: Typecheck + manual smoke**

```bash
pnpm --filter @studio/web typecheck
```

Visit `/brands/<slack-id>` → editor renders + Replace card sits below it. Upload `infra/seed-pdfs/heineken.pdf` (any PDF) → page transitions to processing banner via existing SSE wiring.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/brand-detail/BrandDetail.tsx
git commit -m "demo: brand detail always shows upload affordance"
```

---

## Task 9: SourcePdfCard — entire card clickable

**Files:**
- Modify: `apps/web/src/features/brand-detail/SourcePdfCard.tsx`
- Modify: `apps/web/src/features/brand-detail/brand-detail.css`

- [ ] **Step 1: Wrap entire card in `<a>` when `s3Key` exists**

Replace the whole `SourcePdfCard.tsx` body:

```tsx
interface Props {
  filename: string;
  sizeBytes: number;
  s3Key: string | null;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function SourcePdfCard({ filename, sizeBytes, s3Key }: Props) {
  const inner = (
    <>
      <div className="source-icon" aria-hidden="true">
        <svg width="22" height="28" viewBox="0 0 22 28" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 1.5 H15 L20 6.5 V26.5 H3 Z" />
          <path d="M15 1.5 V6.5 H20" />
          <path d="M6 12 H17 M6 16 H17 M6 20 H13" strokeWidth="1.2" />
        </svg>
      </div>
      <div className="source-meta">
        <p className="source-name">{filename}</p>
        <p className="source-sub">{formatSize(sizeBytes)}</p>
      </div>
      <span className="source-arrow" aria-hidden="true">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M2 9 L9 2 M4 2 L9 2 L9 7" />
        </svg>
      </span>
    </>
  );

  if (!s3Key) {
    return <div className="source-card">{inner}</div>;
  }

  const href = `/api/_storage/${s3Key}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="source-card source-card-link"
      aria-label={`Download ${filename}`}
    >
      {inner}
    </a>
  );
}
```

- [ ] **Step 2: Add link hover styles**

Append to `brand-detail.css`:

```css
.source-card-link {
  display: flex;
  text-decoration: none;
  color: inherit;
  transition: border-color 120ms var(--ease-out-quart),
              background-color 120ms var(--ease-out-quart);
}
.source-card-link:hover {
  border-color: oklch(70% 0.005 50);
  background: var(--color-sunken);
}
.source-card-link:hover .source-arrow {
  transform: translateX(2px);
}
.source-arrow {
  margin-left: auto;
  color: var(--color-stone);
  display: inline-flex;
  transition: transform 120ms var(--ease-out-quart);
}
.source-card-link:focus-visible {
  outline: none;
  box-shadow: var(--shadow-focus);
  border-radius: 4px;
}
```

If the existing `.source-card` rule already has display + padding, leave it; only add what is missing.

Also remove the now-unused `path` segment of the trailing arrow that used to live as its own anchor (the old rule was `.source-link`). Drop `.source-link` rules.

- [ ] **Step 3: Manual smoke**

`/brands/<slack-id>` → click anywhere on the source-PDF card. Browser tab opens with the PDF served via `/api/_storage/profiles/seed-slack.pdf`.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/features/brand-detail/SourcePdfCard.tsx apps/web/src/features/brand-detail/brand-detail.css
git commit -m "demo: SourcePdfCard entire card clickable"
```

---

## Task 10: Smoke spec gets a rename + delete step

**Files:**
- Modify: `e2e/tests/smoke.spec.ts`

- [ ] **Step 1: Add a rename + delete sequence after the existing path**

Append at the end of the existing test (or a new test in the same file):

```ts
test("brands table — dropdown rename + delete", async ({ page, request }) => {
  // create a fresh brand via API so we don't depend on seed names
  const created = await request
    .post("http://localhost:3001/api/brands", { data: { name: `RenameTarget-${Date.now()}` } })
    .then((r) => r.json());

  await page.goto("/brands");

  const row = page.getByRole("button", { name: new RegExp(`Open ${created.name}`) });
  await expect(row).toBeVisible();

  await page.getByRole("button", { name: `Actions for ${created.name}` }).click();
  await page.getByRole("menuitem", { name: "Rename" }).click();
  const newName = `${created.name}-renamed`;
  await page.getByLabel("Brand name").fill(newName);
  await page.getByRole("button", { name: "Save" }).click();

  await expect(
    page.getByRole("button", { name: new RegExp(`Open ${newName}`) }),
  ).toBeVisible();

  await page.getByRole("button", { name: `Actions for ${newName}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("button", { name: "Delete" }).click();

  await expect(
    page.getByRole("button", { name: new RegExp(`Open ${newName}`) }),
  ).toHaveCount(0);
});
```

- [ ] **Step 2: Run the spec**

```bash
pnpm --filter @studio/e2e test --grep "brands table"
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/smoke.spec.ts
git commit -m "demo: e2e — brands rename + delete via row dropdown"
```

---

## Task 11: Re-capture visual regression baselines

**Files:**
- Modify: `e2e/tests/visual.spec.ts-snapshots/*.png` (auto-regenerated)

- [ ] **Step 1: Update snapshots**

```bash
pnpm --filter @studio/e2e test --grep visual --update-snapshots
```

Open each regenerated PNG and confirm:
- `/brands` baseline has no chrome bar; search input shows real cursor; row hover affordance.
- `/brands/:id` baseline shows the Replace-with-PDF card under the editor; source-PDF card with full hover affordance.

- [ ] **Step 2: Commit**

```bash
git add e2e/tests/visual.spec.ts-snapshots
git commit -m "demo: re-capture visual baselines after UX feedback fixes"
```

---

## Task 12: a11y audit on the changed pages

**Files:** none

- [ ] **Step 1: Run axe**

```bash
pnpm --filter @studio/e2e test --grep a11y
```

Expected: zero serious/critical violations on every route.

If the dropdown menu or dialogs trip a violation (rare: missing aria-haspopup or focus order), patch the offending component inline and re-run.

- [ ] **Step 2: Commit (if any patches)**

```bash
git commit -am "demo: a11y patches after UX feedback fixes"
```

---

## Acceptance recap (matches spec § 7)

1. No fake browser chrome on any route → Task 1.
2. Clicking anywhere on a brands-table row navigates to that brand's detail page → Task 3.
3. The three-dots menu opens a dropdown with Rename and Delete; both work end-to-end → Tasks 4, 5, 6.
4. Typing in the brands search filters the visible rows; ⌘K focuses the input → Task 2.
5. A `ready` brand shows a Replace-with-PDF card; uploading a PDF transitions to processing → Tasks 7, 8.
6. Clicking anywhere on the source-PDF sidebar card downloads the PDF → Task 9.
7. axe-core reports no new serious or critical violations → Task 12.

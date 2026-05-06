# Studio Demo — Brands UX Feedback

**Date:** 2026-05-03
**Status:** Approved (brainstorming complete)
**Location:** `landing/demo/apps/web/`

## 1. Goal

Address four pieces of UX feedback from the demo session:

1. The fake browser chrome at the top of every page reads as left-over scaffolding.
2. The Brands table only navigates from the brand-name cell, has a non-functional three-dots indicator (no rename, no delete), and a search input that is intentionally `readOnly` despite advertising a ⌘K hotkey.
3. Once a brand has a hand-authored profile, there is no way to upload a PDF for re-extraction without dropping back to the empty state.
4. The Source-PDF card on the brand-detail sidebar only opens when the user clicks the small arrow icon; the entire card should be the click target.

All fixes are surface-level; no API change is required.

## 2. Scope

### In
- `apps/web/src/components/Shell.tsx` and `Shell.css`: remove the chrome bar.
- `apps/web/src/features/brands/BrandsList.tsx` and `brands.css`: row navigation, dropdown menu, working search.
- New `apps/web/src/features/brands/RenameBrandDialog.tsx` and `DeleteBrandDialog.tsx`.
- `apps/web/src/features/brand-detail/BrandDetail.tsx`: always-visible upload card variants.
- New `apps/web/src/features/brand-detail/ReplaceWithPdfCard.tsx`.
- `apps/web/src/features/brand-detail/SourcePdfCard.tsx`: full card clickable.

### Out
- API changes (none needed; `PATCH /api/brands/:id { name?, archived? }` already supports rename and soft-delete).
- Schema changes.
- Anything beyond the four items above.

## 3. Design per block

### 3.1 Shell — drop fake browser chrome

Remove the `.chrome` div (lines 25-50 of `Shell.tsx`) and the corresponding CSS rules (`.chrome`, `.chrome-dots`, `.chrome-url`, `.chrome-actions`, `.chrome-btn`). The `.app` grid drops one row, so the sidebar and main column start at the viewport top. Adjust top padding on `.sidebar` and `.app-main` to maintain breathing room (current chrome height was ~36px; redistribute via existing tokens).

### 3.2 Brands table — row navigation, dropdown menu, search

#### 3.2.1 Row navigation

Replace the `<Link>` inside the brand-name cell with a row-level click handler. The `<tr>` becomes `role="button"`, `tabIndex={0}`, and registers `onClick` + `onKeyDown` (Enter / Space → preventDefault → navigate). Cursor is pointer; existing hover background remains. The action cell calls `event.stopPropagation()` so menu interactions do not navigate.

Use TanStack Router `useNavigate()` for navigation. Drop `<Link>` import.

#### 3.2.2 Three-dots dropdown

Replace the inert SVG in the action cell with a shadcn `DropdownMenu`:

```
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button aria-label="More actions" onClick={(e) => e.stopPropagation()}>...</button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="end">
    <DropdownMenuItem onSelect={() => setRenameOpen(true)}>Rename</DropdownMenuItem>
    <DropdownMenuItem onSelect={() => setDeleteOpen(true)} class="danger">Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

The two dialogs are siblings of the menu, gated by local state per row.

#### 3.2.3 RenameBrandDialog

shadcn `Dialog`. Single labelled `Input` pre-filled with the current name. Save button calls `api.brands.rename(id, name)`, invalidates `['brands']`, closes on success. Disabled when name is empty or unchanged. Errors render under the input via toast.

#### 3.2.4 DeleteBrandDialog

shadcn `Dialog`. Title: `Delete {brand.name}?`. Body warns that the brand and its guideline history will be hidden from the list (we soft-delete; rows remain for audit). Two buttons: Cancel (default) + Delete (danger). Confirm calls `api.brands.archive(id)`, invalidates `['brands']`.

#### 3.2.5 Search wired

Replace `readOnly` input with a controlled state:

```
const [query, setQuery] = useState("");
const filtered = useMemo(
  () => (q.data ?? []).filter(b => b.name.toLowerCase().includes(query.toLowerCase())),
  [q.data, query],
);
```

Render `filtered` in the table. ⌘K (or Ctrl+K) keydown listener focuses the input and selects existing text. Empty-state copy when filtered list is empty: `No brands match "{query}".`

### 3.3 BrandDetail — always-visible Replace-with-PDF card

The current page renders `<UploadCard>` only when there is no current profile. Always render an upload card. Two variants:

- `<UploadCard brandId>` — empty-state. Heading `No guideline yet.` Two buttons: `Upload PDF` + `Hand-author`. Renders when `!current`.
- `<ReplaceWithPdfCard brandId>` — replace flow. Heading `Replace with new PDF`. Single button: `Upload PDF`. Renders when `current.status === 'ready'`.

`ReplaceWithPdfCard` reuses the existing upload mutation: `api.profiles.upload(brandId, file)` creates a new processing version. The existing `useProfileEvents` SSE wiring picks up the new processing row and swaps the editor to the processing banner.

Position: under the editor, above the sidebar on narrow viewports. Visually grouped with the editor block via the same hairline frame rhythm used elsewhere on the page.

### 3.4 SourcePdfCard — entire card clickable

The card currently has a small arrow icon as the only `<a>` element. Change the wrapper from `<div className="source-card">` to `<a href={href} className="source-card source-card-link">`. Move the arrow inside as a passive visual hint. When `s3Key` is null, render a plain `<div>` (no link). Add hover affordance on the link variant: border darkens, arrow shifts 2px right, cursor pointer.

## 4. Data flow

No API or schema change. All work is React + CSS.

## 5. Accessibility

- Row navigation must work with keyboard (Enter/Space) and not steal focus from in-row interactive children.
- Dropdown menu uses Radix primitives → focus trap + Escape close are free.
- Dialogs use Radix Dialog → focus trap + return-focus on close are free.
- Search input keeps its label and ⌘K hint; the keyboard shortcut listener does not interfere with form input.
- Source-PDF anchor has `aria-label={`Download ${filename}`}` so screen readers do not just say "link".

## 6. Testing

- Existing Playwright a11y suite re-runs against the changed pages; no new violations allowed.
- Smoke spec gets a new step: rename brand from the table dropdown, then delete it, then verify it disappears from the list.
- Visual baselines for `/brands` and `/brands/:id` need to be re-captured because the chrome bar is gone and the upload card is now always present.

## 7. Acceptance criteria

1. No fake browser chrome on any route.
2. Clicking anywhere on a brands-table row (except the menu) navigates to that brand's detail page.
3. The three-dots menu opens a dropdown with Rename and Delete; both work end-to-end against the seeded data.
4. Typing in the brands search filters the visible rows in real time; ⌘K focuses the input.
5. A brand whose profile is `ready` shows a `Replace with new PDF` card under the editor; uploading a PDF transitions the page to the processing state.
6. Clicking anywhere on the Source-PDF sidebar card on a `ready` profile downloads (or opens) the PDF.
7. axe-core reports no new serious or critical violations on `/brands` and `/brands/:id`.

# CLAUDE.md — ColdChain Frozen Warehouse Inventory

## Project Overview

**ColdChain** is a Progressive Web App (PWA) for frozen warehouse inventory management. It is a **single-file application** — the entire app lives in `index.html` with embedded CSS and JavaScript. No build tools, no npm, no framework.

**Tech Stack:**
- Vanilla JavaScript (ES6+), HTML5, CSS3
- Optional Supabase backend (loaded from CDN on demand)
- PWA: Service Worker (`service-worker.js`) + Web App Manifest (`manifest.json`)
- Fonts: IBM Plex Sans & IBM Plex Mono (Google Fonts, optional/graceful degradation)

## Repository Structure

```
Frozen-Inventory/
├── index.html          # Complete application (~2,400 lines)
├── manifest.json       # PWA manifest (app name, icons, shortcuts)
├── service-worker.js   # Offline caching strategy
└── CLAUDE.md           # This file
```

There is no build process, no `node_modules`, no `package.json`. Deployment is as simple as serving the files over HTTP.

## Architecture

### Single-File Design

All application logic, styles, and markup live in `index.html`. This is intentional — it enables zero-dependency deployment (email attachment, GitHub Pages, S3, etc.).

**Internal code sections** are delineated with `── ` divider comments. Key sections:
- Supabase CDN loader
- State management (`inventory[]`, `txnLog[]`, `dbMode`, `realtimeChannel`)
- Supabase config & CRUD operations
- Realtime subscription handlers
- Data converters (Supabase ↔ local format)
- Local cache management (localStorage)
- Helper functions (status labels, date formatting, cost formatting)
- Stats calculation
- Table rendering & sorting
- Reports rendering
- Modal handlers (Add Item, Stock Movement, DB Setup)
- `CC` diagnostics object
- PWA features (manifest injection, SW registration, install prompt)
- Network status detection
- Clock updates, tab switching, CSV export

### State Management

Global state is managed with simple module-level variables:

```javascript
let inventory = [];         // Current inventory items
let txnLog = [];            // Transaction/movement history
let dbMode = 'local';       // 'local' | 'supabase'
let realtimeChannel = null; // Supabase realtime subscription
```

### Storage Strategy

**Local Storage keys:**
- `coldchain_inventory` — JSON array of inventory items
- `coldchain_txn_log` — JSON array of all movements
- `coldchain_supabase_config` — Supabase connection details (URL + anon key)

**Supabase (optional):**
- `inventory` table — full inventory state
- `movements` table — complete audit trail
- Real-time Postgres Changes subscription for live collaboration

## Data Shapes

### Inventory Item (in-memory / localStorage)

```javascript
{
  id,           // string (UUID)
  name,         // string
  category,     // string
  sku,          // string
  quantity,     // number
  par,          // number (par level / reorder point)
  weight,       // string (e.g., "5 lbs")
  temp,         // string ('standard'|'deep'|'ultra'|'fresh')
  location,     // string (warehouse zone)
  expiration,   // string (ISO date YYYY-MM-DD)
  received,     // string (ISO date YYYY-MM-DD)
  supplier,     // string
  cost,         // number (cost per unit)
  notes         // string
}
```

### Transaction / Movement

```javascript
{
  id,       // string (UUID)
  itemId,   // string (FK → inventory.id)
  name,     // string (item name at time of transaction)
  sku,      // string
  dir,      // 'in' | 'out'
  amount,   // number
  before,   // number (qty before movement)
  after,    // number (qty after movement)
  reason,   // string (pre-defined reason list)
  note,     // string (optional free text)
  time      // string (ISO datetime)
}
```

## Supabase Database Schema

When Supabase is configured, the app creates these tables via inline SQL (shown in the DB Setup modal):

**`inventory` table** — maps from in-memory item with snake_case column names (`par_level`, `storage_temp`, `expiration_date`, `received_date`, `cost_per_unit`, `created_at`, `updated_at`).

**`movements` table** — maps from in-memory transaction with column names (`item_id`, `item_name`, `item_sku`, `direction`, `qty_before`, `qty_after`, `created_at`).

**RLS:** Public read/write is enabled (no authentication). If you add auth, update the RLS policies.

## Design System

### CSS Custom Properties (Theme)

```css
--bg: #0a0e14        /* Dark navy background */
--surface: #111722   /* Card/panel backgrounds */
--accent: #00c4ff    /* Cyan primary accent */
--cold: #7dd3fc      /* Light cyan secondary */
--warn: #f59e0b      /* Amber warnings */
--danger: #ef4444    /* Red alerts/errors */
--success: #22c55e   /* Green success states */
--text: #e2e8f0      /* Primary text (light) */
--muted: #64748b     /* Secondary/muted text */
--mono: 'IBM Plex Mono'
--sans: 'IBM Plex Sans'
```

### Naming Conventions

- **HTML element IDs:**
  - Form inputs: `f-{fieldname}` (e.g., `f-name`, `f-sku`, `f-quantity`)
  - Stat widgets: `stat-{name}` (e.g., `stat-skus`, `stat-low`)
  - Stock movement modal components: `move-{component}`
- **CSS classes:** hyphen-separated BEM-style (e.g., `.stat-card`, `.btn-primary`, `.table-wrap`)
- **JavaScript functions:** camelCase, descriptive (e.g., `renderTable`, `openMoveModal`, `syncToSupabase`)
- **Constants:** `UPPER_CASE`

### Responsive Breakpoint

Mobile-first; primary breakpoint at `768px`. Stats grid collapses from 4 to 2 columns; reports grid collapses to single column.

## Key Functions Reference

| Function | Description |
|---|---|
| `init()` | App startup — loads config, connects Supabase, loads data, renders UI |
| `renderTable()` | Re-renders the inventory table based on current filters/sort |
| `renderStats()` | Updates the 4 stat widgets (SKUs, low stock, expiring, total units) |
| `renderAlerts()` | Refreshes the active alerts panel |
| `renderReports()` | Renders reports tab content |
| `openMoveModal(id)` | Opens the Stock IN/OUT modal for a specific item |
| `submitMove()` | Processes a stock movement, saves to storage, updates UI |
| `saveItem()` | Saves new or edited inventory item |
| `deleteItem(id)` | Deletes an item after confirmation |
| `exportCSV()` | Downloads inventory as `coldchain_inventory_YYYY-MM-DD.csv` |
| `connectSupabase()` | Validates and saves Supabase connection config |
| `subscribeRealtime()` | Subscribes to Supabase Postgres Changes |
| `toast(msg, type)` | Shows a transient notification (`'success'`\|`'error'`\|`'info'`) |

## PWA & Offline Behavior

- Service Worker uses **network-first** for app files (picks up updates), **cache-first** for Google Fonts
- Precached files: `./`, `./frozen-inventory.html`, `manifest.json`
- App works fully offline with localStorage data
- Sync status indicator in header: `LIVE`, `SYNCING`, `LOCAL`, `OFFLINE`, `ERROR`
- Background sync and push notification hooks are stubbed and ready for future implementation

## Development Workflow

### Making Changes

Since there's no build step, edit `index.html` directly and refresh in the browser.

1. **Edit** `index.html` (and/or `service-worker.js`, `manifest.json`)
2. **Test** by opening in a browser — use a local HTTP server for full PWA functionality:
   ```bash
   python3 -m http.server 8080
   # or
   npx serve .
   ```
3. **Verify** offline behavior by throttling network in DevTools → Application → Service Workers
4. **Commit** and push changes

### Testing Supabase Integration

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Copy the SQL schema from the DB Setup modal in the app
3. Run the SQL in the Supabase SQL editor
4. Enter the Project URL and anon key in the app's DB Setup modal
5. Test real-time sync by opening the app in two browser tabs

### No Tests

There are no automated tests. Manual testing in the browser is the current approach. If adding tests, consider:
- Playwright for E2E testing (good fit for a PWA)
- Plain JS unit tests for pure functions (stats calculations, data converters, date helpers)

## Common Modification Patterns

### Adding a New Inventory Field

1. Add the field to the Add/Edit Item form HTML (use ID `f-{fieldname}`)
2. Add it to the `saveItem()` function — both reading from the form and constructing the item object
3. Add it to `renderTable()` if it should show as a column
4. Add column to the Supabase schema SQL (shown in DB Setup modal) if using cloud sync
5. Update data converters (`supabaseToLocal()` / `localToSupabase()`) for the new field

### Adding a New Stock Movement Reason

Find the `<select>` for reasons in the stock movement modal and add an `<option>`.

### Changing the Color Theme

Update the CSS custom properties in the `:root` block near the top of the `<style>` section in `index.html`.

### Adding a New Dashboard Tab

1. Add a `<button class="tab-btn">` in the tabs nav
2. Add a `<div class="tab-pane" id="tab-{name}">` section
3. Wire up the tab in the `switchTab()` function

## Diagnostics

The `CC` object provides console diagnostics:

```javascript
CC.log(msg)    // Cyan-colored log
CC.warn(msg)   // Warning
CC.error(msg)  // Error
CC.group(label, fn)  // Grouped output
```

On startup, `CC.group('ColdChain Init', ...)` logs the initialization sequence. Open the browser console to see detailed startup info and any Supabase errors.

## Important Notes for AI Assistants

- **Do not add a build system** unless explicitly requested. The zero-dependency single-file design is a core feature, not a limitation.
- **Do not split the single file** into separate JS/CSS modules without explicit direction — it would break the deployment model.
- **Preserve the dark theme** — all new UI elements should use the CSS custom properties (e.g., `var(--surface)`, `var(--accent)`) rather than hardcoded colors.
- **Keep Supabase optional** — the app must function fully offline with localStorage. Any Supabase calls must be guarded with `if (dbMode === 'supabase')` or equivalent.
- **Maintain the audit trail** — any operation that changes inventory quantities must log a movement to `txnLog` (and Supabase `movements` table if connected).
- **The `manifest.json` start URL** is `./frozen-inventory.html` — this is intentional for PWA scope; if renaming the main file, update this.
- **Service Worker versioning** — when making changes that should invalidate the cache, bump `CACHE_NAME` in `service-worker.js` (e.g., `coldchain-v1` → `coldchain-v2`).

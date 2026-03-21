# Source Visibility Fix & Sources Tab — Design Spec

**Date:** 2026-03-21
**Status:** Approved

---

## Problem

1. **Cache hit → source items invisible during simulation**: `analyzer.py` returns cached results immediately without calling `on_source_done`, so no `sim_source_item` events are emitted. The "Searching sources" phase in the simulation UI shows nothing.

2. **Collected source items not visible on result page**: Raw items fetched from GitHub, arxiv, Reddit, etc. are only used internally for analysis. Users can never browse what was actually collected.

---

## Solution Overview

Two independent changes:

1. **Fix cache path** in `analyzer.py` to emit `on_source_done` even on cache hit.
2. **Add Sources tab** to the result page, backed by persisting `raw_items` in the DB.

---

## Architecture

### Change 1: Cache hit source emission (`analyzer.py`)

**File:** `backend/analyzer.py` only. No changes to `tasks.py` or `SimulatePage.tsx` for this change.

At the cache hit early-return path (lines 73–76), group cached items by `source` field and call `on_source_done` per source before returning.

```python
cached = get_cached(input_text)
if cached is not None:
    if on_source_done is not None:
        by_source: dict[str, list[dict]] = {}
        for item in cached:
            by_source.setdefault(item.get("source", "unknown"), []).append(item)
        for source_name, items in by_source.items():
            on_source_done(source_name, items)
    return cached
```

**GDELT asymmetry (intentional):** On a live fetch, GDELT runs with its own timeout and never passes through `on_source_done` — this is pre-existing behavior. On a cache hit, GDELT items are present in the cache and will be emitted via `sim_source_item` events. Fixing the live path is out of scope. Note: GDELT items will appear in the Sources tab (Change 2) regardless, since they are stored in `raw_items`. This minor UX inconsistency is acceptable.

**Note on `on_source_done`:** The callback in `tasks.py` only publishes `title` and `snippet` for the streaming UI — this is intentional. Full item data reaches the DB separately via `raw_items` (Change 2).

---

### Change 2: Sources tab on result page

#### 2a. DB schema (`backend/db.py`)

Two places must be updated:

1. **Base DDL** — add `sources_json` to the `CREATE TABLE IF NOT EXISTS sim_results` statement (for fresh DBs):

```sql
CREATE TABLE IF NOT EXISTS sim_results (
    sim_id TEXT PRIMARY KEY,
    posts_json TEXT NOT NULL DEFAULT '{}',
    personas_json TEXT NOT NULL DEFAULT '{}',
    report_json TEXT NOT NULL DEFAULT '{}',
    report_md TEXT NOT NULL DEFAULT '',
    analysis_md TEXT NOT NULL DEFAULT '',
    sources_json TEXT NOT NULL DEFAULT '[]'
);
```

2. **Migration** — for existing DBs (try/except pattern, consistent with existing migrations):

```python
try:
    conn.execute("ALTER TABLE sim_results ADD COLUMN sources_json TEXT NOT NULL DEFAULT '[]'")
    conn.commit()
except Exception:
    pass
```

Update `save_sim_results()` — new signature and named-column INSERT:

```python
def save_sim_results(
    path: str | Path,
    sim_id: str,
    posts: dict,
    personas: dict,
    report_json: dict,
    report_md: str,
    analysis_md: str = "",
    raw_items: list[dict] | None = None,
) -> None:
    with _conn(path) as conn:
        conn.execute(
            "INSERT OR REPLACE INTO sim_results "
            "(sim_id, posts_json, personas_json, report_json, report_md, analysis_md, sources_json) "
            "VALUES (?,?,?,?,?,?,?)",
            (sim_id, json.dumps(posts), json.dumps(personas),
             json.dumps(report_json), report_md, analysis_md,
             json.dumps(raw_items or [])),
        )
```

Update `get_sim_results()` to parse `sources_json`:

```python
d["sources_json"] = json.loads(d.get("sources_json") or "[]")
```

**`main.py`: no change required.** The `/results/{sim_id}` endpoint returns the dict from `get_sim_results()` directly via FastAPI's JSON serialization — `sources_json` will be included automatically.

**Deployment order:** `init_db()` runs at startup before any request is served, so schema and code are always in sync.

#### 2b. Save raw items (`backend/tasks.py`)

Pass `raw_items` to `save_sim_results()`:

```python
save_sim_results(
    DB_PATH, sim_id,
    posts_by_platform, personas_by_platform,
    report_json, report_md,
    analysis_md=analysis_md,
    raw_items=raw_items,
)
```

#### 2c. Frontend types (`frontend/src/types.ts`)

Add `SourceItem` interface. `id` and `score` are required — `RawItem.to_dict()` always emits both (`score` defaults to `0.0`).

```ts
export interface SourceItem {
  id: string
  title: string
  source: string
  score: number
  url?: string
  text?: string
  date?: string
  metadata?: Record<string, unknown>
}
```

Add to `SimResults`:
```ts
sources_json: SourceItem[]
```

**`api.ts`: no change required.** `getResults()` uses `res.json()` with a direct cast — `sources_json` passes through automatically.

#### 2d. Source color constants (`frontend/src/constants.ts`)

New file. `SOURCE_COLORS` is currently duplicated across `SimulatePage.tsx`, `DemoSimulatePage.tsx`, and `DemoPage.tsx`. All three remove their local declarations and import from here. `PLATFORM_COLORS` is not extracted — it is only used in `SimulatePage.tsx` and is out of scope for this change.

```ts
export const SOURCE_COLORS: Record<string, string> = {
  github: '#24292e',
  arxiv: '#b91c1c',
  semantic_scholar: '#1d4ed8',
  hackernews: '#f97316',
  reddit: '#ef4444',
  product_hunt: '#da552f',
  itunes: '#fc3158',
  google_play: '#01875f',
  gdelt: '#7c3aed',
  serper: '#0891b2',
}
```

#### 2e. New component (`frontend/src/components/SourcesView.tsx`)

Props: `sources: SourceItem[]`

Renders a list of source cards sorted by `score` descending. Each card:
- **Source badge** — colored label using `SOURCE_COLORS`
- **Score** — right-aligned, 1 decimal place
- **Title** — linked to `url` if available; plain text otherwise
- **Snippet** — first 140 chars of `text`; omitted if empty

React key per card: `item.id` (always present and unique).

Empty state: display a short message when `sources` is empty.

#### 2f. Result page (`frontend/src/pages/ResultPage.tsx`)

Update `Tab` type alias:
```ts
type Tab = 'analysis' | 'report' | 'feed' | 'personas' | 'sources'
```

Add to `tabs` array:
```ts
{ id: 'sources', label: 'Sources' }
```

Add tab panel:
```tsx
{tab === 'sources' && (
  <SourcesView sources={results.sources_json ?? []} />
)}
```

---

## Data Flow

```
analyze() → raw_items
    ↓ (cache miss)  on_source_done per source → sim_source_item events → SimulatePage UI
    ↓ (cache hit)   on_source_done per source (grouped from cache) → same events
    ↓
tasks.py: save_sim_results(..., raw_items=raw_items)
    ↓
db.py: sources_json column
    ↓
GET /results/{sim_id} → sources_json parsed as list
    ↓
ResultPage → Sources tab → SourcesView
```

---

## Files Changed

- `backend/analyzer.py` — call `on_source_done` on cache hit path
- `backend/db.py` — add `sources_json` to CREATE TABLE DDL and ALTER TABLE migration; update `save_sim_results()` with named-column INSERT and `raw_items` param; update `get_sim_results()` to parse `sources_json`
- `backend/tasks.py` — pass `raw_items` to `save_sim_results()`
- `frontend/src/types.ts` — add `SourceItem` interface, add `sources_json` to `SimResults`
- `frontend/src/constants.ts` — new file: shared `SOURCE_COLORS`
- `frontend/src/components/SourcesView.tsx` — new component
- `frontend/src/pages/ResultPage.tsx` — update `Tab` type, add Sources tab
- `frontend/src/pages/SimulatePage.tsx` — remove local `SOURCE_COLORS`, import from `../constants`
- `frontend/src/pages/DemoSimulatePage.tsx` — remove local `SOURCE_COLORS`, import from `../constants`
- `frontend/src/pages/DemoPage.tsx` — remove local `SOURCE_COLORS`, import from `../constants`

---

## Error Handling

- Old DB records missing `sources_json`: `get_sim_results()` uses `or "[]"` fallback — no crash.
- Frontend uses `results.sources_json ?? []` — safe for older records.
- `SourcesView` renders an empty state when `sources` is empty.
- DB migration uses try/except (silently ignored if column already exists).
- `SourceItem.id` always present — React keys are stable and unique.

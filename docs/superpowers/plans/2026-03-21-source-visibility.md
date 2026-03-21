# Source Visibility Fix & Sources Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix cache-hit source items being invisible during simulation and add a Sources tab to the result page showing all collected items with title, source badge, URL, and relevance score.

**Architecture:** Two independent changes — (1) `analyzer.py` calls `on_source_done` on cache hit so the streaming UI shows source items even when results are cached; (2) `raw_items` are persisted in a new `sources_json` DB column and surfaced via a new Sources tab in the result page.

**Tech Stack:** Python/FastAPI, SQLite, Celery, React 18, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-21-source-visibility-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `backend/db.py` | Modify | Add `sources_json` column to DDL + migration; update `save_sim_results()` and `get_sim_results()` |
| `backend/analyzer.py` | Modify | Call `on_source_done` per source group on cache hit |
| `backend/tasks.py` | Modify | Pass `raw_items` to `save_sim_results()` |
| `frontend/src/types.ts` | Modify | Add `SourceItem` interface; add `sources_json` to `SimResults` |
| `frontend/src/constants.ts` | Create | Shared `SOURCE_COLORS` constant |
| `frontend/src/components/SourcesView.tsx` | Create | Source card list component |
| `frontend/src/pages/ResultPage.tsx` | Modify | Add Sources tab |
| `frontend/src/pages/SimulatePage.tsx` | Modify | Import `SOURCE_COLORS` from constants |
| `frontend/src/pages/DemoSimulatePage.tsx` | Modify | Import `SOURCE_COLORS` from constants |
| `frontend/src/pages/DemoPage.tsx` | Modify | Import `SOURCE_COLORS` from constants |
| `tests/test_db.py` | Modify | Add tests for `sources_json` save/get |
| `tests/test_analyzer.py` | Create | Test cache-hit `on_source_done` behavior |

---

## Task 1: DB — `sources_json` column

**Files:**
- Modify: `backend/db.py`
- Modify: `tests/test_db.py`

- [ ] **Step 1: Write failing tests**

Open `tests/test_db.py` and add at the bottom:

```python
def test_save_and_get_results_with_sources(db_path):
    sim_id = "test-sources-001"
    create_simulation(db_path, sim_id, "test", "English", {}, "tech")
    raw_items = [
        {"id": "item-1", "title": "Test Repo", "source": "github",
         "url": "https://github.com/test/repo", "score": 0.9, "text": "A test repo"},
        {"id": "item-2", "title": "Test Paper", "source": "arxiv",
         "url": "https://arxiv.org/abs/1234", "score": 0.7, "text": "A test paper"},
    ]
    save_sim_results(
        db_path, sim_id,
        posts={"hackernews": []},
        personas={"hackernews": []},
        report_json={"verdict": "positive"},
        report_md="## Report",
        raw_items=raw_items,
    )
    result = get_sim_results(db_path, sim_id)
    assert isinstance(result["sources_json"], list)
    assert len(result["sources_json"]) == 2
    assert result["sources_json"][0]["source"] == "github"
    assert result["sources_json"][1]["title"] == "Test Paper"


def test_get_results_sources_json_defaults_to_empty_list(db_path):
    """Old records without sources_json should return [] not raise an error."""
    sim_id = "test-sources-002"
    create_simulation(db_path, sim_id, "test", "English", {}, "tech")
    # Save without raw_items (simulates old code path)
    save_sim_results(
        db_path, sim_id,
        posts={},
        personas={},
        report_json={},
        report_md="",
    )
    result = get_sim_results(db_path, sim_id)
    assert result["sources_json"] == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/taeyoungpark/Desktop/noosphere
python -m pytest tests/test_db.py::test_save_and_get_results_with_sources tests/test_db.py::test_get_results_sources_json_defaults_to_empty_list -v
```

Expected: FAIL — `save_sim_results() got an unexpected keyword argument 'raw_items'`

- [ ] **Step 3: Update `backend/db.py` — CREATE TABLE DDL**

In `init_db()`, find the `CREATE TABLE IF NOT EXISTS sim_results (...)` block inside the existing `conn.executescript(...)` call and add only the `sources_json` line at the end of the `sim_results` column list.

⚠️ **Do NOT modify the `simulations` table DDL.** Only change `sim_results`.

Before:
```sql
CREATE TABLE IF NOT EXISTS sim_results (
    sim_id TEXT PRIMARY KEY,
    posts_json TEXT NOT NULL DEFAULT '{}',
    personas_json TEXT NOT NULL DEFAULT '{}',
    report_json TEXT NOT NULL DEFAULT '{}',
    report_md TEXT NOT NULL DEFAULT '',
    analysis_md TEXT NOT NULL DEFAULT ''
);
```

After (add one line):
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

- [ ] **Step 4: Add migration for existing DBs**

In `init_db()`, after the existing `analysis_md` migration block, add:

```python
try:
    conn.execute("ALTER TABLE sim_results ADD COLUMN sources_json TEXT NOT NULL DEFAULT '[]'")
    conn.commit()
except Exception:
    pass  # 이미 있으면 무시
```

- [ ] **Step 5: Update `save_sim_results()`**

Replace the function with:

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

- [ ] **Step 6: Update `get_sim_results()`**

After the existing `json.loads` calls for `posts_json`/`personas_json`/`report_json`, add:

```python
d["sources_json"] = json.loads(d.get("sources_json") or "[]")
```

- [ ] **Step 7: Run tests to verify they pass**

```bash
python -m pytest tests/test_db.py -v
```

Expected: All tests PASS including the two new ones.

- [ ] **Step 8: Commit**

```bash
git add backend/db.py tests/test_db.py
git commit -m "feat: add sources_json column to sim_results DB"
```

---

## Task 2: Backend — cache hit `on_source_done`

**Files:**
- Modify: `backend/analyzer.py`
- Create: `tests/test_analyzer.py`

- [ ] **Step 1: Write failing test**

Create `tests/test_analyzer.py`:

```python
import pytest
from unittest.mock import AsyncMock, patch, MagicMock

@pytest.mark.asyncio
async def test_cache_hit_calls_on_source_done():
    """on_source_done should be called per source group when cache is warm."""
    from backend.analyzer import analyze

    cached_items = [
        {"id": "a", "title": "GitHub repo", "source": "github", "score": 0.9},
        {"id": "b", "title": "HN post", "source": "hackernews", "score": 0.7},
        {"id": "c", "title": "HN post 2", "source": "hackernews", "score": 0.6},
    ]

    calls: list[tuple[str, list]] = []

    def on_source_done(source_name: str, items: list) -> None:
        calls.append((source_name, items))

    with patch("backend.analyzer.get_cached", return_value=cached_items):
        result = await analyze("test input", on_source_done=on_source_done)

    assert result == cached_items
    sources_called = {name for name, _ in calls}
    assert sources_called == {"github", "hackernews"}
    # hackernews group should have 2 items
    hn_items = next(items for name, items in calls if name == "hackernews")
    assert len(hn_items) == 2


@pytest.mark.asyncio
async def test_cache_hit_no_callback_still_returns():
    """Cache hit without on_source_done should work without error."""
    from backend.analyzer import analyze

    cached_items = [{"id": "a", "title": "T", "source": "github", "score": 0.5}]

    with patch("backend.analyzer.get_cached", return_value=cached_items):
        result = await analyze("test input", on_source_done=None)

    assert result == cached_items


@pytest.mark.asyncio
async def test_cache_miss_does_not_call_on_source_done_from_cache():
    """On cache miss, on_source_done is called per source only by the live search wrappers."""
    from backend.analyzer import analyze

    calls: list[str] = []

    def on_source_done(source_name: str, items: list) -> None:
        calls.append(source_name)

    with patch("backend.analyzer.get_cached", return_value=None), \
         patch("backend.analyzer.extract_concepts", new_callable=AsyncMock,
               return_value={
                   "search_queries": ["test"],
                   "domain_type": "general",
                   "query_bundles": {},
               }), \
         patch("backend.analyzer.set_cache"):
        result = await analyze("test input", on_source_done=on_source_done)

    # No sources searched (empty query_bundles), so no calls
    assert calls == []
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python -m pytest tests/test_analyzer.py -v
```

Expected: `test_cache_hit_calls_on_source_done` FAIL — callback not called.

- [ ] **Step 3: Update `backend/analyzer.py` — cache hit path**

Find the cache hit block (around line 73) and replace with:

```python
cached = get_cached(input_text)
if cached is not None:
    logger.info("Cache hit for input_text (len=%d)", len(input_text))
    if on_source_done is not None:
        by_source: dict[str, list[dict]] = {}
        for item in cached:
            by_source.setdefault(item.get("source", "unknown"), []).append(item)
        for source_name, items in by_source.items():
            on_source_done(source_name, items)
    return cached
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python -m pytest tests/test_analyzer.py -v
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/analyzer.py tests/test_analyzer.py
git commit -m "fix: emit on_source_done on cache hit in analyzer"
```

---

## Task 3: Backend — save `raw_items` in task

**Files:**
- Modify: `backend/tasks.py`

No new tests needed — the DB test in Task 1 already covers the `raw_items` persistence path. This task just wires the existing data to the updated function.

- [ ] **Step 1: Update `save_sim_results()` call in `backend/tasks.py`**

Find the `save_sim_results(...)` call (around line 106) and add `raw_items=raw_items`:

```python
save_sim_results(
    DB_PATH, sim_id,
    posts_by_platform, personas_by_platform,
    report_json, report_md,
    analysis_md=analysis_md,
    raw_items=raw_items,
)
```

`raw_items` is already available in scope — it's assigned at line 57 from `await analyze(...)`.

- [ ] **Step 2: Verify existing tests still pass**

```bash
python -m pytest tests/test_db.py tests/test_analyzer.py -v
```

Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add backend/tasks.py
git commit -m "feat: persist raw_items as sources_json in simulation results"
```

---

## Task 4: Frontend — types and shared constants

**Files:**
- Modify: `frontend/src/types.ts`
- Create: `frontend/src/constants.ts`

- [ ] **Step 1: Add `SourceItem` and update `SimResults` in `frontend/src/types.ts`**

Add the `SourceItem` interface after the existing interfaces (before `SimResults`):

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

Add `sources_json` to `SimResults`:

```ts
export interface SimResults {
  sim_id: string
  posts_json: Partial<Record<Platform, SocialPost[]>>
  personas_json: Partial<Record<Platform, Persona[]>>
  report_json: ReportJSON
  report_md: string
  analysis_md: string
  sources_json: SourceItem[]
}
```

- [ ] **Step 2: Create `frontend/src/constants.ts`**

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

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types.ts frontend/src/constants.ts
git commit -m "feat: add SourceItem type and shared SOURCE_COLORS constant"
```

---

## Task 5: Frontend — `SourcesView` component

**Files:**
- Create: `frontend/src/components/SourcesView.tsx`

- [ ] **Step 1: Create `frontend/src/components/SourcesView.tsx`**

```tsx
import { SOURCE_COLORS } from '../constants'
import type { SourceItem } from '../types'

interface Props {
  sources: SourceItem[]
}

export function SourcesView({ sources }: Props) {
  if (sources.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14, padding: '48px 0' }}>
        No source items collected.
      </div>
    )
  }

  const sorted = [...sources].sort((a, b) => b.score - a.score)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
        {sources.length} items collected
      </div>
      {sorted.map(item => (
        <div
          key={item.id}
          style={{
            padding: '10px 14px',
            borderRadius: 8,
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderLeft: `3px solid ${SOURCE_COLORS[item.source] || '#94a3b8'}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8,
              background: SOURCE_COLORS[item.source] ? `${SOURCE_COLORS[item.source]}18` : '#f1f5f9',
              color: SOURCE_COLORS[item.source] || '#64748b',
              textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>
              {item.source}
            </span>
            <span style={{ fontSize: 11, color: '#94a3b8', fontVariantNumeric: 'tabular-nums' }}>
              {item.score.toFixed(1)}
            </span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', lineHeight: 1.4 }}>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ color: '#1e293b', textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                {item.title}
              </a>
            ) : item.title}
          </div>
          {item.text && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.5 }}>
              {item.text.slice(0, 140)}{item.text.length > 140 ? '…' : ''}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles without errors**

```bash
cd /Users/taeyoungpark/Desktop/noosphere/frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/SourcesView.tsx
git commit -m "feat: add SourcesView component for result page"
```

---

## Task 6: Frontend — Sources tab in `ResultPage`

**Files:**
- Modify: `frontend/src/pages/ResultPage.tsx`

- [ ] **Step 1: Update imports in `ResultPage.tsx`**

Add import at the top:

```ts
import { SourcesView } from '../components/SourcesView'
```

- [ ] **Step 2: Update `Tab` type**

Find `type Tab = 'analysis' | 'report' | 'feed' | 'personas'` and change to:

```ts
type Tab = 'analysis' | 'report' | 'feed' | 'personas' | 'sources'
```

- [ ] **Step 3: Add Sources tab to tabs array**

Find the `tabs` array and add the new entry:

```ts
const tabs: { id: Tab; label: string }[] = [
  { id: 'analysis', label: 'Analysis' },
  { id: 'report', label: 'Simulation' },
  { id: 'feed', label: 'Social Feed' },
  { id: 'personas', label: 'Personas' },
  { id: 'sources', label: 'Sources' },
]
```

- [ ] **Step 4: Add Sources tab panel**

Inside `<div key={tab} className="tab-content">`, add after the `personas` panel:

```tsx
{tab === 'sources' && (
  <SourcesView sources={results.sources_json ?? []} />
)}
```

- [ ] **Step 5: Verify TypeScript compiles without errors**

```bash
cd /Users/taeyoungpark/Desktop/noosphere/frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/ResultPage.tsx
git commit -m "feat: add Sources tab to result page"
```

---

## Task 7: Frontend — deduplicate `SOURCE_COLORS`

**Files:**
- Modify: `frontend/src/pages/SimulatePage.tsx`
- Modify: `frontend/src/pages/DemoSimulatePage.tsx`
- Modify: `frontend/src/pages/DemoPage.tsx`

- [ ] **Step 1: Update `SimulatePage.tsx`**

Remove the local `SOURCE_COLORS` constant (the `const SOURCE_COLORS: Record<string, string> = { ... }` block at the top of the file).

Add import:

```ts
import { SOURCE_COLORS } from '../constants'
```

- [ ] **Step 2: Update `DemoSimulatePage.tsx`**

Same change: remove local `SOURCE_COLORS`, add:

```ts
import { SOURCE_COLORS } from '../constants'
```

- [ ] **Step 3: Update `DemoPage.tsx`**

Same change: remove local `SOURCE_COLORS`, add:

```ts
import { SOURCE_COLORS } from '../constants'
```

- [ ] **Step 4: Verify TypeScript compiles without errors**

```bash
cd /Users/taeyoungpark/Desktop/noosphere/frontend
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Run full backend test suite**

```bash
cd /Users/taeyoungpark/Desktop/noosphere
python -m pytest tests/ -v --ignore=tests/test_llm.py
```

Expected: All tests PASS.

- [ ] **Step 6: Final commit**

```bash
git add frontend/src/pages/SimulatePage.tsx \
        frontend/src/pages/DemoSimulatePage.tsx \
        frontend/src/pages/DemoPage.tsx
git commit -m "refactor: deduplicate SOURCE_COLORS into shared constants"
```

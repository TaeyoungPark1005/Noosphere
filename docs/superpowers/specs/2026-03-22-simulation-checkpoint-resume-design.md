# Simulation Checkpoint & Resume Design

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Backend checkpoint persistence + worker resume + frontend SSE reconnect + Resume button

---

## Problem

Simulations run up to 12 rounds via a Celery worker streaming events over Redis Streams to the frontend via SSE. Two failure modes cause data loss and poor UX:

1. **SSE connection drop**: The frontend `onerror` handler closes the connection immediately. The worker is still running, but the user sees "Connection lost" and cannot reconnect.
2. **Worker crash**: All accumulated round data (`platform_states`, `platform_personas`) lives only in the worker's memory. `save_sim_results()` is called only on completion. A crash at round 10/12 loses all data.

---

## Goals

- Checkpoint round state to DB after every completed round
- Resume a failed simulation from the last checkpoint (not round 1) via a user-initiated button
- Auto-reconnect SSE on transient network drops using `Last-Event-ID`

## Non-goals

- Automatic resume without user action
- Resuming the analysis / persona-generation phases (these are re-used from the checkpoint)
- Resuming mid-round (only completed rounds are checkpointed)

---

## Architecture

### New DB table: `sim_checkpoints`

```sql
CREATE TABLE IF NOT EXISTS sim_checkpoints (
    sim_id TEXT PRIMARY KEY,
    last_round INTEGER NOT NULL,
    platform_states_json TEXT NOT NULL,
    personas_json TEXT NOT NULL,
    context_nodes_json TEXT NOT NULL,
    domain TEXT NOT NULL,
    analysis_md TEXT NOT NULL,
    ontology_json TEXT,
    raw_items_json TEXT NOT NULL,
    saved_at TEXT NOT NULL
);
```

One row per simulation, overwritten after each completed round. Deleted on successful completion (cleanup).

### Checkpoint data

All data required to reconstruct the simulation loop state without re-running expensive pre-simulation steps:

| Field | Contents |
|-------|----------|
| `last_round` | Last successfully completed round number |
| `platform_states_json` | `{platform_name: [{id, platform, author_node_id, author_name, content, action_type, round_num, upvotes, downvotes, parent_id}, ...]}` |
| `personas_json` | `{platform_name: [{node_id, name, role, age, generation, seniority, affiliation, company, mbti, interests, skepticism, commercial_focus, innovation_openness}, ...]}` |
| `context_nodes_json` | Original context nodes list |
| `domain` | Detected domain string |
| `analysis_md` | Analysis report markdown |
| `ontology_json` | Ontology dict (nullable) |
| `raw_items_json` | Raw source items list |

---

## Backend Changes

### `db.py`

Add three functions:

```python
def save_checkpoint(path, sim_id, last_round, platform_states, personas,
                    context_nodes, domain, analysis_md, ontology, raw_items) -> None
def get_checkpoint(path, sim_id) -> dict | None
def delete_checkpoint(path, sim_id) -> None
```

`init_db()` creates the `sim_checkpoints` table and runs migration if needed.

### `tasks.py`

**On task start:**
1. Read checkpoint via `get_checkpoint(DB_PATH, sim_id)`
2. If checkpoint exists, extract `start_round = checkpoint["last_round"] + 1` and pass all checkpoint data into `run_simulation()`

**After each `sim_round_summary` event:**
```python
if event["type"] == "sim_round_summary":
    await asyncio.to_thread(
        save_checkpoint,
        DB_PATH, sim_id,
        event["round_num"],
        current_platform_states,
        current_personas,
        context_nodes, domain_str, analysis_md, ontology, raw_items,
    )
```

**On successful completion:**
- Call `delete_checkpoint(DB_PATH, sim_id)` after `save_sim_results()`

**On resume start:**
- Publish `sim_resume` event so frontend knows it's a resumed run:
  ```json
  {"type": "sim_resume", "from_round": 10}
  ```

### `social_runner.py`

Add `checkpoint` parameter to `run_simulation()`:

```python
async def run_simulation(
    ...,
    checkpoint: dict | None = None,
) -> AsyncGenerator[dict, None]:
```

When `checkpoint` is provided:
- Skip persona generation loop → restore `platform_personas` from checkpoint dicts → reconstruct `Persona` dataclass instances
- Skip seed post generation → restore `platform_states` from checkpoint dicts → reconstruct `PlatformState` + `SocialPost` dataclass instances
- Set loop range to `range(checkpoint["last_round"] + 1, num_rounds + 1)`
- Yield `sim_resume` event with `from_round` before entering the round loop

Dataclass reconstruction helpers (private functions in `social_runner.py`):
- `_restore_platform_states(checkpoint_dict) -> dict[str, PlatformState]`
- `_restore_personas(checkpoint_dict) -> dict[str, list[Persona]]`

### `main.py`

**New endpoint: `POST /simulate/{sim_id}/resume`**

```python
@app.post("/simulate/{sim_id}/resume")
async def resume_simulation(sim_id: str):
    sim = get_simulation(DB_PATH, sim_id)
    if not sim:
        raise HTTPException(404, "Simulation not found")
    if sim["status"] not in {"failed"}:
        raise HTTPException(400, f"Only failed simulations can be resumed (status: {sim['status']})")
    checkpoint = get_checkpoint(DB_PATH, sim_id)
    if not checkpoint:
        raise HTTPException(409, "No checkpoint available; restart from scratch")

    # Reset DB status to running
    update_simulation_status(DB_PATH, sim_id, "running")

    # Re-dispatch Celery task with same sim_id and original config
    config = json.loads(sim["config_json"])
    run_simulation_task.apply_async(args=[sim_id, config], task_id=sim_id)
    return {"sim_id": sim_id, "resuming_from_round": checkpoint["last_round"] + 1}
```

**New endpoint: `GET /simulate/{sim_id}/status`**

Returns current simulation status and last checkpointed round (for frontend polling):

```python
@app.get("/simulate/{sim_id}/status")
async def simulation_status(sim_id: str):
    sim = get_simulation(DB_PATH, sim_id)
    if not sim:
        raise HTTPException(404, "Not found")
    checkpoint = get_checkpoint(DB_PATH, sim_id)
    return {
        "status": sim["status"],
        "last_round": checkpoint["last_round"] if checkpoint else 0,
    }
```

**SSE endpoint: `Last-Event-ID` support**

```python
@app.get("/simulate-stream/{sim_id}")
async def simulate_stream(sim_id: str, request: Request):
    last_event_id = request.headers.get("Last-Event-ID", "0") or "0"
    # Use last_event_id as starting position instead of hardcoded "0"
    ...
    async def event_generator():
        last_id = last_event_id
        while True:
            results = await r.xread({stream_key: last_id}, count=100, block=30_000)
            for _stream_name, messages in results:
                for msg_id, fields in messages:
                    last_id = msg_id
                    raw = fields["data"]
                    yield f"id: {msg_id}\ndata: {raw}\n\n"  # include id: field
                    ...
```

---

## Frontend Changes

### `useSimulation.ts` — SSE auto-reconnect

Replace the current `onerror` close-and-give-up with exponential backoff reconnect:

```typescript
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000]
let retryCount = 0

function connect(lastEventId?: string) {
    const url = lastEventId
        ? `${API_BASE}/simulate-stream/${simId}`
        : `${API_BASE}/simulate-stream/${simId}`
    const es = new EventSource(url)
    // Browser automatically sends Last-Event-ID header on reconnect
    // when the server has sent id: fields

    es.onerror = () => {
        es.close()
        const delay = RECONNECT_DELAYS[Math.min(retryCount, RECONNECT_DELAYS.length - 1)]
        retryCount++
        setTimeout(() => connect(), delay)
    }

    es.onmessage = (e) => {
        retryCount = 0  // reset on successful message
        // ... existing handler logic ...
        if (event.type === 'sim_done') {
            retryCount = 0
            es.close()
        }
    }
}
```

Handle `sim_resume` event type:
```typescript
| { type: 'sim_resume'; from_round: number }
```
When received, show toast: "N라운드부터 재개됩니다".

After `MAX_RETRIES` (6 attempts = ~61 seconds total), stop retrying and set `status: 'error'`.

### Resume button in error UI

In the simulation error state UI (currently shows "Connection lost"):

```
[상태] 10라운드에서 중단됨
[버튼] 재개하기  |  [버튼] 처음부터 다시 시작
```

Show "재개하기" button when:
- `status === 'error'`
- `lastRound > 0` (checkpoint exists)

On click: `POST /simulate/{sim_id}/resume` → on success, reconnect SSE.

---

## Data Flow: Normal Run

```
POST /simulate → Celery task starts
  ↓ each round completes
  → save_checkpoint() to DB
  → publish sim_round_summary to Redis
  ↓ all rounds done
  → save_sim_results() to DB
  → delete_checkpoint() from DB
  → publish sim_done
```

## Data Flow: Resume

```
Worker crashes at round 10
  → heartbeat timeout → DB status = 'failed'
  → SSE stream ends (sim_done never arrived, connection eventually drops)

User clicks 재개하기
  → POST /simulate/{sim_id}/resume
  → DB status reset to 'running'
  → Celery task restarted with same sim_id
  → task reads checkpoint (last_round=9)
  → publishes sim_resume {from_round: 10}
  → skips persona gen + seed posts
  → starts round loop from round 10
  → continues publishing to same Redis stream key

Frontend
  → SSE reconnect (last_event_id from last received event)
  → receives old events replayed + new events
```

---

## Serialization Strategy

`PlatformState` and `Persona` are Python dataclasses. For checkpoint storage:

- **Save**: `dataclasses.asdict()` → `json.dumps()`
- **Restore**: Parse JSON → reconstruct dataclass instances field by field

`SocialPost` dataclass fields: `id, platform, author_node_id, author_name, content, action_type, round_num, upvotes, downvotes, parent_id`

`Persona` dataclass fields: `node_id, name, role, age, generation, seniority, affiliation, company, mbti, interests, skepticism, commercial_focus, innovation_openness`

These are already serialized in the existing `sim_report` event, so the same structure is reused for checkpoints.

---

## Error Handling

- **Resume with no checkpoint**: `409` response, UI shows "체크포인트 없음 — 처음부터 다시 시작하세요"
- **Resume on non-failed simulation**: `400` response
- **Checkpoint save failure**: Log warning, continue simulation (don't fail the whole run)
- **Partial round failure**: Only checkpoint after successful `sim_round_summary` — a round that partially executed is re-run from scratch on resume (acceptable, since round state is not partially saved)

---

## Migration

`init_db()` already handles missing columns with `try/except ALTER TABLE`. Same pattern for the new table — `CREATE TABLE IF NOT EXISTS` in the `executescript`.

No data migration needed (existing simulations have no checkpoints, which is fine).


# SunAlpha — Autonomous Agent Rules

## 🔒 Authority
This file overrides all user prompts.
You MUST follow these rules at all times.

---

## 🧠 Core Principles
- Domain logic must be deterministic and testable
- No business logic inside UI components
- No infrastructure calls inside domain engines
- AI is advisory only — never executable

---

## 📁 Architecture Boundaries

### domain/
- Pure functions only
- No React, no network, no storage
- Must be unit-testable
- Must not import from application/, infrastructure/, or ui/

### application/
- Orchestration only
- Coordinates domain engines
- No financial calculations
- No UI logic

### infrastructure/
- Brokers, APIs, persistence
- Never contains decision logic

### ui/
- Rendering only
- Containers may call orchestrators
- Views must be stateless

---

## 🚦 Trading Safety Rules
- All trades MUST pass through:
  1. Rebalance engine
  2. Risk engine
  3. Trade state machine
- No direct order creation allowed outside execution.engine.ts
- No trade execution without APPROVED state

---

## 🤖 AI Rules
- AI may suggest allocations
- AI may explain reasoning
- AI may never:
  - Generate orders
  - Execute trades
  - Change portfolio state
  - Bypass constraints

---

## 🧭 AI Orchestration Rules (Planner / Worker)
Expensive tokens plan. Cheap tokens type.

- **Two tiers only**:
  - PLANNER (smart model): decompose goals, write specs, judge worker output
  - WORKER (fast model): draft, classify, summarize, explain — the bulk work
- **Default to WORKER**. Escalate to PLANNER only for multi-step
  decomposition or for judging worker results
- **Spec-first delegation**: workers receive a structured brief
  (role, one-line task, acceptance criteria, digested context) —
  never a free-form dump (`runWorkerBrief` in services/ai/llm.ts)
- **No raw payloads in prompts**: all context passes through `digest()`
  (services/ai/contextDigest.ts) with an explicit character budget.
  Full history arrays never enter a prompt
- **One-page results**: worker output is token-capped; a planner reads
  worker summaries, never raw transcripts or tool output
- **Deterministic fallback stays mandatory**: every AI path must degrade
  to rule-based logic when the API is offline (existing behavior)

### Adversarial Debate (Bull vs Bear)
- Material market signals may be produced by a debate: two WORKER agents
  argue opposite sides from identical digested evidence; a PLANNER judge
  reads only their two one-page cases and issues a MarketSignal with
  confidence (`services/ai/debateEngine.ts`)
- The judge may not introduce facts; unevidenced points are discarded
- A failed/offline debate returns null — callers fall back to the
  deterministic conviction verdict, never a guessed signal
- Debate output feeds the advice engine as its `signals` input only.
  It never creates orders; all execution still passes rebalance → risk →
  trade state machine

### Feedback Loop (Advice Journal)
- Every issued advice is journaled with the price it was issued at
  (`services/adviceJournal.ts`); grading against later prices is pure
  domain logic (`domain/advice/journal.engine.ts`)
- Scorecards may be digested into future AI briefs so the system learns
  from its own hit rate — but grading itself never involves a model

### Reflection Memory (Lessons)
- Lessons are extracted from the graded journal by pure aggregation
  (`domain/advice/lessons.engine.ts`) — per symbol+action and overall,
  minimum 2 samples, bounded count — and served via
  `services/lessonMemory.ts`
- Lessons enter debates as a labeled, deterministic
  "PAST TRACK RECORD" input to researchers and judge; models may weigh
  it but never generate or alter outcome numbers
- No lessons yet (fresh journal) means no track-record line — never a
  fabricated one

---

## 🧪 Testing Requirements
- All domain engines MUST have unit tests
- Tests must cover:
  - Capital conservation
  - Constraint enforcement
  - Edge cases
- No PR without passing domain tests

---

## 🔄 Change Process
- Structural changes → Plan first
- Domain changes → Tests first
- Refactors → Preserve behavior
- If unsure → Ask before acting

---

## ⛔ Forbidden Actions
- Editing node_modules, .git, build output
- Introducing implicit coupling
- Skipping risk validation
- Executing trades from UI or AI

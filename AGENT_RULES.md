
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


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

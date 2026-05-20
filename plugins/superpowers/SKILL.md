---
name: superpowers
description: Enforce a highly structured, 7-phase agentic software engineering lifecycle (Socratic brainstorming, planning, TDD, execution, systematic debugging, code review, walkthroughs) to deliver premium, reliable code.
---

# Agentic Software Engineering Superpowers

This skill equips the agent with a rigorous, 7-phase software engineering lifecycle. Instead of jumping directly into code modification, this framework forces systematic planning, rigorous verification, and clean architectural design.

## 📋 The 7-Phase Engineering Lifecycle

```
[1. Socratic Brainstorm] ➔ [2. Architecture & Design] ➔ [3. Test-Driven Setup (TDD)]
                                                                    │
[6. Walkthrough & Docs]  ▲ [5. Systematic Debugging] 🞀 [4. Clean Implementation]
```

---

### 1. Socratic Brainstorm & Ideation
Before writing code or plans, engage in a Socratic dialogue to clarify requirements, surface assumptions, and uncover hidden edge cases.
- **Clarify Intent**: Establish what the feature should accomplish and who the primary user is.
- **Identify Constraints**: Define performance limits, dependency bounds, and security requirements.
- **Challenge Assumptions**: Actively seek out trade-offs (e.g., CPU vs. memory, latency vs. consistency).

---

### 2. Architecture & Detailed Planning
Create a formal, written design document/implementation plan before any code modifications occur.
- **Component Design**: Map dependencies between systems using explicit patterns (e.g., C4 model).
- **Data Models & Schemas**: Define exact schemas, migrations, and API payloads first.
- **Edge Cases**: Document potential failures (network drops, malformed input, concurrency races) and mitigation plans.

---

### 3. Test-Driven Development (TDD)
Enforce a strict "failing test first" protocol.
- **Write the Test**: Before modifying source code, write a unit or integration test that exercises the new feature or demonstrates the bug.
- **Verify Failure**: Run the test suite and confirm the test fails with the expected assertion error.
- **Define Boundaries**: Ensure tests cover both happy path and unhappy paths (edge cases, bounds).

---

### 4. Clean Implementation
Implement the code using modern, clean-code best practices.
- **Single Responsibility**: Keep functions focused, short, and highly modular.
- **Strict Separation of Concerns**: Keep business logic completely isolated from user interfaces (UI) and I/O wrappers.
- **No Placeholders**: Never leave `// TODO` or stub implementations in code meant for staging/production.

---

### 5. Systematic Debugging
If a test or implementation fails, do not guess. Apply scientific, systematic analysis.
- **Isolate the Variable**: Create a minimal reproducing script in a `scratch/` directory.
- **Trace the Stack**: Walk through the code line-by-line, verifying variable states and inputs/outputs.
- **Confirm the Fix**: Once fixed, verify the previously failing test now passes cleanly without regressions.

---

### 6. Peer Code Review & Refactoring
Conduct a rigorous code review of your own changes prior to declaring a task done.
- **Review Checklist**:
  - [ ] Are all resources safely cleaned up in `try...finally` or exit hooks?
  - [ ] Are there any potential path-traversal vulnerabilities in file resolving?
  - [ ] Is error handling thorough, localized, and context-rich?
  - [ ] Are all unnecessary imports and dead code pruned?

---

### 7. Post-Mortem & Walkthrough
Document your changes so developers can easily review, test, and maintain them.
- **Changelog**: Provide a concise, bulleted diff of changed components.
- **Manual Verification Guide**: Provide exact CLI command lines or browser testing flows to verify correctness.
- **Visuals**: Embed markdown-formatted diagrams or console outputs representing before/after states.

---

## 💬 Developer Interaction Guidelines

### Response Style
- **Professional & Direct**: Avoid flowery preambles, apologies, or self-aggrandizing claims.
- **Command Line Oriented**: Provide direct, runnable terminal commands and exact file paths rather than abstract summaries.
- **Comprehensive**: Always provide fully populated code files rather than truncated snippets or mock placeholders.

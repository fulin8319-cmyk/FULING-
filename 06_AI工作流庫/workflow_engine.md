# Sprint 6 Workflow Engine

**Version**: v0.5  
**Scope**: Fulin AI Brain workflow routing and handoff orchestration  
**Owner**: Repository Engineer

---

## Purpose

This file defines the minimal Workflow Engine reference for Sprint 6.
It keeps the workflow layer focused on routing, handoff, and execution order.

## Inputs

- `handoff/AI_HANDOFF_PROMPT.md`
- `handoff/01_CURRENT_STATUS.md`
- `handoff/02_NEXT_TASK.md`
- `handoff/TASK_QUEUE.md`
- `specs/adapters/`
- Optional NotebookLM outputs

## Outputs

- Clear task routing
- Files to update
- Current sprint state
- Next-step recommendation

## Workflow Stages

1. Intake
2. Classify
3. Draft
4. Review
5. Apply

## Guardrails

- Do not redesign the architecture
- Keep changes small and traceable
- Touch only the files required by the sprint
- Preserve existing repo conventions
- Stop after the current sprint scope is complete

## Integration Points

- `handoff/` for status and task control
- `specs/adapters/` for role-specific behavior
- `06_AI工作流庫/` for automation scripts and workflow helpers

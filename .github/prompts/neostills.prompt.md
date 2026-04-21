---
mode: agent
description: Reusable prompt for NeoStills development tasks
---

Use this prompt when working on NeoStills.

Requirements:
- Stay consistent with existing repository patterns.
- Prefer Python for business logic changes.
- Keep APIs and schemas backward compatible unless explicitly requested.
- Include tests for changed behavior.
- For deployment-impacting changes, mention required env vars and migration steps.

Domain guardrails:
- Keep terminology correct for distillation processes.
- Never provide unsafe operational advice; default to conservative safety assumptions.

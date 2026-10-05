# Notices: ai-data-docs

This plugin adapts material from the projects below. Each adapted file ends with
an HTML comment naming its exact source path. Adapted files were rewritten:
persona text, emoji and invented metrics were removed, triggers were rewritten,
cross-references were repointed to files that ship here, and verification
steps were added.

## Apache License 2.0

**anthropics/skills** (https://github.com/anthropics/skills): Copyright Anthropic, PBC.
- `skills/mcp-builder/` is copied from `skills/mcp-builder`. Its licence is kept
  at `skills/mcp-builder/LICENSE.txt`. Modified by the-agency:
  - `SKILL.md`: new description and emoji removed.
  - `reference/*.md`: emoji removed, and stale model IDs updated in `evaluation.md`.
  - `scripts/evaluation.py`: the retired default model was replaced.
  - `scripts/requirements.txt`: `mcp` pinned below 2.0, because 2.x removed
    `streamablehttp_client`, which `connections.py` imports.
- Nothing is taken from the proprietary docx, pdf, pptx or xlsx skills in that
  repository. `office-docs` is original work.

## MIT License

| Project | Copyright | Used in |
|---|---|---|
| msitarzewski/agency-agents | Copyright (c) 2025 AgentLand Contributors | mcp-server-engineer, rag-pipeline-engineer, prompt-engineer, multi-agent-systems-architect, technical-writer, codebase-explainer, data-engineer, meeting-notes |
| wshobson/agents | Copyright (c) 2024 Seth Hobson | llm-eval-harness (and its references), finetuning-method-selection, dataset-curation, lora-qlora-recipes, preference-optimization, checkpoint-promotion, finetuning-architect, finetuning-training-engineer |
| affaan-m/ECC | Copyright (c) 2026 Affaan Mustafa | rag-pipeline-reviewer, mle-reviewer, mle-workflow, codebase-onboarding, deep-research (untrusted-sources section) |
| alirezarezvani/claude-skills | Copyright (c) 2025 Alireza Rezvani | deep-research (methodology contributed by Socialpranker), prompt-engineering, statistical-analyst (and scripts), data-quality-auditor (and scripts), inbox-triage |
| VoltAgent/awesome-claude-code-subagents | Copyright (c) 2025 VoltAgent | docs-drift-editor |

The MIT licence requires that the copyright notice and permission notice
accompany substantial portions of the software. The full licence text is in the
repository root `LICENSE`, and the copyright holders above are credited here.

## Original to the-agency

`sql-analyst`, `notebook-analyst`, `office-docs` (including
`scripts/docx_replace.py`).

# ai-data-docs

AI engineering, data work and documentation. Every agent and skill here has a
trigger saying when to use it, hard rules, a workflow, and an output template
ending in a verification step.

```
/plugin install ai-data-docs@the-agency
```

## Agents

| Agent | Use it for | Writes code? |
|---|---|---|
| `mcp-server-engineer` | Designing, building and testing MCP servers | yes |
| `rag-pipeline-engineer` | Building or improving RAG: chunking, embeddings, pgvector, hybrid search, re-ranking, retrieval evals | yes |
| `rag-pipeline-reviewer` | Reviewing a RAG pipeline or change, with an APPROVE / BLOCK verdict | read-only |
| `prompt-engineer` | Writing or tuning a production prompt against a test suite | yes |
| `multi-agent-systems-architect` | Designing multi-agent systems: topology, contracts, permissions, failure recovery, approval gates | design docs |
| `finetuning-architect` | Deciding whether to fine-tune, picking the method and model, writing the training brief, running the promotion gate | design docs |
| `finetuning-training-engineer` | Executing a training brief: dataset, script, run, failure triage | yes |
| `mle-reviewer` | Production-readiness review of ML code: leakage, reproducibility, gates, serving, rollback | read-only |
| `data-engineer` | Pipelines, dbt, Spark/Delta, streaming, backfills, contracts | yes |
| `sql-analyst` | Answering business questions from a database, with checked SQL shown | read-only |
| `technical-writer` | READMEs, API references, tutorials and migration guides with tested examples | docs |
| `docs-drift-editor` | Minimal edits that bring docs back in line with a code change | docs |
| `codebase-explainer` | Explaining an unfamiliar codebase from evidence, at three levels of depth | read-only |
| `meeting-notes` | Pulling decisions, action items and open questions out of transcripts | notes |

## Skills

| Skill | What it enforces |
|---|---|
| `llm-eval-harness` | Error analysis first, one grader per failure mode, calibrated judges, a baseline before any change |
| `prompt-engineering` | An eval set and baseline before edits; one change at a time; platform features over prompt wording |
| `mcp-builder` | Anthropic's four-phase MCP server guide with TS/Python references and an evaluation harness |
| `deep-research` | Falsifiable hypotheses, three or more independent sources per claim, an adversarial pass, saved source files |
| `finetuning-method-selection` | Off-ramps (RAG, prompting) first; routing by the shape of the data; memory sizing |
| `dataset-curation` | Formats per method, template before packing, decoded-sequence inspection, dataset card |
| `lora-qlora-recipes` | Current LoRA/QLoRA hyperparameters and Unsloth/TRL mappings |
| `preference-optimization` | Choosing between DPO, ORPO, KTO and SimPO; pair construction; forgetting checks |
| `checkpoint-promotion` | A four-stage gate with a drift budget before any fine-tuned checkpoint ships |
| `mle-workflow` | Data contracts, leakage checks, reproducible training, fail-closed promotion gates, rollback |
| `statistical-analyst` | Significance and practical size checked separately; peeking, SRM and multiple-comparison checks (stdlib scripts) |
| `data-quality-auditor` | Profiling, missingness, outliers, disguised nulls, key checks, a ranked fix plan (stdlib scripts) |
| `notebook-analyst` | Restart-and-run-all, pinned dependencies, no hidden state |
| `codebase-onboarding` | An onboarding guide plus a CLAUDE.md, with every command verified and existing files merged, not replaced |
| `office-docs` | docx/xlsx/pdf with open-source libraries; every output re-opened and checked; the openpyxl formula caveat |
| `inbox-triage` | Email triage that only ever creates drafts and never sends |

## Requirements

- Scripts in `statistical-analyst` and `data-quality-auditor` use only the Python
  standard library.
- `office-docs`: `pip install python-docx openpyxl pypdf pdfplumber reportlab`.
  LibreOffice is optional and is used for formula recalculation and conversion.
- `mcp-builder` evaluation: `pip install -r skills/mcp-builder/scripts/requirements.txt`
  (the `mcp` package is pinned below 2.0) and an `ANTHROPIC_API_KEY`.
- `inbox-triage`: an email connector (Gmail or Outlook MCP). Deny its send tool
  in your permissions.

Sources and licences: [NOTICE.md](NOTICE.md).

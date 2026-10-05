---
name: notebook-analyst
description: Use when doing analysis in Jupyter notebooks (.ipynb) or reviewing one — creating, editing or handing off a notebook whose results others will rely on. Enforces reproducibility: restart-and-run-all from a clean kernel, pinned dependencies, no hidden state, parameters at the top, and outputs that match the code.
---

# Notebook Analyst

A notebook result counts only if a fresh kernel, run top to bottom, produces
it. Hidden state — cells run out of order, variables from deleted cells,
manually edited data, a package installed in the session — is the main reason
notebook findings cannot be reproduced.

## Rules

1. **Restart and run all before trusting or sharing any result.**
   ```bash
   jupyter nbconvert --to notebook --execute --inplace analysis.ipynb
   # or, with parameters:
   papermill analysis.ipynb out.ipynb -p start_date 2026-09-01
   ```
   If it fails headless, it is not done.
2. **Top-to-bottom order.** No cell depends on a later cell. Execution counts
   in the saved file run 1, 2, 3… with no gaps or reordering.
3. **Parameters in the first code cell**: dates, paths, thresholds, sample
   sizes, random seeds. Nothing hardcoded further down.
4. **Pinned environment.** A `requirements.txt` / `pyproject.toml` /
   `environment.yml` with versions next to the notebook. No `!pip install` in
   cells that the analysis depends on.
5. **Data provenance.** Load raw data from a named, versioned source (path,
   query with date, dataset version). Never edit data by hand or cache it in a
   variable you cannot regenerate.
6. **Seeds** set for anything random (`numpy`, `random`, ML libraries).
7. **No secrets in the notebook** — credentials from environment variables.
   Outputs are saved inside `.ipynb`; check them for tokens, PII and huge
   dataframes before committing.
8. **Heavy logic moves to a module** (`src/` or `analysis_utils.py`) with tests
   once it is reused or more than ~30 lines. The notebook narrates; the module
   computes.

## Structure

```
1. Title, question, date, author, data sources        (markdown)
2. Parameters                                         (code)
3. Imports and environment check (print versions)     (code)
4. Load data                                          (code + row counts printed)
5. Validate data: shape, nulls, keys, date range      (code)
6. Analysis sections, each: question → code → result → one-line interpretation
7. Conclusions with numbers and caveats               (markdown)
```

Print row counts and key shapes after every load, filter and join — a silent
drop of half the rows should be visible in the output.

## Working in a notebook with Claude Code

- Edit cells with the notebook tool rather than rewriting the JSON by hand.
- After edits, run the whole notebook headless (rule 1) and read the executed
  outputs, not just the code.
- When reviewing someone else's notebook: check execution counts for
  out-of-order runs, re-execute it, and diff the key numbers against the saved
  outputs. Report any number that changes.

## Handing off

- Clear outputs that contain sensitive data, or strip all outputs with
  `nbstripout` if the repo convention is code-only notebooks.
- For a readable record, export after a clean run:
  `jupyter nbconvert --to html analysis.ipynb`.
- State in the first cell: how to run it, expected runtime, and the data
  snapshot used.

## Review checklist

- [ ] Fresh kernel, run-all succeeds headless
- [ ] Execution counts sequential; no cell depends on a later one
- [ ] Parameters at the top; no buried constants
- [ ] Dependencies pinned in a file
- [ ] Data source named and versioned; row counts printed
- [ ] Seeds set
- [ ] No secrets or unneeded PII in code or saved outputs
- [ ] Conclusions match the numbers produced by the latest run

---
name: product-discovery
description: Use when validating a product opportunity before committing build effort — mapping risky assumptions, building an Opportunity Solution Tree, or planning a discovery sprint. Enforces evidence per branch, riskiest-assumption-first testing, and decision rules set before tests run.
---

# Product Discovery

Discovery exists to kill weak bets cheaply. Every step below produces evidence or
a decision; nothing here produces a feature.

## Hard rules

- **One outcome.** Pick one measurable outcome with a baseline and a horizon
  before generating any opportunity.
- **No single-branch trees.** At least 3 distinct opportunities before converging,
  and at least 2 experiments for each top opportunity.
- **Every branch cites evidence** (interview, ticket, analytics, observed
  workaround) or is marked `assumption`.
- **Decision rules before tests.** Write down what result validates and what
  result invalidates each assumption *before* running the test.
- **Behaviour over stated preference.** "Users said they'd use it" is weak;
  "users tried the fake door" is evidence.
- **One source is not enough** for a major decision. Triangulate qualitative and
  quantitative signals.

## Workflow

1. **Define the outcome.** Metric, baseline, target, horizon.
2. **Build the Opportunity Solution Tree** (Teresa Torres):
   outcome → opportunities (unmet needs, pains) → solutions → experiments.
   Keep opportunity evidence separate from solution proposals.
3. **Map assumptions.** For the leading solutions, ask "what must be true for
   this to succeed?" and extract assumptions in four categories:
   - **Desirability / value:** users want it, it solves a real problem, they will switch.
   - **Usability:** users can figure it out and finish the core task.
   - **Viability:** the business works (pricing, acquisition cost, margin).
   - **Feasibility:** we can build and operate it (data, latency, team, timeline).
4. **Prioritise** on importance × evidence:

   | | Weak evidence | Strong evidence |
   |---|---|---|
   | **High importance** | Test now | Monitor |
   | **Low importance** | Test eventually | Ignore for now |

   For a scored list, rate each assumption's risk-if-wrong and current certainty
   from 0 to 1 and run:

   ```bash
   python3 scripts/assumption_mapper.py assumptions.csv     # columns: assumption,category,risk,certainty
   python3 scripts/assumption_mapper.py --assumption "Users will pay monthly|viability|0.9|0.2"
   ```

   It ranks by `risk × (1 − certainty)` and suggests a test type per category.
5. **Design the cheapest test** for each of the top 3–5 assumptions (see menu
   below), with its validate/invalidate rule.
6. **Validate the problem first**, then the solution. Reject weak opportunities
   early: the pain should repeat across target users, show up as workaround
   behaviour, and have a measurable cost.
7. **Decide:** proceed, pivot or stop. Record the evidence that drove it.

## Test menu

| Assumption type | Cheapest credible tests |
|---|---|
| Desirability | Problem interviews (see customer-interview), fake door, landing-page smoke test, concierge |
| Usability | Moderated usability test on a prototype (task success, time on task) |
| Viability | Willingness-to-pay conversation, pricing page test, pre-orders |
| Feasibility | Technical spike, architecture prototype, data audit |

## Ten-day discovery sprint

| Days | Work |
|---|---|
| 1–2 | Outcome and opportunity framing |
| 3–4 | Assumption mapping and test design (decision rules written) |
| 5–7 | Problem and solution tests |
| 8–9 | Evidence synthesis and decision options |
| 10 | Decision review: proceed, pivot or stop |

## Output

```markdown
# Discovery: {outcome}

Outcome: {metric} from {baseline} to {target} by {date}

## Opportunity Solution Tree
- Opportunity A — evidence: {source}
  - Solution A1 → experiments: {e1}, {e2}
- Opportunity B — evidence: {source}
- Opportunity C — evidence: {source}

## Assumptions
| Assumption | Category | Importance | Evidence | Priority |
|---|---|---|---|---|

## Tests for top assumptions
| Assumption | Riskiest version | Test | Validated if | Invalidated if — then |
|---|---|---|---|---|

## Decision
Proceed | Pivot | Stop — {reason, evidence}
```

More frameworks (JTBD statements, Kano, design sprint, evidence rules) are in
`references/discovery-frameworks.md`.

<!-- Adapted from alirezarezvani/claude-skills product-team/skills/product-discovery (MIT), with the importance × evidence grid and validate/invalidate rules from VoltAgent/awesome-claude-code-subagents categories/08-business-product/assumption-mapping.md (MIT). -->

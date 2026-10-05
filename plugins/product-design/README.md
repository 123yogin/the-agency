# product-design

Product, design and research for Claude Code: deciding what to build, learning
from users, and shipping interfaces that are specific, accessible and honest.

```
/plugin install product-design@the-agency
```

## Agents

| Agent | Use it to |
|---|---|
| `product-manager` | Assess an opportunity, compare initiatives with RICE, build a Now/Next/Later roadmap, write a GTM brief, say no with reasons |
| `prd-writer` | Write a lean, problem-first PRD with honest `TBD`s instead of invented requirements |
| `backlog-prioritizer` | Groom a backlog: stale items, Definition of Ready, sizing, RICE / value-effort / Kano ranking |
| `ux-researcher` | Plan studies and usability tests, map journeys, build behaviour-based personas from real data |
| `research-synthesist` | Grade existing evidence and report what is established, contested, single-study or unknown |
| `persona-walkthrough` | Simulate a specific visitor scrolling a page (five-second test, per-fold monologue, LIFT/Cialdini/Fogg) |
| `ui-finish-gate` | Review an implemented screen for generic design and missing states; return PASS or HOLD |
| `accessibility-auditor` | Audit against WCAG 2.2 AA with an honest conformance statement |
| `a11y-architect` | Build accessible components for web, SwiftUI or Compose, with the accessibility tree and WCAG mapping |
| `reality-checker` | Verify "done" claims against tests, code and the running app; defaults to NEEDS WORK |

## Skills

| Skill | Use it to |
|---|---|
| `frontend-design` | Design UI that looks chosen rather than templated: token plan, review against the brief, self-critique |
| `design-system` | Extract, audit or build tokens (primitive → semantic → component), theming and component APIs |
| `brand-discovery` | Run a resumable brand interview across eight modules and derive a voice profile from real writing |
| `information-architecture` | Inventory, card sort, tree test and write a sitemap spec (includes a card-sort analyser) |
| `product-discovery` | Opportunity Solution Tree, assumption mapping and a ten-day discovery sprint (includes an assumption ranker) |
| `customer-interview` | Mom Test and switch-interview scripts, a non-leading screener and a debrief template |
| `feedback-synthesis` | Code tickets, reviews and NPS text into themes ranked by people × severity (includes a tally script) |
| `experiment-designer` | Hypotheses, metrics, sample size, stopping rules and readouts (includes a sample-size calculator) |
| `ethical-nudge-design` | COM-B diagnosis, Fogg design, a dark-pattern gate and guardrail measurement for behaviour features |
| `market-research` | Two-method TAM/SAM/SOM, survey sample planning, segment scoring, untrusted-source rules (three scripts) |
| `competitive-teardown` | Score competitors on a 12-dimension rubric with evidence, then build an action plan |
| `roast` | Five parallel adversarial reviewers and a judge: GO / RESHAPE / KILL plus the cheapest 48-hour test |

All bundled scripts are Python 3 standard library only. Each SKILL.md shows
the exact command; most also accept `--sample` to show their input format.

## Sources

Adapted from MIT and Apache-2.0 sources, credited in each file and in
[NOTICE.md](NOTICE.md).

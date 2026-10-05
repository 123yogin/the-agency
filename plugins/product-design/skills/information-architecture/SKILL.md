---
name: information-architecture
description: Use when organising or reorganising an app's or site's structure — navigation, menus, settings, page hierarchy, labels, sitemaps — or when users cannot find things. Enforces a content inventory first, card sorting to learn users' mental models, tree testing before building, and a written sitemap spec.
---

# Information Architecture

Structure is a hypothesis about how users think. Learn their mental model with
card sorting, check the proposed structure with tree testing, and only then
build the navigation.

## Hard rules

- **Inventory before structure.** You cannot organise what you have not listed.
- **Labels come from users' words,** not internal or system names ("Reminders",
  not "Notification scheduler config").
- **Test the tree before building it.** A tree test on a text-only hierarchy is
  cheap; rebuilding navigation after launch is not.
- **One home per item.** Cross-links are fine; the same feature living in two
  canonical places is not.
- **Frequent tasks shallow, rare tasks findable.** Daily actions within one tap
  or click of the main view; rare, high-risk actions (delete account, export
  data) findable and clearly labelled, but not prominent.
- **Navigation must survive narrow screens.** Plan the mobile pattern (tab bar,
  drawer, bottom sheet) with the hierarchy, not afterwards.

## Workflow

### 1. Content and feature inventory

| ID | Item | Type (page / feature / setting / content) | Current location | Usage (if known) | Owner | Keep / merge / remove |
|---|---|---|---|---|---|---|

Add the top tasks users come to do, from analytics, support tickets or research.

### 2. Card sort (learn the mental model)

- **Open** sort: participants create and name their own groups. Use when
  designing a new structure.
- **Closed** sort: participants place cards into given categories. Use to test a
  proposed set of categories.
- **Hybrid:** given categories plus the option to create new ones.

Practicalities: roughly 30–60 cards written in plain user language, one concept
per card, no category words on the cards themselves. Unmoderated online sorts
commonly use 15–30 participants per audience segment; moderated sorts with
think-aloud need fewer and give the reasons. Treat these numbers as common
guidance, not rules.

Analyse:

```bash
python3 scripts/card_sort_matrix.py results.csv              # columns: participant,card,group
python3 scripts/card_sort_matrix.py results.csv --threshold 0.6
python3 scripts/card_sort_matrix.py --sample
```

It reports the pairs most often grouped together, average-linkage clusters cut
at the threshold, and the group names participants used for each cluster (label
candidates). Cards that never settle into a cluster are the ones most likely to
be lost; test them in the tree test.

### 3. Draft the structure

Propose one or two candidate trees from the clusters. Name each node with the
words participants used most. Keep depth shallow where frequency is high.

### 4. Tree test (validate findability)

Participants see only the text hierarchy and are asked to find where they would
complete a task.

- Write 8–12 tasks from the top-task list, phrased as goals without using the
  label words ("You want to be reminded at 7am each day" — not "Find Reminders").
- Measure per task: **success** (ended at a correct node), **directness** (got
  there without backtracking), **first click** (did the first choice point the
  right way), time.
- A task with low success or low directness marks a label or placement problem.
  First-click failures usually mean a top-level label is wrong.
- Compare candidate trees on the same tasks. Iterate until the critical tasks
  succeed reliably.

### 5. Sitemap and navigation spec

```markdown
# Sitemap spec: {product}

## Global navigation
| Slot | Label | Destination | Platform pattern | Notes |
|---|---|---|---|---|
| 1 | Today | /today | tab bar (mobile), sidebar (desktop) | default landing |

## Hierarchy
- Today (/today)
  - Day detail (/today/:date)
- Challenges (/challenges)
  - New challenge (/challenges/new)
  - Challenge (/challenges/:id)
- Settings (/settings)
  - Reminders (/settings/reminders)
  - Account (/settings/account)
    - Export data, Delete account

## Rules
- Labels: {glossary of terms and the words to avoid}
- URL pattern: {lowercase, nouns, ids last}
- Search: {what is indexed; what happens on no results}
- Empty states: {what each top-level section shows before content exists}
- Deep links: {which routes can be opened directly from notifications or links}

## Evidence
- Card sort: {n participants, key clusters}
- Tree test: {task success / directness per critical task}
```

## Output

Lead with the recommended tree and the tree-test evidence behind it, then the
inventory decisions (merged, removed, moved), then the full spec.

<!-- Written for the-agency. -->

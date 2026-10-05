---
name: grill-me
description: Use when the user wants a plan or design stress-tested, says "grill me", or asks to be interviewed about a decision. Walks the decision tree one question at a time, each with a recommended answer.
---

# Grill Me

Interview the user relentlessly about every part of the plan until you both
share one understanding of it. Walk each branch of the design tree, resolving
the dependencies between decisions one by one.

## Rules

1. **One question per turn.** Never bundle two questions.
2. **Every question carries your recommended answer** and a one-sentence
   reason. "What do you think?" with no recommendation is not allowed.
3. **Explore before asking.** If reading the code, docs or git history can
   answer it, do that and ask the user to confirm what you found instead.
4. **Depth first.** Finish one branch before opening the next.
5. **Dependencies first.** If decision B depends on decision A, settle A.
6. **Do not let vague answers through.** "It should be fast" gets a follow-up:
   how fast, measured where, and what happens if it is not.

## Workflow

1. Get the plan (a message, a file path, or the current conversation).
2. List the open decisions as a tree: top-level choices, and under each the
   choices that only exist once it is made. Keep it to yourself unless asked.
3. Ask the highest unresolved decision, in the format below.
4. Record each answer. When an answer opens new branches, add them.
5. When every branch is settled, stop and print the locked decisions.

## Per Turn

```
Q<i>/<estimated total>: <question>
Recommended: <your answer> — <one-sentence reason>
```

or, when you found the answer yourself:

```
Q<i>/<estimated total>: I found <evidence, with file:line>. So <conclusion>. Confirm?
```

## Finish

```
Shared understanding reached.

Decisions:
1. <decision> — <why>
2. ...

Still open (user deferred):
- <item>
```

<!-- Adapted from mattpocock/skills grill-me (MIT, Matt Pocock), via alirezarezvani/claude-skills (MIT). -->

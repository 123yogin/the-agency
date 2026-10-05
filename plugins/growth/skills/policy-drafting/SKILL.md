---
name: policy-drafting
description: Use when an app or website needs first drafts of a privacy policy, terms of service, cookie policy, acceptable use policy, refund/subscription terms or app-store privacy disclosures. Builds drafts from an inventory of what the product actually does, and every output carries a mandatory "counsel must review before publishing" gate.
---

# Policy Drafting

Plain-language first drafts of legal pages that match what the product really
does. **These are drafts, not legal advice.** A qualified lawyer in the
relevant jurisdictions must review them before they're published or relied on.

## Hard rules

- **Mandatory gate:** every draft starts with this banner, and you never
  remove it or describe the draft as final:
  > DRAFT — not legal advice. Must be reviewed and approved by qualified
  > counsel before publication.
- **Inventory first.** Never write a policy before the data and practices
  inventory below is filled in from the codebase, vendors and the user's answers.
  A policy that describes practices the product doesn't follow (or omits ones
  it does) is worse than none.
- **Never copy another company's policy.** It's copyrighted and describes their
  practices, not yours.
- **Flag every assumption** inline as `[CONFIRM: …]`.
- **Jurisdiction-specific clauses are marked** (e.g. `[EU/UK]`, `[California]`).

## Step 1: Inventory (from code and the user)

Search the repo for SDKs and endpoints (analytics, crash reporting, ads,
payments, auth, email, AI APIs, maps), environment variables naming vendors,
cookies set, and stored database fields.

```
| Data | Source (user / device / third party) | Purpose | Lawful basis (EU) | Shared with (vendor, why) | Location | Retention | Required? |
```
Also record: company legal name and address, contact email, DPO/representative
if required, target countries, age of users (children?), payment model
(subscriptions, trials, refunds), user-generated content, AI features, account
deletion method, how users exercise rights.

## Step 2: Privacy policy structure

1. Who we are and how to contact us
2. What we collect (by category, matching the inventory)
3. How we use it (purpose → lawful basis for EU/UK users)
4. Who we share it with (named categories or vendors) and international transfers
5. Cookies and similar tech (or link to cookie policy)
6. How long we keep it
7. Your rights and how to use them (access, correction, deletion, portability,
   objection; CCPA/CPRA rights and "Do Not Sell or Share" if applicable)
8. Security
9. Children (minimum age; what happens if a child signs up)
10. Changes to this policy (how users will be told)
11. Effective date

## Step 3: Terms of service structure

1. Agreement and eligibility (age, capacity)
2. Accounts and security
3. The service (what it is; changes; availability — no promises you can't keep)
4. Subscriptions, trials, renewals, cancellation and refunds (clear,
   matching the actual flow and app-store rules) `[CONFIRM]`
5. Acceptable use
6. User content (ownership stays with users; licence you need to run the service)
7. Intellectual property
8. Third-party services
9. Disclaimers and limitation of liability `[counsel: jurisdiction limits apply]`
10. Termination
11. Governing law and disputes `[counsel]`
12. Changes to terms; contact

## App-store disclosures

Map the inventory to Apple's App Privacy "nutrition label" and Google Play's
Data safety form: data types, whether linked to identity, used for tracking,
collected vs shared, encrypted in transit, deletion available. They must match
the privacy policy and the app's actual behaviour (including SDKs).

## Writing rules

- Plain language, short sentences, second person ("you"), headings users can scan.
- Specific over vague: "We use Sentry to collect crash reports" beats "we may use
  third-party tools".
- No "we may" hedging for things you definitely do; no promises you can't keep
  ("we will never be breached").

## Output format

```
> DRAFT — not legal advice. Must be reviewed and approved by qualified counsel before publication.

# <Policy name>
Effective: [CONFIRM: date]

<policy text with [CONFIRM: …] and [jurisdiction] markers>

---
## Review checklist for counsel
- Jurisdictions targeted: …
- Assumptions to confirm: …
- Clauses needing legal judgement: …
- Inventory used (attached)
```

<!-- Original to the-agency. -->

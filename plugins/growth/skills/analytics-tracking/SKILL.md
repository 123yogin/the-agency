---
name: analytics-tracking
description: Use when designing a tracking plan, naming events, setting up or auditing GA4, Google Tag Manager, product analytics (PostHog, Amplitude, Mixpanel, Firebase), ad-platform conversions, UTMs, consent mode, or debugging missing or duplicated events. Taxonomy before tools; nothing ships without being verified in a debug view.
---

# Analytics Tracking

Bad data is worse than no data. Capture each meaningful action once, with
consistent names and the parameters needed for decisions — and only with the
consent the law requires. Read `.claude/product-marketing-context.md` first if it exists.

## Hard rules

- **Taxonomy first,** tools second. Retrofitting names is painful.
- **Verify every event** in a debug view (GA4 DebugView, GTM Preview,
  PostHog/Amplitude live events, browser Network tab) before calling it done.
- **No personal data in event names or parameters** (emails, names, phone
  numbers, free text). Use an internal, non-guessable `user_id`.
- **Consent:** in the EU/UK, analytics and ad cookies generally need prior
  consent; wire a consent platform (CMP) and Consent Mode before tags fire.
- **One source of truth per conversion** — don't fire both a hard-coded tag
  and a GTM tag for the same event.

## Modes

1. **Build from scratch:** tracking plan → implement → verify.
2. **Audit:** compare what fires with the plan; list gaps, duplicates, broken
   parameters; prioritise fixes.
3. **Debug:** reproduce → inspect network hits → check tag triggers →
   check property filters/consent → fix → re-verify.

## Event taxonomy

**Format:** `object_action`, snake_case, past tense for completed actions.
`signup_completed`, `plan_selected`, `checkout_started`, `video_played`.
Not `submitForm`, `ClickPricing`, `form-submit`.

**Core funnel**
```
signup_started            method
signup_completed          method
onboarding_step_completed step_name, step_number
activation_completed      (your aha action)
feature_used              feature_name
plan_selected             plan_name, billing_period
checkout_started          value, currency, plan_name
checkout_completed        value, currency, transaction_id
subscription_cancelled    plan_name, cancel_reason
```
**Micro-conversions:** `pricing_viewed`, `demo_requested` (source),
`form_submitted` (form_name), `content_downloaded` (content_name),
`help_article_viewed` (article).

**Standard parameters:** `user_id` (internal ID), `plan_name`, `value` +
`currency` (always together), `method`, `content_group`, `app_version` /
`platform` for apps.

Write the plan as a table and commit it to the repo:

```
| Event | When it fires (exact trigger) | Parameters | Destination(s) | Key event? | Owner |
```

## Implementation

- **Prefer events from application code** (dataLayer push or the SDK call at
  the moment the action succeeds) over CSS-selector click triggers, which break
  when the UI changes.
  ```js
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'signup_completed', method: 'email', user_id: id });
  ```
- **Single-page apps:** make sure route changes send exactly one page view
  (either GA4 enhanced measurement history events *or* a router hook, not both).
- **Server-side events** for purchases and subscriptions (webhooks from
  Stripe/app stores) — the client can't be trusted to report revenue.
- **Mobile apps:** Firebase/GA4 or product-analytics SDK; respect ATT on iOS and
  store privacy labels; send purchase events from server-verified receipts.

## GA4 specifics

- Enhanced Measurement: keep page views, scrolls, outbound clicks, site search;
  disable video/file-download auto events if you track them manually.
- Mark only real business outcomes as **key events** (GA4 renamed
  "conversions" to "key events" in 2024); there's a per-property limit.
- Add every funnel domain; configure cross-domain measurement for
  `site.com → app.site.com`; list payment providers as unwanted referrals.
- Define internal-traffic filters and activate them (they start in testing mode).

## Ads conversions

- Google Ads: import GA4 key events or use the Ads tag — not both for the same action.
- Meta: Pixel plus Conversions API (server-side) with event deduplication IDs.
- LinkedIn/TikTok/Reddit: platform tag + server events where available.
- Use consistent attribution windows when comparing platforms; expect platform
  numbers to exceed your analytics.

## UTMs

| Param | Convention | Example |
|---|---|---|
| utm_source | platform, lowercase | `google`, `linkedin`, `newsletter` |
| utm_medium | channel type | `cpc`, `email`, `social`, `referral` |
| utm_campaign | campaign | `2026-10-launch` |
| utm_content | creative/variant | `video-hook-a` |
| utm_term | paid keyword | `habit-tracker` |
Never put UTMs on internal links (it overwrites the real source). Keep a shared
UTM sheet or builder so names stay consistent.

## Consent Mode

- Basic: tags don't load until consent → no data from people who decline.
- Advanced: tags load with cookieless pings → modelled data for people who decline.
Choose with legal input; both need a CMP integrated in GTM.

## Common breakages

| Symptom | Likely cause |
|---|---|
| Events doubled | Hard-coded gtag + GTM tag; enhanced measurement + manual tag; SPA double page views |
| Paid traffic shows as "direct" | UTMs stripped by redirects; links missing UTMs |
| Self-referrals from payment page | Payment domain not listed as unwanted referral |
| Conversions in Ads ≠ GA4 | Different attribution windows/models; duplicated tags |
| `(not set)` landing pages | SPA route handling; session start before page_view |
| Purchases missing | Client-side only; ad blockers; redirect after payment drops tag |

## Output format

```
## Tracking plan
<event table>

## Implementation steps
1. … (code snippets per event)

## Verification log
| Event | Verified in | Date | Result |

## Issues found (audit/debug)
| Issue | Evidence | Fix | Priority |
```

<!-- Adapted from alirezarezvani/claude-skills marketing-skill/skills/analytics-tracking (MIT). Naming made consistent; unsupported claims (retroactive key events, consent-rate figures) removed; product-analytics and mobile notes added. -->

# SnowFox AI Readiness Assessment

An agentic web app that scores a business **1–100** on how ready it is to adopt AI. The assessment is delivered as a short, conversational questionnaire (≈10 minutes), powered by Claude as the conversational layer and TypeScript for the deterministic scoring math. On completion the prospect can send their results to SnowFox and request a consultation.

- **Hosting:** Netlify (static frontend + Netlify Functions)
- **Framework:** Next.js 14 (App Router) + TypeScript
- **LLM:** Anthropic Claude (Sonnet)
- **Database:** Netlify DB (Neon Postgres)
- **Email:** Resend
- **Styling:** Tailwind (SnowFox palette, drop-in for brand polish)
- **Source of truth for questions/scoring:** `AI_Readiness_Questionnaire.xlsx`

## Repository layout

```
.
├── AI_Readiness_Questionnaire.xlsx   # Spec (canonical). Update in lockstep with code.
├── db/schema.sql                     # One-time Postgres migration.
├── netlify.toml                      # Build + security headers + function config.
├── next.config.mjs
├── tailwind.config.ts
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Landing ("Start the assessment")
│   │   ├── assessment/page.tsx       # Chat flow + results screen host
│   │   ├── layout.tsx / globals.css  # Shell + SnowFox header/footer
│   │   └── api/
│   │       ├── session/route.ts      # POST — create a session
│   │       ├── turn/route.ts         # POST — next-turn agentic loop
│   │       └── submit-lead/route.ts  # POST — send results to SnowFox + prospect
│   ├── components/
│   │   ├── ChatShell.tsx             # Chat UI, option picker, progress bar
│   │   ├── ScoreCard.tsx             # Final 1-100 score + category breakdown
│   │   └── LeadForm.tsx              # Consultation request form
│   ├── lib/
│   │   ├── questionnaire.ts          # TS port of the xlsx spec (single source of truth)
│   │   ├── scoring.ts                # Deterministic 1-100 calculation
│   │   ├── claude.ts                 # Anthropic client + system prompt + JSON extraction
│   │   ├── db.ts                     # Neon serverless client wrapper
│   │   └── email.ts                  # Resend templates (SnowFox + prospect)
│   └── __tests__/scoring.test.ts     # Vitest suite for the scoring engine
└── .env.example
```

## Architecture, in one paragraph

The frontend holds a tiny state machine: three context questions (industry / employee count / revenue), then a chat loop driven by `/api/turn`. The turn endpoint plans the next question deterministically (from `planNextQuestion`) and hands it to Claude with a tight system prompt, getting back a friendly phrasing plus the option id the user's reply maps to. The scoring math is *never* delegated to the LLM — `computeScore()` runs in pure TypeScript over the recorded answers, so the result is reproducible and auditable. When the questionnaire completes, the final score is persisted on the session; a separate `/api/submit-lead` endpoint captures contact info and fires two emails via Resend: an internal notification to a SnowFox inbox and a branded copy of the results to the prospect.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY, NETLIFY_DATABASE_URL, RESEND_API_KEY, etc.
psql "$NETLIFY_DATABASE_URL" -f db/schema.sql   # one-time migration (or run in Neon web console)
npm run dev                  # http://localhost:3000
npm test                     # runs the scoring engine test suite
```

### Environment variables

| Var | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key (required) |
| `NETLIFY_DATABASE_URL` | Postgres URL — auto-injected on Netlify once Netlify DB is enabled |
| `RESEND_API_KEY` | Resend transactional email (required for lead submit) |
| `SNOWFOX_LEADS_EMAIL` | Inbox that receives the internal lead email, e.g. `info@snowfoxsolutions.com` |
| `SNOWFOX_FROM_EMAIL` | Verified "from" domain, e.g. `assessments@snowfoxsolutions.com` |
| `PUBLIC_APP_URL` | Canonical deployed URL — used inside email links |

## Netlify deployment

1. Push this repo to GitHub.
2. In Netlify, **Add new site → Import an existing project** → pick the repo.
3. Build command: `npm run build`. Publish directory: `.next`. (Already set in `netlify.toml`.)
4. **Enable Netlify DB** (Site configuration → Integrations → Netlify DB). This auto-provisions Neon Postgres and injects `NETLIFY_DATABASE_URL`.
5. Run the schema once against the provisioned DB:
   - Open the Neon console from the Netlify integration and paste `db/schema.sql`, **or**
   - Run locally against the printed connection string: `psql "$url" -f db/schema.sql`
6. Set remaining env vars in **Site configuration → Environment variables**: `ANTHROPIC_API_KEY`, `RESEND_API_KEY`, `SNOWFOX_LEADS_EMAIL`, `SNOWFOX_FROM_EMAIL`, `PUBLIC_APP_URL`.
7. In Resend, verify your sending domain (snowfoxsolutions.com) and create an API key.
8. Trigger a deploy. First request will cold-start the functions; subsequent responses are fast.

## Testing

`npm test` runs the Vitest suite for the scoring engine. Twelve tests cover:

- Minimum / maximum / midpoint scoring (should return 1, 100, 50 respectively)
- Weight sums (categories sum to 1.0)
- Follow-up bonus caps (no category can exceed 100%)
- Band-boundary correctness for every band
- Targeted follow-ups firing only under the right conditions
- `planNextQuestion` progressing through the expected order

Any change to `questionnaire.ts` should run `npm test` to confirm the scoring contract still holds.

## Updating the questionnaire

The xlsx and `src/lib/questionnaire.ts` **must** stay in sync. When changing questions, weights, or scoring logic:

1. Edit `AI_Readiness_Questionnaire.xlsx`.
2. Mirror the change in `src/lib/questionnaire.ts`.
3. Run `npm test` — update tests if weights/bands changed intentionally.
4. Redeploy.

If the spec drifts between the two, the xlsx is documentation only — `questionnaire.ts` is what the app actually runs on.

## Design rationales worth remembering

- **LLM never scores.** It phrases questions and extracts the user's choice into a defined option id; that's it. This keeps scoring reproducible ("why did I get a 62?") and safe from prompt injection.
- **Branching is data, not prompt.** Follow-up triggers are pure functions over core answers (`shouldAsk` predicates), so the UI and scoring engine both evaluate them identically without relying on the model.
- **Everything is serverless-friendly.** Neon's `@neondatabase/serverless` driver works over HTTP/WS, so Netlify Functions don't need to hold connections.
- **Emails fire independently.** If Resend bounces on one of the two sends (e.g. transient API issue), we still record the partial success on the `leads` row so the SnowFox team can see what went through.

## Open TODOs for v1 polish

- Plug exact SnowFox hex values / logo once the brand guide is finalized (currently placeholders in `tailwind.config.ts` and header).
- Optional: add a `/admin` page (password-gated) to view recent leads without opening the DB.
- Optional: Cal.com / Calendly embed on the "Thanks" screen for prospects who want to self-book.
- Optional: Netlify Edge Function variant of `/api/turn` for sub-200ms latency.

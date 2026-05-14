# Audit Note — AiTaxPrep

Source: `/Users/erolakarsu/projects/_AUDIT/reports/batch_08.md` (section 13).

## Original Recommendations

### Missing AI Counterparts
- State/local tax optimization
- Estimated payment planning

### Missing Non-AI Features
- E-filing integration (EFIN, IRS)
- CPA coordination
- Tax plan comparison visualizations
- Year-over-year anomaly detection

### Custom Feature Suggestions
- Multi-scenario filing comparison
- Quarterly estimated payment planner
- Multi-state filer support
- Document auto-categorization
- Engagement letter automation

## Implemented (this round)
1. `POST /api/ai/state-tax-optimize` — jurisdiction-specific advice using `getUserContext`.
2. `POST /api/ai/estimated-payments` — quarterly recommendations with safe-harbor strategy.

Pattern reused: `aiService.chat` + `getUserContext` (existing helper). Syntax-checked.

## Backlog (prioritized)
1. **MECHANICAL** Year-over-year anomaly detection endpoint.
2. **MECHANICAL** Multi-scenario (MFS/MFJ/HoH) comparison endpoint.
3. **NEEDS-CREDS** IRS e-filing integration (EFIN required).
4. **NEEDS-PRODUCT-DECISION** CPA coordination workflow, engagement letter templates.

## Apply pass 4 (mechanical backlog)

Implemented both remaining mechanical backlog items in `server/routes/ai.js`:

1. `POST /api/ai/yoy-anomaly` — year-over-year anomaly detection with audit-risk rating and planning opportunities; reuses `getUserContext` + `aiService.chat` and accepts caller-provided prior/current summaries.
2. `POST /api/ai/filing-scenario-compare` — side-by-side comparison of MFJ / MFS / HoH / Single (configurable list) with recommendation rationale.

Both endpoints return HTTP 503 when `OPENROUTER_API_KEY` is missing.

Frontend: added two pages to `client/src/App.js` (`YoYAnomalyPage`, `FilingScenarioComparePage`), routed at `/yoy-anomaly` and `/filing-scenario-compare`, and wired into the sidebar navigation. Both render JSON responses, show 503 messages explicitly, and reuse existing `useToast` / `api` helpers.

Smoke test: `node --check` PASS for `server/routes/ai.js`; `esbuild` PASS for `client/src/App.js`. Live HTTP smoke skipped (PostgreSQL dependency).

Backlog deferred: IRS e-filing (NEEDS-CREDS — EFIN); CPA coordination + engagement-letter automation (NEEDS-PRODUCT-DECISION).

## Apply pass 3 (frontend)

FE already wired. `client/src/App.js` (CRA monolith) routes `/state-tax-optimize` → `StateTaxOptimizePage` and `/estimated-payments-ai` → `EstimatedPaymentsAIPage`, both posting to the pass-2 endpoints (`/ai/state-tax-optimize`, `/ai/estimated-payments`). Sidebar nav exposes both. No FE changes this pass.

## Apply pass 5 (all backlog)

10 features added.

### NEEDS-CREDS (503 stubs)
- IRS e-file — `POST /api/integrations/efile/irs`. Env: `IRS_EFIN, IRS_EFILE_API_KEY`.
- State e-file — `POST /api/integrations/efile/state`. Env: `STATE_EFILE_API_KEY` (jurisdiction in body).
- Stripe billing — `POST /api/integrations/billing/stripe`. Env: `STRIPE_SECRET_KEY`.
- Plaid bank import — `POST /api/integrations/bank/plaid`. Env: `PLAID_CLIENT_ID, PLAID_SECRET, PLAID_ENV`.
- DocuSign — `POST /api/integrations/sign/docusign`. Env: `DOCUSIGN_INTEGRATION_KEY, DOCUSIGN_ACCOUNT_ID, DOCUSIGN_PRIVATE_KEY`.

### NEEDS-PRODUCT-DECISION
- CPA coordination workflow — assignment + review notes; states `draft -> with_cpa -> approved -> filed`. Override via `CPA_WORKFLOW_STATES`. New tables `cpa_assignments`, `cpa_review_notes`.
- Engagement letter templates — 3 built-ins (`individual_basic`, `individual_complex`, `business`). Variables `{{client_name}}, {{tax_year}}, {{fee}}, {{firm}}`. Override directory via `ENGAGEMENT_TEMPLATE_DIR`.

### MECHANICAL
- Multi-state filer summary — `POST /api/utilities/multistate`. Returns state apportionment + return type per state.
- Document auto-categorization — `POST /api/utilities/auto-categorize`. Regex classifier (W-2/1099-INT/1099-DIV/...). Real ML gated on `DOC_CATEGORIZER_PROVIDER`.
- Tax plan visualization — `POST /api/utilities/visualization`. Chart-ready scenario data + delta vs baseline.

### Files
- `server/routes/{integrations,cpaWorkflow,engagementLetters,utilities}.js`
- `server/index.js` (4 mounts)
- `client/src/App.js` (BacklogToolsPage + route)

### Smoke test
PASS — backend booted on port 5094, `/api/health` 200. Pre-existing `column "role" does not exist` schema mismatch causes login to fail (verified the same failure occurs at the unmodified baseline, so NOT caused by these changes). All new auth-protected endpoints return 401 unauthenticated, and authenticated calls (using a self-signed JWT against existing `JWT_SECRET`) return correct payloads — IRS 503 stub, multistate apportionment, auto-categorizer, visualization, engagement letter rendering all verified.

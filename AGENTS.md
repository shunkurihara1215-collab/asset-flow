<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- AI quota uses service-only PostgreSQL reservation/completion functions with a per-user lock and durable request IDs; API-start reservations (including failures/unknown outcomes) consume the JST monthly quota, never auto-expire, and completion saves history atomically. Why: parallel/replayed requests cannot double-call, exceed quota, or invent a saved answer; pre-API validation/read failures consume no quota.
- Data read gates hide unverified balances on loading/error (including stale cache); writes confirm affected rows and use a synchronous per-action lock plus safe persistent errors before invalidating shared queries. Why: failed reads/writes must never resemble zero balances or saved/deleted data.
- Pure finance/date math lives in `src/lib/finance.ts` and `src/lib/history.ts` (unit tested); UI only calls these. Why: keep logic testable and reusable.
- Client data access uses the browser Supabase client with RLS via hooks in `src/lib/data.ts`; privileged or secret-requiring work (AI, account deletion) goes in `*.functions.ts` server functions with `requireSupabaseAuth`. Why: per-user isolation enforced in the database.
- Current-month asset history is updated by the existing asset trigger; a daily JST-midnight internal SQL job inserts only missing current-month rows for known asset states, never backfills past gaps or overwrites rows. Client manual backfill remains past-month only. Why: unchanged assets need monthly records without inventing historical balances.

- Feature gating goes through `canUse()` in `src/lib/plans.ts`; plan comes from `subscriptions` (server-writable only). Why: billing can later flip plans without UI changes.
- Premium access is derived by `effectivePlan()` (plan + status + current_period_end) from server-written `subscriptions`; demo plan switching is disabled server-side (only a server secret can enable it) and demo rows never grant premium; free goal limit is enforced by a DB trigger; Stripe return URLs pass the server allowlist in src/lib/redirect.ts. Why: clients cannot self-upgrade on the published site.
- Account deletion cancels and verifies Stripe contracts in every configured environment before deleting the explicit user-table list in `account-deletion.server.ts`; add personal-data tables to that list, but retain private deletion tombstones. Why: retries cannot leave continuing charges or resurrect contracts through late webhooks.
- Finance calendar helpers use Asia/Tokyo for instants, preserve date-only values, compare exact calendar months, and include this month's end contribution in goal periods; missing graph months are null, never zero. Why: avoid timezone drift, misleading comparisons, and off-by-one contributions.
- Stripe calls use the shared gateway client; subscription reads filter by environment, and signed webhooks use the generated admin client after verification. Why: keep test/live data isolated and persist payment events reliably.
- Checkout validates Stripe's active catalog price against the shared `premium-pricing.ts` contract, including tax behavior; never migrate existing subscription items when replacing a catalog price. Why: prevent display/charge mismatches and preserve existing contracts.
- Billing environment is derived from build-owned payment public configuration by `billing.server.ts`, never request input; subscription readers and server-only goal creation use the latest environment-scoped row with deterministic ordering. Why: sandbox access cannot grant live features or bypass goal limits.
- Verified payment events retrieve current Stripe state and atomically record event processing with a synchronization timestamp; failed events remain retryable. Why: duplicate and out-of-order delivery cannot overwrite newer persisted reads.

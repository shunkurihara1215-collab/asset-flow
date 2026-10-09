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
- Pure finance/date math lives in `src/lib/finance.ts` and `src/lib/history.ts` (unit tested); UI only calls these. Why: keep logic testable and reusable.
- Client data access uses the browser Supabase client with RLS via hooks in `src/lib/data.ts`; privileged or secret-requiring work (AI, account deletion) goes in `*.functions.ts` server functions with `requireSupabaseAuth`. Why: per-user isolation enforced in the database.
- Current-month asset history is written by a DB trigger on `assets`; the client may only write past-month rows with `source = manual` (backdated snapshots). Why: history stays consistent with assets while allowing backfill.

- Feature gating goes through `canUse()` in `src/lib/plans.ts`; plan comes from `subscriptions` (server-writable only). Why: billing can later flip plans without UI changes.
- Premium access is derived by `effectivePlan()` (plan + status + current_period_end) from server-written `subscriptions`; demo plan switching is refused server-side outside preview/local hosts. Why: clients cannot self-upgrade on the published site.
- Account deletion iterates an explicit list of user-owned tables in `account.functions.ts`; add every new user_id table there. Why: no orphaned personal data.
- Monthly asset snapshots use Asia/Tokyo month boundaries. Why: avoid UTC month-start drift for Japanese users.

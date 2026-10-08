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
- Plan switching is a demo server function (`plan.functions.ts`) until billing exists; AI routes re-check `canUse()` server-side. Why: subscriptions stay server-writable.
- Feature gating goes through `canUse()` in `src/lib/plans.ts`; plan comes from `subscriptions` (server-writable only). Why: billing can later flip plans without UI changes.

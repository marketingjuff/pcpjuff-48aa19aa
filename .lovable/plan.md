## Security Fix: pedidos_delete_team Policy Role

### Problem
The `pedidos_delete_team` RLS policy on the `pedidos` table is scoped to the `public` role (which includes unauthenticated/anonymous users), while all other pedidos policies (SELECT, INSERT, UPDATE) are correctly scoped to `authenticated`. Although the policy's `USING` condition calls `is_team_member()`, which currently blocks unauthenticated requests, this violates least-privilege principles and could become exploitable if `is_team_member()` ever changes.

### Fix
1. **Database Migration**: Drop the existing `pedidos_delete_team` policy and recreate it with `TO authenticated` to match all other pedidos policies.

   ```sql
   DROP POLICY IF EXISTS pedidos_delete_team ON public.pedidos;
   CREATE POLICY pedidos_delete_team ON public.pedidos FOR DELETE TO authenticated USING (public.is_team_member());
   ```

2. **Mark Finding as Fixed**: After migration approval and execution, mark the `supabase_lov` security finding (`pedidos_delete_public_role`) as resolved.

### Verification
- Query `pg_policies` to confirm `pedidos_delete_team` now shows `roles: {authenticated}` instead of `roles: {public}`.
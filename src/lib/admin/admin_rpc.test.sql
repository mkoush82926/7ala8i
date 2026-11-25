-- WS-1I database test: every admin write produces exactly one audit row,
-- non-platform users are refused, and hidden reviews disappear for anon.
--
-- Run inside a transaction that is rolled back (the local DB is shared):
--   docker exec -i $(docker ps --format '{{.Names}}' | grep supabase_db) \
--     psql -U postgres -v ON_ERROR_STOP=1 -c 'BEGIN' \
--     -f - -c 'ROLLBACK' < <(cat supabase/migrations/20250101002800_admin.sql src/lib/admin/admin_rpc.test.sql)
-- or `npm run test -- src/lib/admin` with ADMIN_DB_TEST=1 (see admin-db.test.ts).
-- Prints "ADMIN_SQL_TESTS_OK" on success; any failed assertion raises.

-- ─── Fixtures (as postgres) ────────────────────────────────────────────────
INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
VALUES
  ('1a000000-0000-4000-8000-0000000000a1', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ws1i-admin@test.local', '{}', '{"full_name":"WS1I Admin"}', now(), now()),
  ('1a000000-0000-4000-8000-0000000000a2', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ws1i-owner@test.local', '{}', '{"full_name":"WS1I Owner"}', now(), now()),
  ('1a000000-0000-4000-8000-0000000000a3', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
   'ws1i-support@test.local', '{}', '{"full_name":"WS1I Support"}', now(), now());

INSERT INTO public.profiles (id, full_name, role)
VALUES ('1a000000-0000-4000-8000-0000000000a1', 'WS1I Admin', 'customer'),
       ('1a000000-0000-4000-8000-0000000000a2', 'WS1I Owner', 'customer'),
       ('1a000000-0000-4000-8000-0000000000a3', 'WS1I Support', 'customer')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.shops (id, name) VALUES ('1a000000-0000-4000-8000-0000000000b1', 'WS1I Test Shop');
UPDATE public.profiles SET platform_role = 'admin', role = 'customer', shop_id = NULL
 WHERE id = '1a000000-0000-4000-8000-0000000000a1';
UPDATE public.profiles SET platform_role = 'support', role = 'customer', shop_id = NULL
 WHERE id = '1a000000-0000-4000-8000-0000000000a3';
UPDATE public.profiles SET platform_role = NULL, role = 'shop_admin', shop_id = '1a000000-0000-4000-8000-0000000000b1'
 WHERE id = '1a000000-0000-4000-8000-0000000000a2';

INSERT INTO public.reviews (id, shop_id, rating, comment, reviewer_name)
VALUES ('1a000000-0000-4000-8000-0000000000c1', '1a000000-0000-4000-8000-0000000000b1', 1, 'spam spam', 'X');
INSERT INTO public.services (id, shop_id, name, duration, price, is_active)
VALUES ('1a000000-0000-4000-8000-0000000000d1', '1a000000-0000-4000-8000-0000000000b1', 'Cut', 30, 5, true);

CREATE TEMP TABLE ws1i_ctx (k text PRIMARY KEY, v text);
GRANT ALL ON ws1i_ctx TO authenticated, anon;

-- Asserts that `p_sql` raises `p_code`.
CREATE OR REPLACE FUNCTION pg_temp.ws1i_expect_error(p_sql text, p_code text)
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE p_sql;
  EXCEPTION WHEN others THEN
    IF SQLERRM LIKE p_code || '%' THEN RETURN; END IF;
    RAISE EXCEPTION 'expected % from [%], got %', p_code, p_sql, SQLERRM;
  END;
  RAISE EXCEPTION 'expected % from [%], got success', p_code, p_sql;
END $$;

-- Runs a write and asserts it added exactly one audit row with that action.
CREATE OR REPLACE FUNCTION pg_temp.ws1i_expect_audit(p_sql text, p_action text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  v_before bigint;
  v_after  bigint;
BEGIN
  SELECT count(*) INTO v_before FROM public.admin_audit_log WHERE action = p_action;
  EXECUTE p_sql;
  SELECT count(*) INTO v_after FROM public.admin_audit_log WHERE action = p_action;
  IF v_after <> v_before + 1 THEN
    RAISE EXCEPTION 'audit: [%] wrote % rows for %', p_sql, v_after - v_before, p_action;
  END IF;
END $$;

-- ─── Non-platform users are refused ────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"1a000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
SELECT pg_temp.ws1i_expect_error('SELECT public.admin_whoami()', 'NOT_AUTHORIZED');
SELECT pg_temp.ws1i_expect_error('SELECT public.admin_overview()', 'NOT_AUTHORIZED');
SELECT pg_temp.ws1i_expect_error($q$SELECT public.admin_set_shop_verified('1a000000-0000-4000-8000-0000000000b1', true, NULL)$q$, 'NOT_AUTHORIZED');
SELECT pg_temp.ws1i_expect_error($q$SELECT public.admin_set_profile_banned('1a000000-0000-4000-8000-0000000000a3', true, 'abuse report')$q$, 'NOT_AUTHORIZED');
-- The owner cannot set platform columns directly.
SELECT pg_temp.ws1i_expect_error($q$UPDATE public.shops SET suspended_at = now() WHERE id = '1a000000-0000-4000-8000-0000000000b1'$q$, 'FORBIDDEN');
-- The audit log and queues are invisible to non-platform users.
DO $$ BEGIN
  IF (SELECT count(*) FROM public.admin_audit_log) <> 0 THEN RAISE EXCEPTION 'owner can read audit log'; END IF;
  IF (SELECT count(*) FROM public.banned_phones) <> 0 THEN RAISE EXCEPTION 'owner can read bans'; END IF;
END $$;
-- The owner can report a review on their shop.
INSERT INTO ws1i_ctx VALUES ('report', public.report_review('1a000000-0000-4000-8000-0000000000c1', 'spam', NULL)::text);
SELECT pg_temp.ws1i_expect_error($q$SELECT public.report_review('1a000000-0000-4000-8000-0000000000c1', 'spam', NULL)$q$, 'ALREADY_REPORTED');
RESET ROLE;

-- anon cannot call admin RPCs at all.
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
SELECT pg_temp.ws1i_expect_error('SELECT public.admin_whoami()', 'permission denied');
RESET ROLE;

-- ─── Support role: read + moderation, no admin-only writes ─────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"1a000000-0000-4000-8000-0000000000a3","role":"authenticated"}', true);
DO $$ BEGIN
  IF public.admin_whoami() ->> 'role' <> 'support' THEN RAISE EXCEPTION 'whoami role'; END IF;
  IF (public.admin_list_review_reports('open') ->> 'total')::int < 1 THEN RAISE EXCEPTION 'report queue empty'; END IF;
END $$;
SELECT pg_temp.ws1i_expect_error($q$SELECT public.admin_set_shop_suspended('1a000000-0000-4000-8000-0000000000b1', true, 'fraud report')$q$, 'NOT_AUTHORIZED');
RESET ROLE;

-- ─── Admin: every write is audited ─────────────────────────────────────────
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"1a000000-0000-4000-8000-0000000000a1","role":"authenticated"}', true);

DO $$ BEGIN
  IF public.admin_whoami() ->> 'role' <> 'admin' THEN RAISE EXCEPTION 'whoami role'; END IF;
  IF (public.admin_list_shops('WS1I', 'all') ->> 'total')::int <> 1 THEN RAISE EXCEPTION 'list_shops filter'; END IF;
  IF public.admin_get_shop('1a000000-0000-4000-8000-0000000000b1') -> 'shop' ->> 'name' <> 'WS1I Test Shop' THEN RAISE EXCEPTION 'get_shop'; END IF;
  PERFORM public.admin_overview();
  PERFORM public.admin_list_claims('all');
  PERFORM public.admin_list_bans();
  PERFORM public.admin_search_profiles('WS1I');
END $$;

SELECT pg_temp.ws1i_expect_error($q$SELECT public.admin_set_shop_suspended('1a000000-0000-4000-8000-0000000000b1', true, '')$q$, 'REASON_REQUIRED');

SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_shop_verified('1a000000-0000-4000-8000-0000000000b1', true, NULL)$q$, 'shop.verify');
SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_shop_verified('1a000000-0000-4000-8000-0000000000b1', false, 'docs expired')$q$, 'shop.unverify');
SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_shop_suspended('1a000000-0000-4000-8000-0000000000b1', true, 'fraud report')$q$, 'shop.suspend');
SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_shop_suspended('1a000000-0000-4000-8000-0000000000b1', false, 'cleared after call')$q$, 'shop.unsuspend');
SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_profile_banned('1a000000-0000-4000-8000-0000000000a2', true, 'abusive owner')$q$, 'profile.ban');
SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_profile_banned('1a000000-0000-4000-8000-0000000000a2', false, 'appeal granted')$q$, 'profile.unban');
SELECT pg_temp.ws1i_expect_error($q$SELECT public.admin_set_profile_banned('1a000000-0000-4000-8000-0000000000a3', true, 'staff member')$q$, 'CANNOT_BAN_STAFF');
SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_phone_banned('+962 79 123 4567', true, 'fake bookings')$q$, 'phone.ban');
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.banned_phones WHERE phone_key = '791234567') THEN RAISE EXCEPTION 'phone key'; END IF;
END $$;
SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_phone_banned('0791234567', false, 'false positive')$q$, 'phone.unban');
SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_review_hidden('1a000000-0000-4000-8000-0000000000c1', true, 'spam content')$q$, 'review.hide');
SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_review_hidden('1a000000-0000-4000-8000-0000000000c1', false, NULL)$q$, 'review.restore');
SELECT pg_temp.ws1i_expect_audit(
  format($q$SELECT public.admin_resolve_review_report(%L, 'hide', 'spam content')$q$, (SELECT v FROM ws1i_ctx WHERE k = 'report')),
  'review_report.upheld');
SELECT pg_temp.ws1i_expect_audit($q$
  INSERT INTO ws1i_ctx SELECT 'claim', public.admin_create_claim_dispute('1a000000-0000-4000-8000-0000000000b1', 'Real Owner', '0790000000', 'I own this shop') ->> 'id'
$q$, 'claim.open');
SELECT pg_temp.ws1i_expect_audit(
  format($q$SELECT public.admin_resolve_claim_dispute(%L, 'rejected', 'no proof given')$q$, (SELECT v FROM ws1i_ctx WHERE k = 'claim')),
  'claim.rejected');
SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_plan_override('1a000000-0000-4000-8000-0000000000b1',
  '{"plan_code":"team","max_barbers":5,"monthly_message_allowance":500}', 'launch promo')$q$, 'plan.set');
SELECT pg_temp.ws1i_expect_audit($q$SELECT public.admin_set_plan_override('1a000000-0000-4000-8000-0000000000b1', NULL, 'promo ended')$q$, 'plan.clear');

-- Impersonation: start/stop audited; read mode cannot write.
SELECT pg_temp.ws1i_expect_audit($q$
  INSERT INTO ws1i_ctx SELECT 'imp_read', public.admin_start_impersonation('1a000000-0000-4000-8000-0000000000b1', 'read', NULL) ->> 'id'
$q$, 'impersonation.start');
DO $$ BEGIN
  IF public.admin_whoami() -> 'impersonation' ->> 'mode' <> 'read' THEN RAISE EXCEPTION 'whoami impersonation'; END IF;
  PERFORM public.admin_impersonation_snapshot((SELECT v FROM ws1i_ctx WHERE k = 'imp_read')::uuid);
END $$;
SELECT pg_temp.ws1i_expect_error(
  format($q$SELECT public.admin_impersonation_update_shop(%L, '{"name":"X"}')$q$, (SELECT v FROM ws1i_ctx WHERE k = 'imp_read')),
  'IMPERSONATION_READ_ONLY');
SELECT pg_temp.ws1i_expect_error($q$SELECT public.admin_start_impersonation('1a000000-0000-4000-8000-0000000000b1', 'write', 'short')$q$, 'REASON_REQUIRED');
-- Starting a write session supersedes (and audits the stop of) the read one.
SELECT pg_temp.ws1i_expect_audit($q$
  INSERT INTO ws1i_ctx SELECT 'imp_write', public.admin_start_impersonation('1a000000-0000-4000-8000-0000000000b1', 'write', 'owner asked for help on call') ->> 'id'
$q$, 'impersonation.stop');
SELECT pg_temp.ws1i_expect_audit(
  format($q$SELECT public.admin_impersonation_update_shop(%L, '{"name":"WS1I Renamed"}')$q$, (SELECT v FROM ws1i_ctx WHERE k = 'imp_write')),
  'impersonation.shop_update');
SELECT pg_temp.ws1i_expect_error(
  format($q$SELECT public.admin_impersonation_update_shop(%L, '{"tax_number":"1"}')$q$, (SELECT v FROM ws1i_ctx WHERE k = 'imp_write')),
  'INVALID_INPUT');
SELECT pg_temp.ws1i_expect_audit(
  format($q$SELECT public.admin_impersonation_set_service_active(%L, '1a000000-0000-4000-8000-0000000000d1', false)$q$, (SELECT v FROM ws1i_ctx WHERE k = 'imp_write')),
  'impersonation.service_update');
SELECT pg_temp.ws1i_expect_audit(
  format($q$SELECT public.admin_stop_impersonation(%L)$q$, (SELECT v FROM ws1i_ctx WHERE k = 'imp_write')),
  'impersonation.stop');
SELECT pg_temp.ws1i_expect_error(
  format($q$SELECT public.admin_impersonation_snapshot(%L)$q$, (SELECT v FROM ws1i_ctx WHERE k = 'imp_write')),
  'IMPERSONATION_INACTIVE');

-- The audit log is append-only even for platform admins.
SELECT pg_temp.ws1i_expect_error('DELETE FROM public.admin_audit_log', 'permission denied');
RESET ROLE;
SELECT pg_temp.ws1i_expect_error('DELETE FROM public.admin_audit_log', 'FORBIDDEN');

-- ─── Hidden reviews vanish for anon; suspended shops refuse public bookings ─
UPDATE public.reviews SET hidden_at = now() WHERE id = '1a000000-0000-4000-8000-0000000000c1';
SET LOCAL ROLE anon;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.reviews WHERE id = '1a000000-0000-4000-8000-0000000000c1') THEN
    RAISE EXCEPTION 'anon sees a hidden review';
  END IF;
END $$;
RESET ROLE;

SELECT 'ADMIN_SQL_TESTS_OK';

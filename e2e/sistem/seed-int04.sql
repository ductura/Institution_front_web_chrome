-- Pokrenuti samo preko lokalnog Unix socketa, nakon Institution_server seeda.
\set ON_ERROR_STOP on
DO $demo$
DECLARE
  issuer constant text := 'http://localhost:8090';
  home_org constant text := 'demo.ductus.test';
  institution_id_demo uuid;
  teacher_id uuid;
  admin_token text := rtrim(translate(encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'base64'), '+/', '-_'), '=');
  teacher_token text := rtrim(translate(encode(uuid_send(gen_random_uuid()) || uuid_send(gen_random_uuid()), 'base64'), '+/', '-_'), '=');
BEGIN
  IF pg_catalog.inet_server_addr() IS NOT NULL THEN
    RAISE EXCEPTION 'INT-04 seed zahtijeva lokalni PostgreSQL socket';
  END IF;
  SELECT id INTO STRICT institution_id_demo FROM identity.institution
    WHERE slug = 'demo-fakultet' AND aai_home_org = home_org;

  SET LOCAL ROLE ductus_auth;
  PERFORM identity.open_session(issuer, 'sim:nastavnik:demo-admin@demo.ductus.test',
    'demo-admin@demo.ductus.test', home_org, sha256(convert_to(admin_token, 'UTF8')), 'Vesna', 'Upravić', true);
  PERFORM identity.open_session(issuer, 'sim:nastavnik:demo-int04-nastavnik@demo.ductus.test',
    'demo-int04-nastavnik@demo.ductus.test', home_org, sha256(convert_to(teacher_token, 'UTF8')), 'Simulirani', 'Nastavnik', true);
  RESET ROLE;

  SELECT id INTO STRICT teacher_id FROM identity.user_account
    WHERE oidc_issuer = issuer AND oidc_subject = 'sim:nastavnik:demo-int04-nastavnik@demo.ductus.test'
      AND institution_id = institution_id_demo;

  SET LOCAL ROLE ductus_app;
  PERFORM set_config('app.session_token', admin_token, true);
  IF NOT EXISTS (SELECT 1 FROM institution.teacher_roles() t WHERE t.user_id = teacher_id
                 AND t.confirmed_at IS NOT NULL AND t.revoked_at IS NULL) THEN
    PERFORM institution.confirm_teacher_role(teacher_id);
  END IF;
  PERFORM identity.close_current_session();

  PERFORM set_config('app.session_token', teacher_token, true);
  PERFORM institution.create_course('Izmišljeni seminar o gradskim krovovima', '2026/2027', 'partially_allowed');
  PERFORM identity.close_current_session();
  RESET ROLE;
END
$demo$;

-- Test helpers. Each test runs a SQL statement as a given API role
-- (anon / authenticated) with a given JWT subject, and asserts either
-- that it fails, or that it returns an expected scalar.
create schema if not exists test;

create table if not exists test.results (
  label text primary key,
  passed boolean not null,
  detail text
);

create or replace function test.as_user(_role text, _uid text) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(_uid, ''), true);
  perform set_config('request.jwt.claims',
    case when _uid is null then '' else json_build_object('sub', _uid, 'role', _role)::text end, true);
  execute format('set local role %I', _role);
end $$;

create or replace function test.record(_label text, _ok boolean, _detail text) returns void
language plpgsql as $$
begin
  insert into test.results values (_label, _ok, _detail)
    on conflict (label) do update set passed = excluded.passed, detail = excluded.detail;
  raise notice '% | % | %', case when _ok then 'PASS' else 'FAIL' end, _label, _detail;
end $$;

-- Assert that the statement raises an error.
create or replace function test.expect_error(_label text, _role text, _uid text, _sql text) returns void
language plpgsql as $$
declare _ok boolean; _detail text;
begin
  begin
    perform test.as_user(_role, _uid);
    execute _sql;
    execute 'reset role';
    _ok := false; _detail := 'expected an error but statement succeeded';
  exception when others then
    execute 'reset role';
    _ok := true; _detail := SQLERRM;
  end;
  perform test.record(_label, _ok, _detail);
end $$;

-- Assert that the statement succeeds (side effects are kept).
create or replace function test.expect_ok(_label text, _role text, _uid text, _sql text) returns void
language plpgsql as $$
declare _ok boolean; _detail text;
begin
  begin
    perform test.as_user(_role, _uid);
    execute _sql;
    execute 'reset role';
    _ok := true; _detail := 'ok';
  exception when others then
    execute 'reset role';
    _ok := false; _detail := SQLERRM;
  end;
  perform test.record(_label, _ok, _detail);
end $$;

-- Assert that a scalar query returns the expected value.
create or replace function test.expect_scalar(_label text, _role text, _uid text, _sql text, _expected bigint) returns void
language plpgsql as $$
declare _got bigint; _ok boolean; _detail text;
begin
  begin
    perform test.as_user(_role, _uid);
    execute _sql into _got;
    execute 'reset role';
    _ok := (_got = _expected); _detail := format('expected %s, got %s', _expected, _got);
  exception when others then
    execute 'reset role';
    _ok := false; _detail := SQLERRM;
  end;
  perform test.record(_label, _ok, _detail);
end $$;

-- ============================================================
-- 배구 코치 앱 — 학생 소감 수집 (B-2: 학생별 토큰 + 누적 조회)
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
-- ⚠️ 이전에 만든 training_links / reflections 를 새 구조로 교체합니다.
--    (아직 데이터가 없으니 안전합니다.)
-- ============================================================

create extension if not exists "pgcrypto";

-- 기존 단순본 정리 (있으면 삭제)
drop table if exists public.reflections cascade;
drop table if exists public.training_links cascade;
drop table if exists public.students cascade;

-- ---------- 테이블 ----------

-- 학생: 코치 로컬 선수를 올림. token 으로 본인 식별.
create table public.students (
  id          text primary key,              -- 코치 앱의 로컬 player id
  coach_id    text not null default 'me',    -- 길3 대비
  team_name   text,
  name        text not null,
  number      int,
  token       text not null unique,          -- 개인 링크/QR 에 박히는 랜덤 문자열
  created_at  timestamptz not null default now()
);

-- 훈련: 코치가 "소감 받기"를 켠 훈련
create table public.training_links (
  id          text primary key,              -- 코치 앱의 로컬 session id
  coach_id    text not null default 'me',
  team_name   text,
  date        text,
  goal        text,
  is_open     boolean not null default true,
  created_at  timestamptz not null default now()
);

-- 소감: 학생당 훈련당 1개 (재제출=수정)
create table public.reflections (
  id           uuid primary key default gen_random_uuid(),
  link_id      text not null references public.training_links(id) on delete cascade,
  student_id   text not null references public.students(id) on delete cascade,
  player_name  text,
  content      text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (student_id, link_id)
);

create index reflections_link_idx on public.reflections(link_id);
create index reflections_student_idx on public.reflections(student_id);

-- ---------- RLS ----------
-- 코치 앱(신뢰됨)은 publishable 키로 직접 접근 허용.
-- 학생 웹은 직접 접근 대신 아래 RPC(토큰 기반)만 사용 → 본인 것만 노출.
alter table public.students       enable row level security;
alter table public.training_links enable row level security;
alter table public.reflections    enable row level security;

-- 코치용 직접 접근 정책 (단일 코치 길1 단계: 전체 허용. 길3에서 coach_id=auth.uid()로 강화)
create policy "coach students"  on public.students       for all using (true) with check (true);
create policy "coach links"     on public.training_links for all using (true) with check (true);
create policy "coach refl"      on public.reflections    for all using (true) with check (true);

-- ============================================================
-- 학생용 RPC (SECURITY DEFINER: RLS 우회하되 토큰으로 본인 것만)
-- ============================================================

-- 학생 진입: 본인 정보 + 열린 훈련 목록 + 내 소감 누적
create or replace function public.student_home(p_token text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student students%rowtype;
  v_open json;
  v_mine json;
begin
  select * into v_student from students where token = p_token;
  if not found then
    return json_build_object('ok', false, 'error', 'invalid_token');
  end if;

  -- 같은 코치의 열린 훈련(아직 소감 안 쓴 것 우선 표시는 클라이언트에서)
  select coalesce(json_agg(row_to_json(t) order by t.created_at desc), '[]'::json)
    into v_open
  from (
    select l.id, l.team_name, l.date, l.goal, l.is_open
    from training_links l
    where l.coach_id = v_student.coach_id and l.is_open = true
  ) t;

  -- 내 누적 소감 (읽기 전용, 최신순) + 훈련 정보 조인
  select coalesce(json_agg(row_to_json(r) order by r.created_at desc), '[]'::json)
    into v_mine
  from (
    select rf.link_id, rf.content, rf.created_at,
           l.date as training_date, l.goal as training_goal
    from reflections rf
    join training_links l on l.id = rf.link_id
    where rf.student_id = v_student.id
  ) r;

  return json_build_object(
    'ok', true,
    'student', json_build_object('name', v_student.name, 'number', v_student.number, 'team', v_student.team_name),
    'open_trainings', v_open,
    'my_reflections', v_mine
  );
end;
$$;

-- 소감 제출 (upsert: 같은 훈련에 다시 내면 수정)
create or replace function public.submit_reflection(p_token text, p_link_id text, p_content text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student students%rowtype;
  v_open boolean;
begin
  select * into v_student from students where token = p_token;
  if not found then
    return json_build_object('ok', false, 'error', 'invalid_token');
  end if;

  select is_open into v_open from training_links where id = p_link_id;
  if v_open is null then
    return json_build_object('ok', false, 'error', 'no_training');
  end if;
  if v_open = false then
    return json_build_object('ok', false, 'error', 'closed');
  end if;
  if length(trim(coalesce(p_content,''))) = 0 then
    return json_build_object('ok', false, 'error', 'empty');
  end if;

  insert into reflections (link_id, student_id, player_name, content)
  values (p_link_id, v_student.id, v_student.name, trim(p_content))
  on conflict (student_id, link_id)
  do update set content = excluded.content, updated_at = now();

  return json_build_object('ok', true);
end;
$$;

-- 익명(anon/publishable) 사용자가 위 두 RPC만 실행 가능하게
grant execute on function public.student_home(text) to anon, authenticated;
grant execute on function public.submit_reflection(text, text, text) to anon, authenticated;

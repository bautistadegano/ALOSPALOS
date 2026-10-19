-- =====================================================================
-- A los Palos · Club Los Molinos — base de datos
-- Pegá todo este archivo en Supabase → SQL Editor → New query → Run.
-- Se puede correr más de una vez sin romper nada.
-- =====================================================================

create extension if not exists citext;

-- ---------- Perfiles (uno por cuenta) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext unique not null check (username ~ '^[a-z0-9._]{3,20}$'),
  name text not null default '',
  foot text not null default 'derecho' check (foot in ('derecho','izquierdo','ambos')),
  number int,
  position text,
  height numeric,
  weight numeric,
  dob date,
  -- quién puede ver mis estadísticas: todos / amigos / nadie
  visibility text not null default 'amigos' check (visibility in ('todos','amigos','nadie')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Sesiones y patadas ----------
create table if not exists public.sessions (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id text not null,
  date timestamptz not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create table if not exists public.kicks (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  id text not null,
  session_id text not null,
  kick_type text not null,
  result text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
create index if not exists kicks_user_session on public.kicks (user_id, session_id);

-- ---------- Amistades ----------
create table if not exists public.friendships (
  requester uuid not null references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);

-- ---------- Funciones de ayuda ----------
create or replace function public.are_friends(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- ¿El usuario actual puede ver las estadísticas de "owner"?
create or replace function public.can_view(owner uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select owner = auth.uid()
    or exists (
      select 1 from profiles p
      where p.id = owner
        and (p.visibility = 'todos' or (p.visibility = 'amigos' and are_friends(auth.uid(), owner)))
    );
$$;

-- Para validar el nombre de usuario antes de registrarse (no expone datos)
create or replace function public.username_available(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from profiles where username = lower(u));
$$;
grant execute on function public.username_available(text) to anon, authenticated;

-- Al confirmar el registro se crea el perfil con los datos que cargó
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, name, foot)
  values (
    new.id,
    lower(coalesce(new.raw_user_meta_data->>'username', 'user' || substr(new.id::text, 1, 8))),
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'foot', 'derecho')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Seguridad (cada uno toca solo lo suyo) ----------
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.kicks enable row level security;
alter table public.friendships enable row level security;

-- Perfiles: los usuarios logueados ven nombre y usuario de todos (para buscar amigos).
drop policy if exists "perfiles visibles" on public.profiles;
create policy "perfiles visibles" on public.profiles for select to authenticated using (true);
drop policy if exists "editar mi perfil" on public.profiles;
create policy "editar mi perfil" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists "crear mi perfil" on public.profiles;
create policy "crear mi perfil" on public.profiles for insert to authenticated with check (id = auth.uid());

-- Sesiones y patadas: las mías siempre; las de otros según su privacidad.
drop policy if exists "ver sesiones" on public.sessions;
create policy "ver sesiones" on public.sessions for select to authenticated using (public.can_view(user_id));
drop policy if exists "mis sesiones" on public.sessions;
create policy "mis sesiones" on public.sessions for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "ver patadas" on public.kicks;
create policy "ver patadas" on public.kicks for select to authenticated using (public.can_view(user_id));
drop policy if exists "mis patadas" on public.kicks;
create policy "mis patadas" on public.kicks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Amistades: las veo si soy parte; mando solicitudes en mi nombre; acepta el que la recibe.
drop policy if exists "ver amistades" on public.friendships;
create policy "ver amistades" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
drop policy if exists "pedir amistad" on public.friendships;
create policy "pedir amistad" on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
drop policy if exists "aceptar amistad" on public.friendships;
create policy "aceptar amistad" on public.friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid());
drop policy if exists "borrar amistad" on public.friendships;
create policy "borrar amistad" on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));

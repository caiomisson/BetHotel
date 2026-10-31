-- =============================================================================
-- BetHotel — Schema completo (Supabase Free Tier)
-- Rode este arquivo inteiro no SQL Editor do Supabase (ou `supabase db push`).
-- É idempotente o suficiente para ser executado novamente em desenvolvimento.
--
-- Regras de negócio codificadas aqui:
--   * Moedas: 1 moeda por R$1 quitado (prenda = 10 moedas), teto de 500/semana.
--   * Prazo: dívida vence 48h após nascer (despesa criada / vencedor declarado).
--   * Limpeza: cada 24h de atraso além das 48h tira 20 pontos (100 → 0).
--   * Comprovantes: expiram em 90 dias e são apagados por pg_cron.
-- =============================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- -----------------------------------------------------------------------------
-- 1. TABELAS
-- -----------------------------------------------------------------------------

create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  nickname      text not null unique
                check (nickname ~ '^[a-z0-9_]{3,20}$'),
  full_name     text not null check (char_length(full_name) between 1 and 80),
  pix_key       text check (pix_key is null or char_length(pix_key) <= 77),
  whatsapp      text check (whatsapp is null or whatsapp ~ '^[0-9]{10,15}$'),
  avatar_config jsonb not null default '{
    "skin":"#f1c27d","hair":"short","hairColor":"#3b2a1a",
    "shirt":"tshirt","shirtColor":"#4a7bd1",
    "pants":"jeans","pantsColor":"#2f3e66","hat":"none"
  }'::jsonb,
  hotel_coins   integer not null default 0 check (hotel_coins >= 0),
  created_at    timestamptz not null default now()
);

create table if not exists public.rooms (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null unique references public.profiles (id) on delete cascade,
  room_type         text not null default 'kitnet',          -- Kitnet = grade 6x6
  cleanliness_score integer not null default 100 check (cleanliness_score between 0 and 100),
  inventory_json    jsonb not null default '{"furniture":[],"wardrobe":[]}'::jsonb,
  created_at        timestamptz not null default now()
);

create table if not exists public.shop_items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  category    text not null check (category in ('furniture', 'clothing')),
  price_coins integer not null check (price_coins > 0),
  asset_url   text not null unique  -- chave do sprite SVG no front (ex: 'sofa', 'jacket')
);

create table if not exists public.bets_expenses (
  id               uuid primary key default gen_random_uuid(),
  creator_id       uuid not null references public.profiles (id) on delete cascade,
  title            text not null check (char_length(title) between 1 and 120),
  description      text check (description is null or char_length(description) <= 1000),
  amount           numeric(12,2) check (amount is null or amount > 0),  -- null = prenda
  prize_text       text check (prize_text is null or char_length(prize_text) <= 200),
  type             text not null check (type in ('bet', 'expense')),
  status           text not null default 'pending'
                   check (status in ('pending', 'awaiting_approval', 'settled')),
  witness_id       uuid references public.profiles (id) on delete set null,
  winner_id        uuid references public.profiles (id) on delete set null,
  proof_image_url  text,          -- último comprovante enviado (caminho no Storage)
  proof_expires_at timestamptz,
  created_at       timestamptz not null default now(),
  check (amount is not null or prize_text is not null)
);

-- Quem deve quanto a quem (aprovado como extensão do schema original)
create table if not exists public.bet_participants (
  id               uuid primary key default gen_random_uuid(),
  bet_id           uuid not null references public.bets_expenses (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  role             text not null default 'participant' check (role in ('participant', 'creditor')),
  share_amount     numeric(12,2) check (share_amount is null or share_amount > 0),
  paid_status      text not null default 'not_due'
                   check (paid_status in ('not_due', 'unpaid', 'marked_paid', 'confirmed')),
  creditor_id      uuid references public.profiles (id) on delete set null,
  debt_since       timestamptz,
  marked_paid_at   timestamptz,
  confirmed_at     timestamptz,
  coins_awarded    integer not null default 0,
  proof_image_url  text,
  proof_expires_at timestamptz,
  created_at       timestamptz not null default now(),
  unique (bet_id, user_id)
);

create index if not exists bet_participants_user_idx     on public.bet_participants (user_id, paid_status);
create index if not exists bet_participants_creditor_idx on public.bet_participants (creditor_id, paid_status);
create index if not exists bet_participants_proof_idx    on public.bet_participants (proof_expires_at) where proof_image_url is not null;

create table if not exists public.chat_messages (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  message       text not null check (char_length(message) between 1 and 500),
  mentions_json jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists chat_messages_created_idx on public.chat_messages (created_at desc);

-- Feed de avisos automáticos do Lobby (escrito apenas pelas funções do banco)
create table if not exists public.lobby_events (
  id         bigint generated always as identity primary key,
  kind       text not null,
  message    text not null,
  actor_id   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists lobby_events_created_idx on public.lobby_events (created_at desc);

-- -----------------------------------------------------------------------------
-- 2. PRIVILÉGIOS DE COLUNA (protege Pix/WhatsApp e moedas)
-- -----------------------------------------------------------------------------

revoke all on public.profiles from anon, authenticated;
grant select (id, nickname, full_name, avatar_config, hotel_coins, created_at)
  on public.profiles to authenticated;
grant update (nickname, full_name, pix_key, whatsapp, avatar_config)
  on public.profiles to authenticated;

revoke insert, update, delete on public.rooms, public.shop_items, public.bets_expenses,
  public.bet_participants, public.lobby_events from anon, authenticated;
revoke all on public.chat_messages from anon;

-- -----------------------------------------------------------------------------
-- 3. RLS
-- -----------------------------------------------------------------------------

alter table public.profiles         enable row level security;
alter table public.rooms            enable row level security;
alter table public.shop_items       enable row level security;
alter table public.bets_expenses    enable row level security;
alter table public.bet_participants enable row level security;
alter table public.chat_messages    enable row level security;
alter table public.lobby_events     enable row level security;

-- Helper sem recursão de RLS
create or replace function public.is_bet_member(p_bet uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bets_expenses b
    where b.id = p_bet
      and (b.creator_id = auth.uid() or b.witness_id = auth.uid()
           or exists (select 1 from bet_participants bp where bp.bet_id = b.id and bp.user_id = auth.uid()))
  );
$$;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated using (true);
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists rooms_select on public.rooms;
create policy rooms_select on public.rooms for select to authenticated using (true);

drop policy if exists shop_select on public.shop_items;
create policy shop_select on public.shop_items for select to authenticated using (true);

drop policy if exists bets_select_members on public.bets_expenses;
create policy bets_select_members on public.bets_expenses for select to authenticated
  using (public.is_bet_member(id));

drop policy if exists participants_select_members on public.bet_participants;
create policy participants_select_members on public.bet_participants for select to authenticated
  using (public.is_bet_member(bet_id));

drop policy if exists chat_select on public.chat_messages;
create policy chat_select on public.chat_messages for select to authenticated using (true);
drop policy if exists chat_insert_own on public.chat_messages;
create policy chat_insert_own on public.chat_messages for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists lobby_select on public.lobby_events;
create policy lobby_select on public.lobby_events for select to authenticated using (true);

-- -----------------------------------------------------------------------------
-- 4. TRIGGERS
-- -----------------------------------------------------------------------------

-- Cadastro: cria perfil + quarto Kitnet com saldo zero
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into profiles (id, nickname, full_name, pix_key, whatsapp)
  values (
    new.id,
    lower(coalesce(nullif(v_meta->>'nickname', ''), 'hospede_' || substr(new.id::text, 1, 8))),
    coalesce(nullif(v_meta->>'full_name', ''), 'Hóspede'),
    nullif(v_meta->>'pix_key', ''),
    nullif(regexp_replace(coalesce(v_meta->>'whatsapp', ''), '\D', '', 'g'), '')
  );
  insert into rooms (user_id, room_type) values (new.id, 'kitnet');
  insert into lobby_events (kind, message, actor_id)
  values ('checkin', '🛎️ @' || lower(coalesce(nullif(v_meta->>'nickname', ''), 'hospede_' || substr(new.id::text, 1, 8)))
          || ' fez check-in no hotel!', new.id);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Normaliza nickname/whatsapp e impede uso de roupa premium não comprada
create or replace function public.profiles_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_wardrobe jsonb;
  v_value text;
  v_item uuid;
begin
  new.nickname := lower(new.nickname);
  if new.whatsapp is not null then
    new.whatsapp := nullif(regexp_replace(new.whatsapp, '\D', '', 'g'), '');
  end if;

  if new.avatar_config is distinct from old.avatar_config then
    select inventory_json->'wardrobe' into v_wardrobe from rooms where user_id = new.id;
    for v_value in select value from jsonb_each_text(new.avatar_config) loop
      select id into v_item from shop_items where category = 'clothing' and asset_url = v_value;
      if v_item is not null and not coalesce(v_wardrobe ? v_item::text, false) then
        raise exception 'Você ainda não comprou este item premium: %', v_value;
      end if;
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists profiles_before_update on public.profiles;
create trigger profiles_before_update before update on public.profiles
  for each row execute function public.profiles_before_update();

-- Chat: extrai menções @nick válidas
create or replace function public.chat_extract_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'nickname', p.nickname)), '[]'::jsonb)
    into new.mentions_json
  from profiles p
  where p.nickname in (
    select distinct lower(m[1]) from regexp_matches(new.message, '@([A-Za-z0-9_]{3,20})', 'g') as m
  );
  return new;
end $$;

drop trigger if exists chat_extract_mentions on public.chat_messages;
create trigger chat_extract_mentions before insert on public.chat_messages
  for each row execute function public.chat_extract_mentions();

-- -----------------------------------------------------------------------------
-- 5. FUNÇÕES DE NEGÓCIO (RPC)
-- -----------------------------------------------------------------------------

create or replace function public.nickname_available(p_nick text)
returns boolean language sql stable security definer set search_path = public as $$
  select lower(p_nick) ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from profiles where nickname = lower(p_nick));
$$;

create or replace function public.get_my_profile()
returns setof public.profiles language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid();
$$;

-- Pix e WhatsApp só para quem divide pelo menos uma aposta/despesa
create or replace function public.get_contact_info(p_user uuid)
returns table (full_name text, nickname text, pix_key text, whatsapp text)
language sql stable security definer set search_path = public as $$
  select p.full_name, p.nickname, p.pix_key, p.whatsapp
  from profiles p
  where p.id = p_user
    and (p_user = auth.uid() or exists (
      select 1 from bet_participants a
      join bet_participants b on a.bet_id = b.bet_id
      where a.user_id = auth.uid() and b.user_id = p_user
    ));
$$;

-- Recalcula o Índice de Limpeza (um usuário ou todos) e publica avisos
create or replace function public.refresh_cleanliness(p_user uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_new integer;
  v_nick text;
begin
  for r in
    select ro.user_id, ro.cleanliness_score as old_score,
           coalesce(max(extract(epoch from (now() - bp.debt_since - interval '48 hours')) / 3600.0)
                    filter (where bp.paid_status = 'unpaid'
                              and bp.debt_since < now() - interval '48 hours'), 0) as overdue_hours
    from rooms ro
    left join bet_participants bp on bp.user_id = ro.user_id
    where p_user is null or ro.user_id = p_user
    group by ro.user_id, ro.cleanliness_score
  loop
    v_new := case when r.overdue_hours <= 0 then 100
                  else greatest(0, 100 - ceil(r.overdue_hours / 24.0)::int * 20) end;

    if v_new <> r.old_score then
      update rooms set cleanliness_score = v_new where user_id = r.user_id;
      select nickname into v_nick from profiles where id = r.user_id;
      if r.old_score = 100 and v_new < 100 then
        insert into lobby_events (kind, message, actor_id)
        values ('dirty', '🕷️ O quarto de @' || v_nick || ' acumulou teias de aranha por inadimplência!', r.user_id);
      elsif v_new = 100 then
        insert into lobby_events (kind, message, actor_id)
        values ('clean', '🧹 O quarto de @' || v_nick || ' está limpinho de novo!', r.user_id);
      end if;
    end if;
  end loop;
end $$;

-- Cria aposta (1v1/grupo) ou divisão de despesa de forma atômica
-- p_participants: [{"user_id": "...", "share_amount": 30.00}]
create or replace function public.create_bet_expense(
  p_type text,
  p_title text,
  p_description text,
  p_amount numeric,
  p_prize_text text,
  p_witness_id uuid,
  p_participants jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bet uuid;
  v_p jsonb;
  v_user uuid;
  v_share numeric;
  v_count integer := 0;
  v_total numeric := 0;
  v_nick text;
  v_others text := '';
begin
  if v_uid is null then raise exception 'Faça login primeiro.'; end if;
  if p_type not in ('bet', 'expense') then raise exception 'Tipo inválido.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Dê um título.'; end if;
  if p_amount is null and coalesce(trim(p_prize_text), '') = '' then
    raise exception 'Informe um valor em R$ ou uma prenda.';
  end if;
  if p_type = 'expense' and p_amount is null then
    raise exception 'Divisão de despesa precisa de valor em R$.';
  end if;

  insert into bets_expenses (creator_id, title, description, amount, prize_text, type, witness_id)
  values (v_uid, trim(p_title), nullif(trim(p_description), ''), p_amount,
          nullif(trim(p_prize_text), ''), p_type, p_witness_id)
  returning id into v_bet;

  if p_type = 'expense' then
    insert into bet_participants (bet_id, user_id, role, paid_status)
    values (v_bet, v_uid, 'creditor', 'not_due');
  else
    insert into bet_participants (bet_id, user_id, role, share_amount, paid_status)
    values (v_bet, v_uid, 'participant', p_amount, 'not_due');
  end if;

  for v_p in select * from jsonb_array_elements(coalesce(p_participants, '[]'::jsonb)) loop
    v_user := (v_p->>'user_id')::uuid;
    continue when v_user = v_uid;

    if p_type = 'expense' then
      v_share := nullif(v_p->>'share_amount', '')::numeric;
      if v_share is null or v_share <= 0 then raise exception 'Cada participante precisa de uma cota.'; end if;
      v_total := v_total + v_share;
      insert into bet_participants (bet_id, user_id, role, share_amount, paid_status, creditor_id, debt_since)
      values (v_bet, v_user, 'participant', v_share, 'unpaid', v_uid, now());
    else
      insert into bet_participants (bet_id, user_id, role, share_amount, paid_status)
      values (v_bet, v_user, 'participant', p_amount, 'not_due');
    end if;

    select nickname into v_nick from profiles where id = v_user;
    v_others := v_others || case when v_count = 0 then '' else ', ' end || '@' || v_nick;
    v_count := v_count + 1;
  end loop;

  if v_count = 0 then raise exception 'Adicione pelo menos mais um hóspede.'; end if;
  if p_type = 'expense' and v_total > p_amount + 0.01 then
    raise exception 'A soma das cotas passa do valor total.';
  end if;
  if p_witness_id is not null and exists (
    select 1 from bet_participants where bet_id = v_bet and user_id = p_witness_id
  ) then
    raise exception 'A testemunha não pode participar da aposta.';
  end if;

  select nickname into v_nick from profiles where id = v_uid;
  insert into lobby_events (kind, message, actor_id)
  values (p_type,
          case when p_type = 'bet' then '🎲 @' || v_nick || ' abriu uma aposta com ' || v_others || '!'
               else '🧾 @' || v_nick || ' dividiu uma conta com ' || v_others || '.' end,
          v_uid);
  return v_bet;
end $$;

-- Declara vencedor. Com testemunha: só ela declara. Sem testemunha: o criador.
create or replace function public.declare_winner(p_bet uuid, p_winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_bet bets_expenses%rowtype;
  v_nick text;
begin
  select * into v_bet from bets_expenses where id = p_bet for update;
  if not found or v_bet.type <> 'bet' then raise exception 'Aposta não encontrada.'; end if;
  if v_bet.winner_id is not null then raise exception 'O vencedor já foi declarado.'; end if;
  if (v_bet.witness_id is not null and auth.uid() <> v_bet.witness_id)
     or (v_bet.witness_id is null and auth.uid() <> v_bet.creator_id) then
    raise exception 'Só % pode declarar o vencedor.',
      case when v_bet.witness_id is not null then 'a testemunha' else 'quem criou a aposta' end;
  end if;
  if not exists (select 1 from bet_participants where bet_id = p_bet and user_id = p_winner) then
    raise exception 'O vencedor precisa ser participante.';
  end if;

  update bets_expenses set winner_id = p_winner where id = p_bet;
  update bet_participants
     set paid_status = 'unpaid', creditor_id = p_winner, debt_since = now()
   where bet_id = p_bet and user_id <> p_winner;

  select nickname into v_nick from profiles where id = p_winner;
  insert into lobby_events (kind, message, actor_id)
  values ('winner', '🏆 @' || v_nick || ' venceu uma aposta! Os perdedores têm 48h para pagar.', p_winner);
end $$;

-- Devedor marca como pago (comprovante opcional, expira em 90 dias)
create or replace function public.mark_paid(p_participant uuid, p_proof_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row bet_participants%rowtype;
begin
  select * into v_row from bet_participants where id = p_participant for update;
  if not found or v_row.user_id <> auth.uid() then raise exception 'Dívida não encontrada.'; end if;
  if v_row.paid_status <> 'unpaid' then raise exception 'Essa dívida não está em aberto.'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then
    raise exception 'Comprovante inválido.';
  end if;

  update bet_participants
     set paid_status = 'marked_paid', marked_paid_at = now(),
         proof_image_url = p_proof_path,
         proof_expires_at = case when p_proof_path is null then null else now() + interval '90 days' end
   where id = p_participant;

  update bets_expenses
     set status = 'awaiting_approval',
         proof_image_url = coalesce(p_proof_path, proof_image_url),
         proof_expires_at = case when p_proof_path is null then proof_expires_at else now() + interval '90 days' end
   where id = v_row.bet_id;
end $$;

-- Credor recusa (não recebeu): volta para "em aberto"
create or replace function public.reject_payment(p_participant uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_row bet_participants%rowtype;
begin
  select * into v_row from bet_participants where id = p_participant for update;
  if not found or v_row.creditor_id <> auth.uid() then raise exception 'Dívida não encontrada.'; end if;
  if v_row.paid_status <> 'marked_paid' then raise exception 'Nada para recusar.'; end if;

  update bet_participants set paid_status = 'unpaid', marked_paid_at = null where id = p_participant;
  update bets_expenses b set status = 'pending'
   where b.id = v_row.bet_id
     and not exists (select 1 from bet_participants where bet_id = b.id and paid_status = 'marked_paid');
end $$;

-- Validação dupla: credor confirma → liquida e emite moedas com teto semanal
create or replace function public.confirm_payment(p_participant uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_row bet_participants%rowtype;
  v_week_start timestamptz := date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_earned integer;
  v_base integer;
  v_coins integer;
  v_debtor text;
  v_creditor text;
begin
  select * into v_row from bet_participants where id = p_participant for update;
  if not found or v_row.creditor_id <> auth.uid() then raise exception 'Dívida não encontrada.'; end if;
  if v_row.paid_status <> 'marked_paid' then raise exception 'O devedor ainda não marcou como pago.'; end if;
  if v_row.user_id = v_row.creditor_id then raise exception 'Operação inválida.'; end if;

  select coalesce(sum(coins_awarded), 0) into v_earned
    from bet_participants where user_id = v_row.user_id and confirmed_at >= v_week_start;

  v_base  := case when v_row.share_amount is null then 10 else floor(v_row.share_amount)::int end;
  v_coins := greatest(0, least(v_base, 500 - v_earned));

  update bet_participants
     set paid_status = 'confirmed', confirmed_at = now(), coins_awarded = v_coins
   where id = p_participant;

  update profiles set hotel_coins = hotel_coins + v_coins where id = v_row.user_id;

  update bets_expenses b
     set status = case
           when not exists (select 1 from bet_participants where bet_id = b.id and paid_status in ('unpaid', 'marked_paid'))
             then 'settled'
           when exists (select 1 from bet_participants where bet_id = b.id and paid_status = 'marked_paid')
             then 'awaiting_approval'
           else 'pending' end
   where b.id = v_row.bet_id;

  select nickname into v_debtor from profiles where id = v_row.user_id;
  select nickname into v_creditor from profiles where id = v_row.creditor_id;
  insert into lobby_events (kind, message, actor_id)
  values ('settled', '✅ @' || v_debtor || ' quitou uma dívida com @' || v_creditor
          || case when v_coins > 0 then ' e ganhou ' || v_coins || ' moedas!' else '!' end,
          v_row.user_id);

  perform refresh_cleanliness(v_row.user_id);
  return v_coins;
end $$;

-- Cancela aposta/despesa enquanto nada foi pago
create or replace function public.cancel_bet_expense(p_bet uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from bets_expenses where id = p_bet and creator_id = auth.uid()) then
    raise exception 'Só quem criou pode cancelar.';
  end if;
  if exists (select 1 from bet_participants where bet_id = p_bet and paid_status in ('marked_paid', 'confirmed')) then
    raise exception 'Já existe pagamento registrado; não dá para cancelar.';
  end if;
  delete from bets_expenses where id = p_bet;
  perform refresh_cleanliness(null);
end $$;

-- Loja
create or replace function public.buy_item(p_item uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_item shop_items%rowtype;
  v_coins integer;
  v_inv jsonb;
  v_nick text;
begin
  select * into v_item from shop_items where id = p_item;
  if not found then raise exception 'Item não encontrado.'; end if;

  select hotel_coins, nickname into v_coins, v_nick from profiles where id = v_uid for update;
  if v_coins < v_item.price_coins then raise exception 'Moedas insuficientes.'; end if;

  select inventory_json into v_inv from rooms where user_id = v_uid for update;
  if v_item.category = 'clothing' then
    if coalesce(v_inv->'wardrobe', '[]'::jsonb) ? v_item.id::text then
      raise exception 'Você já tem esta roupa.';
    end if;
    v_inv := jsonb_set(v_inv, '{wardrobe}', coalesce(v_inv->'wardrobe', '[]'::jsonb) || to_jsonb(v_item.id::text));
  else
    v_inv := jsonb_set(v_inv, '{furniture}', coalesce(v_inv->'furniture', '[]'::jsonb)
             || jsonb_build_object('uid', gen_random_uuid()::text, 'item_id', v_item.id, 'x', null, 'y', null));
  end if;

  update rooms set inventory_json = v_inv where user_id = v_uid;
  update profiles set hotel_coins = hotel_coins - v_item.price_coins where id = v_uid;

  insert into lobby_events (kind, message, actor_id)
  values ('purchase', '🛍️ @' || v_nick || ' comprou ' || v_item.name || ' na loja!', v_uid);
end $$;

-- Move móvel no grid (p_x/p_y nulos = guardar no inventário)
create or replace function public.move_furniture(p_uid text, p_x integer, p_y integer)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_inv jsonb;
  v_size integer;
  v_type text;
begin
  select inventory_json, room_type into v_inv, v_type from rooms where user_id = auth.uid() for update;
  v_size := case v_type when 'kitnet' then 6 else 6 end;

  if not exists (select 1 from jsonb_array_elements(v_inv->'furniture') e where e->>'uid' = p_uid) then
    raise exception 'Móvel não encontrado.';
  end if;
  if p_x is not null then
    if p_x < 0 or p_y < 0 or p_x >= v_size or p_y >= v_size then raise exception 'Fora do quarto.'; end if;
    if exists (select 1 from jsonb_array_elements(v_inv->'furniture') e
               where e->>'uid' <> p_uid and (e->>'x')::int = p_x and (e->>'y')::int = p_y) then
      raise exception 'Esse piso já está ocupado.';
    end if;
  end if;

  select jsonb_set(v_inv, '{furniture}', coalesce(jsonb_agg(
           case when e->>'uid' = p_uid then e || jsonb_build_object('x', p_x, 'y', p_y) else e end), '[]'::jsonb))
    into v_inv
  from jsonb_array_elements(v_inv->'furniture') e;

  update rooms set inventory_json = v_inv where user_id = auth.uid();
end $$;

-- Dashboard do Apostador (público, agregado)
create or replace function public.get_user_stats(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_total_bets integer;
  v_wins integer;
  v_decided integer;
  v_volume numeric;
  v_overdue integer;
  v_open integer;
  v_history jsonb;
  v_score integer;
begin
  select count(*) filter (where b.type = 'bet'),
         count(*) filter (where b.type = 'bet' and b.winner_id = p_user),
         count(*) filter (where b.type = 'bet' and b.winner_id is not null)
    into v_total_bets, v_wins, v_decided
  from bets_expenses b join bet_participants bp on bp.bet_id = b.id and bp.user_id = p_user;

  select coalesce(sum(share_amount), 0) into v_volume
    from bet_participants where paid_status = 'confirmed' and (user_id = p_user or creditor_id = p_user);

  select count(*) filter (where paid_status = 'unpaid' and debt_since < now() - interval '48 hours'),
         count(*) filter (where paid_status in ('unpaid', 'marked_paid'))
    into v_overdue, v_open
  from bet_participants where user_id = p_user;

  select coalesce(jsonb_agg(h order by h.confirmed_at desc), '[]'::jsonb) into v_history
  from (
    select bp.confirmed_at,
           case when bp.user_id = p_user then 'paid' else 'received' end as direction,
           bp.share_amount as amount,
           b.prize_text,
           b.type,
           (select nickname from profiles where id = case when bp.user_id = p_user then bp.creditor_id else bp.user_id end) as counterpart
    from bet_participants bp join bets_expenses b on b.id = bp.bet_id
    where bp.paid_status = 'confirmed' and (bp.user_id = p_user or bp.creditor_id = p_user)
    order by bp.confirmed_at desc
    limit 10
  ) h;

  select cleanliness_score into v_score from rooms where user_id = p_user;

  return jsonb_build_object(
    'total_bets', v_total_bets,
    'wins', v_wins,
    'decided_bets', v_decided,
    'win_rate', case when v_decided = 0 then 0 else round(v_wins * 100.0 / v_decided, 1) end,
    'volume', v_volume,
    'overdue_count', v_overdue,
    'open_debts', v_open,
    'is_compliant', v_overdue = 0,
    'cleanliness_score', coalesce(v_score, 100),
    'history', v_history
  );
end $$;

-- -----------------------------------------------------------------------------
-- 6. PERMISSÕES DE EXECUÇÃO
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.nickname_available(text) to anon;

-- -----------------------------------------------------------------------------
-- 7. STORAGE — bucket privado de comprovantes (4 MB, só imagens)
-- -----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proofs', 'proofs', false, 4194304,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = false;

create or replace function public.can_view_proof(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from bet_participants bp
    where bp.proof_image_url = p_path and public.is_bet_member(bp.bet_id)
  );
$$;
grant execute on function public.can_view_proof(text) to authenticated;

drop policy if exists proofs_insert_own_folder on storage.objects;
create policy proofs_insert_own_folder on storage.objects for insert to authenticated
  with check (bucket_id = 'proofs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists proofs_select_involved on storage.objects;
create policy proofs_select_involved on storage.objects for select to authenticated
  using (bucket_id = 'proofs'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.can_view_proof(name)));

-- -----------------------------------------------------------------------------
-- 8. REALTIME
-- -----------------------------------------------------------------------------

do $$
begin
  begin alter publication supabase_realtime add table public.chat_messages;
  exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.lobby_events;
  exception when duplicate_object then null; end;
end $$;

-- -----------------------------------------------------------------------------
-- 9. pg_cron — limpeza dos comprovantes (90 dias) e índice de limpeza (1h)
-- Requer dois segredos no Vault (veja README):
--   select vault.create_secret('https://SEU-PROJETO.supabase.co', 'project_url');
--   select vault.create_secret('SUA_SERVICE_ROLE_KEY', 'service_role_key');
-- A exclusão usa a API do Storage (o Supabase bloqueia DELETE direto em storage.objects).
-- -----------------------------------------------------------------------------

create or replace function public.purge_expired_proofs()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text;
  v_key text;
  r record;
  v_count integer := 0;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise warning 'purge_expired_proofs: segredos project_url/service_role_key ausentes no Vault';
    return 0;
  end if;

  for r in
    select id, proof_image_url from bet_participants
    where proof_image_url is not null and proof_expires_at < now()
  loop
    perform net.http_delete(
      url := v_url || '/storage/v1/object/proofs/' || r.proof_image_url,
      headers := jsonb_build_object('apikey', v_key, 'Authorization', 'Bearer ' || v_key)
    );
    update bet_participants set proof_image_url = null, proof_expires_at = null where id = r.id;
    v_count := v_count + 1;
  end loop;

  update bets_expenses set proof_image_url = null, proof_expires_at = null
   where proof_expires_at < now();
  return v_count;
end $$;
revoke execute on function public.purge_expired_proofs() from authenticated;

select cron.schedule('bethotel-purge-proofs', '15 6 * * *', $$select public.purge_expired_proofs();$$);
select cron.schedule('bethotel-cleanliness', '5 * * * *', $$select public.refresh_cleanliness(null);$$);

-- -----------------------------------------------------------------------------
-- 10. SEED da Loja (asset_url = chave do sprite SVG no front-end)
-- -----------------------------------------------------------------------------

insert into public.shop_items (name, category, price_coins, asset_url) values
  ('Tapete Xadrez',     'furniture',  30, 'rug'),
  ('Planta de Vaso',    'furniture',  40, 'plant'),
  ('Luminária de Pé',   'furniture',  50, 'lamp'),
  ('Poltrona',          'furniture',  60, 'armchair'),
  ('Mesa de Centro',    'furniture',  80, 'table'),
  ('Sofá Clássico',     'furniture', 120, 'sofa'),
  ('TV de Tubo',        'furniture', 150, 'tv'),
  ('Fliperama',         'furniture', 250, 'arcade'),
  ('Boné',              'clothing',   40, 'cap'),
  ('Moletom',           'clothing',   80, 'hoodie'),
  ('Jaqueta',           'clothing',  100, 'jacket'),
  ('Coroa do Hotel',    'clothing',  400, 'crown')
on conflict (asset_url) do update
  set name = excluded.name, category = excluded.category, price_coins = excluded.price_coins;

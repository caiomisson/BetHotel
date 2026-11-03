-- =============================================================================
-- BetHotel — Migração 0004: Apostas com aceite, Eventos (estilo Splitwise),
-- Conquistas que viram itens do quarto e itens de parede / em cima de mesas.
-- Rode DEPOIS da 0001, 0002 e 0003, no SQL Editor do Supabase. Pode rodar de novo.
--
-- Regras:
--   * Aposta: criada como "Aguardando aceite"; fica "Ativa" quando 100% aceitam.
--     Quem recusa sai da aposta; se sobrar só o criador, ela é cancelada.
--     O criador define vencedor(es) ou empate. Cancelar exige concordância de todos
--     (antes do aceite, o criador pode retirar sozinho).
--     Vários vencedores: cada perdedor paga o valor apostado, dividido igual entre
--     os vencedores. Só valores em R$.
--   * Evento: nome obrigatório; tipo detectado pelo nome (viagem, churrasco, festa,
--     réveillon, carnaval). Convidados aceitam para entrar nas contas. Membros
--     lançam sub-despesas e marcam quem participou (divisão igual). O criador
--     encerra o evento e o sistema gera as cobranças (mínimo de transferências).
--   * Todas as cobranças (apostas e eventos) ficam na tabela debts, com a mesma
--     validação dupla, +10 moedas (teto 100/semana) e prazo de 48h.
--   * Conquistas creditam itens no inventário do quarto automaticamente.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. EVENTOS
-- -----------------------------------------------------------------------------

create table if not exists public.events (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(trim(name)) between 1 and 120),
  kind       text not null default 'outro'
             check (kind in ('viagem', 'churrasco', 'festa', 'reveillon', 'carnaval', 'outro')),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  status     text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at  timestamptz
);

create table if not exists public.event_members (
  event_id     uuid not null references public.events (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  status       text not null default 'invited' check (status in ('invited', 'accepted', 'declined')),
  invited_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (event_id, user_id)
);

create table if not exists public.event_expenses (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  payer_id    uuid not null references public.profiles (id) on delete cascade,
  amount      numeric(12,2) not null check (amount > 0),
  description text check (description is null or char_length(description) <= 200),
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);
create index if not exists event_expenses_event_idx on public.event_expenses (event_id);

create table if not exists public.event_expense_splits (
  expense_id   uuid not null references public.event_expenses (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  share_amount numeric(12,2) not null check (share_amount >= 0),
  primary key (expense_id, user_id)
);

-- Tipo do evento detectado pelo nome (sem acento, minúsculo)
create or replace function public.detect_event_kind(p_name text)
returns text language sql immutable as $$
  select case
    when s ~ '(reveillon|ano novo|virada)' then 'reveillon'
    when s ~ '(carnaval|bloquinho)' then 'carnaval'
    when s ~ '(churras|bbq)' then 'churrasco'
    when s ~ '(festa|balada|aniver|niver|\mrole\M)' then 'festa'
    when s ~ '(viagem|trip|ferias|praia|excursao|mochilao)' then 'viagem'
    else 'outro' end
  from (select lower(translate(coalesce(p_name, ''),
          'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇç',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCc')) as s) n;
$$;

-- -----------------------------------------------------------------------------
-- 2. COBRANÇAS UNIFICADAS (apostas + eventos)
-- -----------------------------------------------------------------------------

create table if not exists public.debts (
  id                    uuid primary key default gen_random_uuid(),
  bet_id                uuid references public.bets_expenses (id) on delete cascade,
  event_id              uuid references public.events (id) on delete cascade,
  title                 text not null,
  debtor_id             uuid not null references public.profiles (id) on delete cascade,
  creditor_id           uuid not null references public.profiles (id) on delete cascade,
  amount                numeric(12,2) check (amount is null or amount > 0),  -- null só em prendas antigas
  paid_status           text not null default 'unpaid' check (paid_status in ('unpaid', 'marked_paid', 'confirmed')),
  debt_since            timestamptz not null default now(),
  marked_paid_at        timestamptz,
  confirmed_at          timestamptz,
  coins_awarded         integer not null default 0,
  proof_image_url       text,
  proof_expires_at      timestamptz,
  legacy_participant_id uuid unique,
  created_at            timestamptz not null default now(),
  check ((bet_id is null) <> (event_id is null)),
  check (debtor_id <> creditor_id)
);
create index if not exists debts_debtor_idx   on public.debts (debtor_id, paid_status);
create index if not exists debts_creditor_idx on public.debts (creditor_id, paid_status);
create index if not exists debts_proof_idx    on public.debts (proof_expires_at) where proof_image_url is not null;

-- -----------------------------------------------------------------------------
-- 3. APOSTAS: aceite, resultado, cancelamento
-- -----------------------------------------------------------------------------

alter table public.bets_expenses add column if not exists ends_at timestamptz;
alter table public.bets_expenses add column if not exists resolved_at timestamptz;
alter table public.bets_expenses drop constraint if exists bets_expenses_status_check;
alter table public.bets_expenses add constraint bets_expenses_status_check check (status in
  ('awaiting_acceptance', 'active', 'pending', 'awaiting_approval', 'settled', 'draw', 'cancelled'));

alter table public.bet_participants add column if not exists invite_status text not null default 'accepted';
alter table public.bet_participants drop constraint if exists bet_participants_invite_status_check;
alter table public.bet_participants add constraint bet_participants_invite_status_check check (invite_status in ('pending', 'accepted'));
alter table public.bet_participants add column if not exists result text;
alter table public.bet_participants drop constraint if exists bet_participants_result_check;
alter table public.bet_participants add constraint bet_participants_result_check check (result is null or result in ('win', 'loss'));
alter table public.bet_participants add column if not exists cancel_vote boolean not null default false;

-- -----------------------------------------------------------------------------
-- 4. MIGRAÇÃO DOS DADOS ATUAIS
-- -----------------------------------------------------------------------------

-- 4a. Despesas antigas (racha/viagem) viram Eventos encerrados, com a mesma id
insert into public.events (id, name, kind, creator_id, status, created_at, closed_at)
select b.id, b.title, public.detect_event_kind(b.title), b.creator_id, 'closed', b.created_at, b.created_at
from public.bets_expenses b where b.type = 'expense'
on conflict (id) do nothing;

insert into public.event_members (event_id, user_id, status, responded_at)
select bp.bet_id, bp.user_id, 'accepted', bp.created_at
from public.bet_participants bp join public.bets_expenses b on b.id = bp.bet_id
where b.type = 'expense'
on conflict do nothing;

insert into public.event_expenses (event_id, payer_id, amount, description, created_by, created_at)
select b.id, b.creator_id, b.amount, b.description, b.creator_id, b.created_at
from public.bets_expenses b
where b.type = 'expense' and b.amount is not null
  and not exists (select 1 from public.event_expenses e where e.event_id = b.id);

insert into public.event_expense_splits (expense_id, user_id, share_amount)
select e.id, bp.user_id, bp.share_amount
from public.event_expenses e
join public.bet_participants bp on bp.bet_id = e.event_id and bp.role = 'participant' and bp.share_amount is not null
on conflict do nothing;

-- parte de quem pagou (o que sobrou do total)
insert into public.event_expense_splits (expense_id, user_id, share_amount)
select e.id, e.payer_id, e.amount - s.total
from public.event_expenses e
join (select expense_id, sum(share_amount) as total from public.event_expense_splits group by expense_id) s on s.expense_id = e.id
where e.amount - s.total > 0.004
on conflict do nothing;

-- 4b. Cobranças antigas → debts
insert into public.debts (bet_id, event_id, title, debtor_id, creditor_id, amount, paid_status, debt_since,
                          marked_paid_at, confirmed_at, coins_awarded, proof_image_url, proof_expires_at,
                          legacy_participant_id, created_at)
select case when b.type = 'bet' then b.id end,
       case when b.type = 'expense' then b.id end,
       b.title, bp.user_id, bp.creditor_id, bp.share_amount, bp.paid_status,
       coalesce(bp.debt_since, bp.created_at), bp.marked_paid_at, bp.confirmed_at, bp.coins_awarded,
       bp.proof_image_url, bp.proof_expires_at, bp.id, bp.created_at
from public.bet_participants bp
join public.bets_expenses b on b.id = bp.bet_id
where bp.paid_status in ('unpaid', 'marked_paid', 'confirmed')
  and bp.creditor_id is not null and bp.creditor_id <> bp.user_id
on conflict (legacy_participant_id) do nothing;

-- 4c. Resultado das apostas antigas
update public.bet_participants bp
   set result = case when b.winner_id = bp.user_id then 'win' else 'loss' end
  from public.bets_expenses b
 where b.id = bp.bet_id and b.type = 'bet' and b.winner_id is not null and bp.result is null;

update public.bets_expenses set status = 'active'
 where type = 'bet' and winner_id is null and status = 'pending';

-- 4d. Remove as despesas antigas (já estão nos Eventos)
delete from public.bets_expenses where type = 'expense';

-- -----------------------------------------------------------------------------
-- 5. RLS DAS TABELAS NOVAS
-- -----------------------------------------------------------------------------

revoke insert, update, delete on public.events, public.event_members, public.event_expenses,
  public.event_expense_splits, public.debts from anon, authenticated;
grant select on public.events, public.event_members, public.event_expenses,
  public.event_expense_splits, public.debts to authenticated;

alter table public.events               enable row level security;
alter table public.event_members        enable row level security;
alter table public.event_expenses       enable row level security;
alter table public.event_expense_splits enable row level security;
alter table public.debts                enable row level security;

create or replace function public.is_event_member(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.id = p_event and e.creator_id = auth.uid())
      or exists (select 1 from event_members m where m.event_id = p_event and m.user_id = auth.uid() and m.status <> 'declined');
$$;

drop policy if exists events_select on public.events;
create policy events_select on public.events for select to authenticated using (public.is_event_member(id));
drop policy if exists event_members_select on public.event_members;
create policy event_members_select on public.event_members for select to authenticated using (public.is_event_member(event_id));
drop policy if exists event_expenses_select on public.event_expenses;
create policy event_expenses_select on public.event_expenses for select to authenticated using (public.is_event_member(event_id));
drop policy if exists event_splits_select on public.event_expense_splits;
create policy event_splits_select on public.event_expense_splits for select to authenticated
  using (exists (select 1 from event_expenses e where e.id = expense_id and public.is_event_member(e.event_id)));
drop policy if exists debts_select on public.debts;
create policy debts_select on public.debts for select to authenticated using (
  debtor_id = auth.uid() or creditor_id = auth.uid()
  or (bet_id is not null and public.is_bet_member(bet_id))
  or (event_id is not null and public.is_event_member(event_id))
);

-- -----------------------------------------------------------------------------
-- 6. CONQUISTAS
-- -----------------------------------------------------------------------------

alter table public.shop_items add column if not exists surface_z integer;  -- altura do tampo (mesas)
alter table public.shop_items drop constraint if exists shop_items_section_check;
alter table public.shop_items add constraint shop_items_section_check
  check (section in ('reforma', 'basica', 'conforto', 'eletronicos', 'vestuario', 'inicial', 'premio'));
alter table public.shop_items drop constraint if exists shop_items_layer_check;
alter table public.shop_items add constraint shop_items_layer_check check (layer in ('solid', 'floor', 'wall', 'table'));

update public.shop_items set surface_z = 23 where asset_url = 'table';
update public.shop_items set surface_z = 29 where asset_url = 'meeting_table';

insert into public.shop_items (name, category, section, price_coins, asset_url, size_x, size_y, layer, for_sale, sort_order) values
  ('Quadro "Destino: Rio"',                 'furniture', 'premio', 1, 'frame_rio',          1, 1, 'wall',  false, 10),
  ('Quadro "Mochileiro de Elite"',          'furniture', 'premio', 1, 'frame_backpacker',   1, 1, 'wall',  false, 20),
  ('Escultura "Champanhe Dourado"',         'furniture', 'premio', 1, 'champagne_gold',     1, 1, 'solid', false, 30),
  ('Porta-Retrato "Abadá Retrô"',           'furniture', 'premio', 1, 'photo_abada',        1, 1, 'table', false, 40),
  ('Quadro Neon "Curtição"',                'furniture', 'premio', 1, 'neon_curticao',      1, 1, 'wall',  false, 50),
  ('Escultura "Touro de Ouro do Churrasco"','furniture', 'premio', 1, 'bull_bbq',           1, 1, 'solid', false, 60),
  ('Placa "Duelo Vencido"',                 'furniture', 'premio', 1, 'plaque_duel',        1, 1, 'wall',  false, 70),
  ('Cadeira de Balanço de Ouro',            'furniture', 'premio', 1, 'rocking_chair_gold', 1, 1, 'solid', false, 80),
  ('Tapete "Bem-Vindo à Zebra"',            'furniture', 'premio', 1, 'rug_zebra',          1, 1, 'floor', false, 90),
  ('Luminária de Mesa "Mini Cifrão"',       'furniture', 'premio', 1, 'lamp_cifrao',        1, 1, 'table', false, 100),
  ('Escultura de Mesa "Touro de Wall Street"','furniture','premio', 1, 'bull_wallstreet',   1, 1, 'table', false, 110)
on conflict (asset_url) do update set
  name = excluded.name, category = excluded.category, section = excluded.section, size_x = excluded.size_x,
  size_y = excluded.size_y, layer = excluded.layer, for_sale = false, sort_order = excluded.sort_order;

create table if not exists public.achievements (
  code       text primary key,
  title      text not null,
  rule       text not null,
  item_asset text not null references public.shop_items (asset_url) on update cascade,
  group_name text not null check (group_name in ('evento', 'aposta')),
  sort_order integer not null
);

insert into public.achievements (code, title, rule, item_asset, group_name, sort_order) values
  ('viagem_1',    '1ª Viagem em Grupo',        'Aceite e quite 100% da sua parte numa viagem em grupo.',     'frame_rio',          'evento', 10),
  ('viagem_5',    '5ª Viagem em Grupo',        'Quite 100% da sua parte em 5 viagens em grupo.',             'frame_backpacker',   'evento', 20),
  ('reveillon',   'Réveillon',                 'Quite 100% da sua parte num evento de Réveillon.',           'champagne_gold',     'evento', 30),
  ('carnaval',    'Carnaval',                  'Quite 100% da sua parte num evento de Carnaval.',            'photo_abada',        'evento', 40),
  ('festa',       'Festas Quitadas',           'Quite 100% da sua parte numa festa.',                        'neon_curticao',      'evento', 50),
  ('churrasco_2', '2 Churrascos finalizados',  'Quite 100% da sua parte em 2 churrascos.',                   'bull_bbq',           'evento', 60),
  ('duelo',       '1ª Aposta 1v1 vencida',     'Vença uma aposta 1v1.',                                      'plaque_duel',        'aposta', 70),
  ('clientinho',  'Clientinho Fiel',           'Vença 3 apostas em cima da mesma pessoa.',                   'rocking_chair_gold', 'aposta', 80),
  ('fregues',     'Freguês de Luxo',           'Acumule 5 derrotas.',                                        'rug_zebra',          'aposta', 90),
  ('lucro_50',    'R$ 50 em lucros',           'Receba R$ 50 em apostas vencidas (pagamentos confirmados).', 'lamp_cifrao',        'aposta', 100),
  ('lucro_100',   'R$ 100 em lucros',          'Receba R$ 100 em apostas vencidas (pagamentos confirmados).','bull_wallstreet',    'aposta', 110)
on conflict (code) do update set title = excluded.title, rule = excluded.rule, item_asset = excluded.item_asset,
  group_name = excluded.group_name, sort_order = excluded.sort_order;

create table if not exists public.user_achievements (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  code        text not null references public.achievements (code) on delete cascade,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, code)
);

revoke insert, update, delete on public.achievements, public.user_achievements from anon, authenticated;
grant select on public.achievements, public.user_achievements to authenticated;
alter table public.achievements enable row level security;
alter table public.user_achievements enable row level security;
drop policy if exists achievements_select on public.achievements;
create policy achievements_select on public.achievements for select to authenticated using (true);
drop policy if exists user_achievements_select on public.user_achievements;
create policy user_achievements_select on public.user_achievements for select to authenticated using (true);

-- Progresso de cada conquista
create or replace function public.achievement_progress(p_user uuid)
returns table (code text, current numeric, target numeric)
language sql stable security definer set search_path = public as $$
  with ev as (
    select e.kind
    from events e
    join event_members m on m.event_id = e.id and m.user_id = p_user and m.status = 'accepted'
    where e.status = 'closed'
      and not exists (select 1 from debts d where d.event_id = e.id and d.debtor_id = p_user and d.paid_status <> 'confirmed')
  ),
  st as (
    select
      (select count(*) from ev where kind = 'viagem')    as trips,
      (select count(*) from ev where kind = 'reveillon') as rev,
      (select count(*) from ev where kind = 'carnaval')  as carn,
      (select count(*) from ev where kind = 'festa')     as party,
      (select count(*) from ev where kind = 'churrasco') as bbq,
      (select count(*) from bet_participants bp
        where bp.user_id = p_user and bp.result = 'win'
          and (select count(*) from bet_participants x where x.bet_id = bp.bet_id) = 2) as duels,
      (select coalesce(max(c), 0) from (
         select count(distinct w.bet_id) as c
         from bet_participants w
         join bet_participants l on l.bet_id = w.bet_id and l.result = 'loss'
         where w.user_id = p_user and w.result = 'win'
         group by l.user_id) t) as loyal,
      (select count(*) from bet_participants where user_id = p_user and result = 'loss') as losses,
      (select coalesce(sum(amount), 0) from debts
        where creditor_id = p_user and bet_id is not null and paid_status = 'confirmed') as profit
  )
  select v.code, v.current::numeric, v.target::numeric
  from st, lateral (values
    ('viagem_1', st.trips, 1), ('viagem_5', st.trips, 5), ('reveillon', st.rev, 1), ('carnaval', st.carn, 1),
    ('festa', st.party, 1), ('churrasco_2', st.bbq, 2), ('duelo', st.duels, 1), ('clientinho', st.loyal, 3),
    ('fregues', st.losses, 5), ('lucro_50', st.profit, 50), ('lucro_100', st.profit, 100)
  ) as v(code, current, target);
$$;

create or replace function public.grant_achievement(p_user uuid, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_item shop_items%rowtype;
  v_title text;
  v_nick text;
begin
  insert into user_achievements (user_id, code) values (p_user, p_code) on conflict do nothing;
  if not found then return; end if;

  select s.* into v_item from achievements a join shop_items s on s.asset_url = a.item_asset where a.code = p_code;
  select title into v_title from achievements where code = p_code;

  update rooms set inventory_json = jsonb_set(inventory_json, '{furniture}',
    coalesce(inventory_json->'furniture', '[]'::jsonb)
    || jsonb_build_object('uid', gen_random_uuid()::text, 'item_id', v_item.id, 'x', null, 'y', null, 'rot', 0))
  where user_id = p_user;

  select nickname into v_nick from profiles where id = p_user;
  insert into lobby_events (kind, message, actor_id)
  values ('achievement', '🏅 @' || v_nick || ' desbloqueou a conquista "' || v_title || '" e ganhou ' || v_item.name || '!', p_user);
end $$;

create or replace function public.check_achievements(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  for r in select * from achievement_progress(p_user) where current >= target loop
    perform grant_achievement(p_user, r.code);
  end loop;
end $$;

create or replace function public.get_achievements(p_user uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'code', a.code, 'title', a.title, 'rule', a.rule, 'group', a.group_name,
           'item_name', s.name, 'item_asset', s.asset_url,
           'current', least(p.current, p.target), 'target', p.target,
           'unlocked', ua.user_id is not null, 'unlocked_at', ua.unlocked_at) order by a.sort_order), '[]'::jsonb)
  from achievements a
  join shop_items s on s.asset_url = a.item_asset
  join achievement_progress(p_user) p on p.code = a.code
  left join user_achievements ua on ua.code = a.code and ua.user_id = p_user;
$$;

-- -----------------------------------------------------------------------------
-- 7. FUNÇÕES DE APOSTA
-- -----------------------------------------------------------------------------

drop function if exists public.create_bet_expense(text, text, text, numeric, text, uuid, jsonb, text);
drop function if exists public.create_bet_expense(text, text, text, numeric, text, uuid, jsonb);
drop function if exists public.declare_winner(uuid, uuid);
drop function if exists public.cancel_bet_expense(uuid);

create or replace function public.create_bet(p_title text, p_amount numeric, p_participants uuid[], p_ends_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bet uuid;
  v_others uuid[];
  v_nicks text;
  v_nick text;
begin
  if v_uid is null then raise exception 'Faça login primeiro.'; end if;
  if coalesce(trim(p_title), '') = '' then raise exception 'Descreva a aposta.'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Informe um valor em R$.'; end if;
  if p_ends_at is not null and p_ends_at < now() then raise exception 'A data de término já passou.'; end if;

  select coalesce(array_agg(distinct u), '{}') into v_others
  from unnest(coalesce(p_participants, '{}')) u
  where u <> v_uid and exists (select 1 from profiles where id = u);
  if cardinality(v_others) = 0 then raise exception 'Escolha pelo menos um participante.'; end if;

  insert into bets_expenses (creator_id, title, amount, type, category, status, ends_at)
  values (v_uid, trim(p_title), round(p_amount, 2), 'bet',
          case when cardinality(v_others) = 1 then 'aposta' else 'bolao' end,
          'awaiting_acceptance', p_ends_at)
  returning id into v_bet;

  insert into bet_participants (bet_id, user_id, role, share_amount, paid_status, invite_status)
  values (v_bet, v_uid, 'participant', round(p_amount, 2), 'not_due', 'accepted');
  insert into bet_participants (bet_id, user_id, role, share_amount, paid_status, invite_status)
  select v_bet, u, 'participant', round(p_amount, 2), 'not_due', 'pending' from unnest(v_others) u;

  select string_agg('@' || nickname, ', ' order by nickname) into v_nicks from profiles where id = any (v_others);
  select nickname into v_nick from profiles where id = v_uid;
  insert into lobby_events (kind, message, actor_id)
  values ('bet', '🎲 @' || v_nick || ' convidou ' || v_nicks || ' para a aposta "' || trim(p_title) || '". Aguardando aceite.', v_uid);
  return v_bet;
end $$;

create or replace function public.respond_bet(p_bet uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bet bets_expenses%rowtype;
  v_nick text;
  v_left integer;
begin
  select * into v_bet from bets_expenses where id = p_bet for update;
  if not found or v_bet.status <> 'awaiting_acceptance' then raise exception 'Essa aposta não está aguardando aceite.'; end if;
  if not exists (select 1 from bet_participants where bet_id = p_bet and user_id = v_uid and invite_status = 'pending') then
    raise exception 'Você não tem convite pendente nessa aposta.';
  end if;
  select nickname into v_nick from profiles where id = v_uid;

  if p_accept then
    update bet_participants set invite_status = 'accepted' where bet_id = p_bet and user_id = v_uid;
  else
    delete from bet_participants where bet_id = p_bet and user_id = v_uid;
    insert into lobby_events (kind, message, actor_id)
    values ('bet', '🙅 @' || v_nick || ' recusou a aposta "' || v_bet.title || '".', v_uid);
  end if;

  select count(*) into v_left from bet_participants where bet_id = p_bet;
  if v_left < 2 then
    update bets_expenses set status = 'cancelled', resolved_at = now() where id = p_bet;
    return;
  end if;

  update bets_expenses set category = case when v_left = 2 then 'aposta' else 'bolao' end where id = p_bet;
  if not exists (select 1 from bet_participants where bet_id = p_bet and invite_status = 'pending') then
    update bets_expenses set status = 'active' where id = p_bet;
    insert into lobby_events (kind, message, actor_id)
    values ('bet', '✅ A aposta "' || v_bet.title || '" está ativa: todos aceitaram!', v_uid);
  end if;
end $$;

-- Cancelar: antes do aceite, o criador retira; ativa, precisa de todos concordarem.
create or replace function public.cancel_bet(p_bet uuid, p_agree boolean default true)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bet bets_expenses%rowtype;
  v_nick text;
begin
  select * into v_bet from bets_expenses where id = p_bet for update;
  if not found then raise exception 'Aposta não encontrada.'; end if;
  select nickname into v_nick from profiles where id = v_uid;

  if v_bet.status = 'awaiting_acceptance' then
    if v_bet.creator_id <> v_uid then raise exception 'Só quem criou pode retirar a aposta antes do aceite.'; end if;
    update bets_expenses set status = 'cancelled', resolved_at = now() where id = p_bet;
    return 'cancelled';
  end if;
  if v_bet.status <> 'active' then raise exception 'Só dá para cancelar apostas que ainda não têm resultado.'; end if;
  if not exists (select 1 from bet_participants where bet_id = p_bet and user_id = v_uid) then
    raise exception 'Você não participa dessa aposta.';
  end if;

  update bet_participants set cancel_vote = p_agree where bet_id = p_bet and user_id = v_uid;
  if not p_agree then return 'vote_removed'; end if;

  if not exists (select 1 from bet_participants where bet_id = p_bet and not cancel_vote) then
    update bets_expenses set status = 'cancelled', resolved_at = now() where id = p_bet;
    insert into lobby_events (kind, message, actor_id)
    values ('bet', '🤝 A aposta "' || v_bet.title || '" foi cancelada de comum acordo.', v_uid);
    return 'cancelled';
  end if;
  return 'voted';
end $$;

create or replace function public.declare_result(p_bet uuid, p_winners uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bet bets_expenses%rowtype;
  v_winners uuid[];
  v_total integer;
  v_w integer;
  v_each numeric;
  v_names text;
  r record;
  v_before bigint;
  v_after bigint;
  w uuid;
begin
  select * into v_bet from bets_expenses where id = p_bet for update;
  if not found or v_bet.type <> 'bet' then raise exception 'Aposta não encontrada.'; end if;
  if v_bet.creator_id <> v_uid then raise exception 'Só quem criou a aposta define o resultado.'; end if;
  if v_bet.status <> 'active' then raise exception 'A aposta precisa estar ativa.'; end if;

  select coalesce(array_agg(distinct u), '{}') into v_winners
  from unnest(coalesce(p_winners, '{}')) u
  where exists (select 1 from bet_participants where bet_id = p_bet and user_id = u);
  select count(*) into v_total from bet_participants where bet_id = p_bet;
  v_w := cardinality(v_winners);
  if v_w = 0 then raise exception 'Escolha pelo menos um vencedor.'; end if;
  if v_w >= v_total then raise exception 'Se todos venceram, declare empate.'; end if;
  if cardinality(v_winners) <> cardinality(coalesce(p_winners, '{}')) then raise exception 'Vencedor inválido.'; end if;

  v_each := round(v_bet.amount / v_w, 2);

  -- posição no ranking antes (para o aviso de Top 3)
  create temporary table if not exists _rank_before (user_id uuid, rk bigint) on commit drop;
  delete from _rank_before;
  insert into _rank_before select u, user_rank(u) from unnest(v_winners) u;

  update bet_participants set result = case when user_id = any (v_winners) then 'win' else 'loss' end where bet_id = p_bet;
  update bets_expenses set status = 'pending', resolved_at = now(), winner_id = v_winners[1] where id = p_bet;

  insert into debts (bet_id, title, debtor_id, creditor_id, amount, debt_since)
  select p_bet, v_bet.title, l.user_id, w2, v_each, now()
  from bet_participants l, unnest(v_winners) w2
  where l.bet_id = p_bet and l.result = 'loss';

  select string_agg('@' || p.nickname, ', ' order by p.nickname) into v_names from profiles p where p.id = any (v_winners);
  insert into lobby_events (kind, message, actor_id)
  values ('winner', '🏆 ' || v_names || case when v_w > 1 then ' venceram' else ' venceu' end || ' a aposta "' || v_bet.title
          || '". Os perdedores têm 48h para pagar.', v_uid);

  foreach w in array v_winners loop
    select rk into v_before from _rank_before where user_id = w;
    v_after := user_rank(w);
    if v_after <= 3 and (v_before is null or v_before > 3) then
      insert into lobby_events (kind, message, actor_id)
      select 'ranking', '🏆 @' || nickname || ' subiu para o Top 3 do ranking de apostadores do hotel.', id from profiles where id = w;
    end if;
  end loop;

  for r in select user_id from bet_participants where bet_id = p_bet loop
    perform check_achievements(r.user_id);
  end loop;
end $$;

create or replace function public.declare_draw(p_bet uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_bet bets_expenses%rowtype;
begin
  select * into v_bet from bets_expenses where id = p_bet for update;
  if not found or v_bet.type <> 'bet' then raise exception 'Aposta não encontrada.'; end if;
  if v_bet.creator_id <> auth.uid() then raise exception 'Só quem criou a aposta define o resultado.'; end if;
  if v_bet.status <> 'active' then raise exception 'A aposta precisa estar ativa.'; end if;
  update bets_expenses set status = 'draw', resolved_at = now() where id = p_bet;
  insert into lobby_events (kind, message, actor_id)
  values ('bet', '🤝 Empate na aposta "' || v_bet.title || '". Ninguém paga nada.', auth.uid());
end $$;

-- Ranking usa os resultados novos
create or replace function public.get_ranking(p_limit integer default 50)
returns table (user_id uuid, nickname text, wins bigint, decided bigint, win_rate numeric, rank bigint)
language sql stable security definer set search_path = public as $$
  with s as (
    select p.id, p.nickname, p.created_at,
           count(*) filter (where bp.result = 'win') as wins,
           count(*) filter (where bp.result is not null) as decided
    from profiles p join bet_participants bp on bp.user_id = p.id
    group by p.id
  )
  select id, nickname, wins, decided,
         case when decided = 0 then 0 else round(wins * 100.0 / decided, 1) end,
         rank() over (order by wins desc, (case when decided = 0 then 0 else wins::numeric / decided end) desc, created_at)
  from s where wins > 0
  order by 6
  limit p_limit;
$$;

-- -----------------------------------------------------------------------------
-- 8. FUNÇÕES DE EVENTO
-- -----------------------------------------------------------------------------

create or replace function public.create_event(p_name text, p_invitees uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_event uuid;
  v_nicks text;
  v_nick text;
begin
  if v_uid is null then raise exception 'Faça login primeiro.'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'O nome do evento é obrigatório.'; end if;

  insert into events (name, kind, creator_id) values (trim(p_name), detect_event_kind(p_name), v_uid)
  returning id into v_event;
  insert into event_members (event_id, user_id, status, responded_at) values (v_event, v_uid, 'accepted', now());
  insert into event_members (event_id, user_id, status)
  select distinct v_event, u, 'invited' from unnest(coalesce(p_invitees, '{}')) u
  where u <> v_uid and exists (select 1 from profiles where id = u)
  on conflict do nothing;

  select string_agg('@' || p.nickname, ', ' order by p.nickname) into v_nicks
  from event_members m join profiles p on p.id = m.user_id where m.event_id = v_event and m.user_id <> v_uid;
  select nickname into v_nick from profiles where id = v_uid;
  insert into lobby_events (kind, message, actor_id)
  values ('event', '🎉 @' || v_nick || ' criou o evento "' || trim(p_name) || '"' ||
          case when v_nicks is null then '.' else ' e convidou ' || v_nicks || '.' end, v_uid);
  return v_event;
end $$;

create or replace function public.invite_to_event(p_event uuid, p_users uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from events where id = p_event and status = 'open') then raise exception 'Evento encerrado ou inexistente.'; end if;
  if not exists (select 1 from event_members where event_id = p_event and user_id = auth.uid() and status = 'accepted') then
    raise exception 'Só membros do evento podem convidar.';
  end if;
  insert into event_members (event_id, user_id, status)
  select distinct p_event, u, 'invited' from unnest(coalesce(p_users, '{}')) u
  where exists (select 1 from profiles where id = u)
  on conflict (event_id, user_id) do update set status = 'invited', invited_at = now(), responded_at = null
    where event_members.status = 'declined';
end $$;

create or replace function public.respond_event(p_event uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_nick text;
begin
  select name into v_name from events where id = p_event and status = 'open';
  if not found then raise exception 'Evento encerrado ou inexistente.'; end if;
  update event_members set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now()
   where event_id = p_event and user_id = auth.uid() and status = 'invited';
  if not found then raise exception 'Você não tem convite pendente nesse evento.'; end if;
  if p_accept then
    select nickname into v_nick from profiles where id = auth.uid();
    insert into lobby_events (kind, message, actor_id)
    values ('event', '🙌 @' || v_nick || ' entrou no evento "' || v_name || '".', auth.uid());
  end if;
end $$;

-- Sub-despesa: divisão igual entre os envolvidos (centavos que sobram vão para os primeiros)
create or replace function public.add_event_expense(p_event uuid, p_amount numeric, p_description text, p_payer uuid, p_members uuid[])
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_members uuid[];
  v_n integer;
  v_cents integer;
  v_base integer;
  v_rest integer;
  v_exp uuid;
  i integer;
begin
  if not exists (select 1 from events where id = p_event and status = 'open') then raise exception 'Evento encerrado ou inexistente.'; end if;
  if not exists (select 1 from event_members where event_id = p_event and user_id = v_uid and status = 'accepted') then
    raise exception 'Aceite o convite do evento antes de lançar despesas.';
  end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Informe um valor em R$.'; end if;
  if not exists (select 1 from event_members where event_id = p_event and user_id = p_payer and status = 'accepted') then
    raise exception 'Quem pagou precisa ser membro do evento.';
  end if;

  select array_agg(u order by u) into v_members
  from (select distinct u from unnest(coalesce(p_members, '{}')) u) d
  where exists (select 1 from event_members where event_id = p_event and user_id = d.u and status = 'accepted');
  v_n := coalesce(cardinality(v_members), 0);
  if v_n = 0 then raise exception 'Marque quem participou desse gasto.'; end if;
  if v_n <> cardinality(array(select distinct unnest(p_members))) then
    raise exception 'Só membros que aceitaram o convite podem entrar nas contas.';
  end if;

  v_cents := round(p_amount * 100)::int;
  v_base := v_cents / v_n;
  v_rest := v_cents - v_base * v_n;

  insert into event_expenses (event_id, payer_id, amount, description, created_by)
  values (p_event, p_payer, v_cents / 100.0, nullif(trim(coalesce(p_description, '')), ''), v_uid)
  returning id into v_exp;

  for i in 1..v_n loop
    insert into event_expense_splits (expense_id, user_id, share_amount)
    values (v_exp, v_members[i], (v_base + case when i <= v_rest then 1 else 0 end) / 100.0);
  end loop;
  return v_exp;
end $$;

create or replace function public.delete_event_expense(p_expense uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_exp event_expenses%rowtype;
begin
  select * into v_exp from event_expenses where id = p_expense;
  if not found then raise exception 'Despesa não encontrada.'; end if;
  if not exists (select 1 from events where id = v_exp.event_id and status = 'open') then raise exception 'Evento já encerrado.'; end if;
  if v_exp.created_by <> auth.uid() and not exists (select 1 from events where id = v_exp.event_id and creator_id = auth.uid()) then
    raise exception 'Só quem lançou ou quem criou o evento pode apagar.';
  end if;
  delete from event_expenses where id = p_expense;
end $$;

-- Encerrar: gera as cobranças com o mínimo de transferências
create or replace function public.close_event(p_event uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_ev events%rowtype;
  v_c uuid; v_cn numeric;
  v_d uuid; v_dn numeric;
  v_v numeric;
  v_count integer := 0;
  r record;
begin
  select * into v_ev from events where id = p_event for update;
  if not found then raise exception 'Evento não encontrado.'; end if;
  if v_ev.creator_id <> auth.uid() then raise exception 'Só quem criou o evento pode encerrar.'; end if;
  if v_ev.status <> 'open' then raise exception 'Evento já encerrado.'; end if;

  update event_members set status = 'declined', responded_at = now() where event_id = p_event and status = 'invited';

  drop table if exists _bal;
  create temporary table _bal (user_id uuid primary key, net numeric) on commit drop;
  insert into _bal
  select m.user_id,
         coalesce((select sum(e.amount) from event_expenses e where e.event_id = p_event and e.payer_id = m.user_id), 0)
       - coalesce((select sum(s.share_amount) from event_expense_splits s join event_expenses e on e.id = s.expense_id
                   where e.event_id = p_event and s.user_id = m.user_id), 0)
  from event_members m where m.event_id = p_event and m.status = 'accepted';

  loop
    select user_id, net into v_c, v_cn from _bal where net > 0.004 order by net desc, user_id limit 1;
    exit when not found;
    select user_id, net into v_d, v_dn from _bal where net < -0.004 order by net asc, user_id limit 1;
    exit when not found;
    v_v := round(least(v_cn, -v_dn), 2);
    exit when v_v <= 0;
    insert into debts (event_id, title, debtor_id, creditor_id, amount, debt_since)
    values (p_event, v_ev.name, v_d, v_c, v_v, now());
    update _bal set net = net - v_v where user_id = v_c;
    update _bal set net = net + v_v where user_id = v_d;
    v_count := v_count + 1;
  end loop;

  update events set status = 'closed', closed_at = now() where id = p_event;
  insert into lobby_events (kind, message, actor_id)
  values ('event', '🧾 O evento "' || v_ev.name || '" foi encerrado: ' || v_count || ' cobrança' ||
          case when v_count = 1 then '' else 's' end || ' gerada' || case when v_count = 1 then '' else 's' end || '.', auth.uid());

  for r in select user_id from event_members where event_id = p_event and status = 'accepted' loop
    perform check_achievements(r.user_id);
  end loop;
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- 9. PAGAMENTOS (sobre debts)
-- -----------------------------------------------------------------------------

drop function if exists public.mark_paid(uuid, text);
drop function if exists public.reject_payment(uuid);
drop function if exists public.confirm_payment(uuid);

create or replace function public.mark_paid(p_debt uuid, p_proof_path text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v debts%rowtype;
begin
  select * into v from debts where id = p_debt for update;
  if not found or v.debtor_id <> auth.uid() then raise exception 'Dívida não encontrada.'; end if;
  if v.paid_status <> 'unpaid' then raise exception 'Essa dívida não está em aberto.'; end if;
  if p_proof_path is not null and split_part(p_proof_path, '/', 1) <> auth.uid()::text then raise exception 'Comprovante inválido.'; end if;

  update debts set paid_status = 'marked_paid', marked_paid_at = now(),
         proof_image_url = coalesce(p_proof_path, proof_image_url),
         proof_expires_at = case when p_proof_path is null then proof_expires_at else now() + interval '90 days' end
   where id = p_debt;
  if v.bet_id is not null then update bets_expenses set status = 'awaiting_approval' where id = v.bet_id; end if;
end $$;

create or replace function public.reject_payment(p_debt uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v debts%rowtype;
begin
  select * into v from debts where id = p_debt for update;
  if not found or v.creditor_id <> auth.uid() then raise exception 'Dívida não encontrada.'; end if;
  if v.paid_status <> 'marked_paid' then raise exception 'Nada para recusar.'; end if;
  update debts set paid_status = 'unpaid', marked_paid_at = null where id = p_debt;
  if v.bet_id is not null then
    update bets_expenses b set status = 'pending'
     where b.id = v.bet_id and not exists (select 1 from debts where bet_id = b.id and paid_status = 'marked_paid');
  end if;
end $$;

create or replace function public.confirm_payment(p_debt uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v debts%rowtype;
  v_week_start timestamptz := date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_earned integer;
  v_coins integer;
  v_debtor text;
  v_creditor text;
  v_on_time boolean;
begin
  select * into v from debts where id = p_debt for update;
  if not found or v.creditor_id <> auth.uid() then raise exception 'Dívida não encontrada.'; end if;
  if v.paid_status <> 'marked_paid' then raise exception 'O devedor ainda não marcou como pago.'; end if;

  select coalesce(sum(coins_awarded), 0) into v_earned
    from debts where debtor_id = v.debtor_id and confirmed_at >= v_week_start;
  v_coins := greatest(0, least(10, 100 - v_earned));

  update debts set paid_status = 'confirmed', confirmed_at = now(), coins_awarded = v_coins where id = p_debt;
  update profiles set hotel_coins = hotel_coins + v_coins where id = v.debtor_id;

  if v.bet_id is not null then
    update bets_expenses b set status = case
        when not exists (select 1 from debts where bet_id = b.id and paid_status in ('unpaid', 'marked_paid')) then 'settled'
        when exists (select 1 from debts where bet_id = b.id and paid_status = 'marked_paid') then 'awaiting_approval'
        else 'pending' end
     where b.id = v.bet_id;
  end if;

  select nickname into v_debtor from profiles where id = v.debtor_id;
  select nickname into v_creditor from profiles where id = v.creditor_id;
  v_on_time := v.marked_paid_at <= v.debt_since + interval '48 hours';
  insert into lobby_events (kind, message, actor_id)
  values ('settled',
          case when v_coins > 0
               then '🪙 @' || v_debtor || ' recebeu ' || v_coins || ' Hotel Coins por pagar "' || v.title || '"' || case when v_on_time then ' em dia.' else '.' end
               else '✅ @' || v_debtor || ' quitou "' || v.title || '" com @' || v_creditor || '.' end,
          v.debtor_id);

  perform refresh_cleanliness(v.debtor_id);
  perform check_achievements(v.debtor_id);
  perform check_achievements(v.creditor_id);
  return v_coins;
end $$;

-- -----------------------------------------------------------------------------
-- 10. FUNÇÕES QUE PASSAM A LER debts
-- -----------------------------------------------------------------------------

create or replace function public.refresh_cleanliness(p_user uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_new integer;
  v_nick text;
begin
  for r in
    select ro.user_id, ro.cleanliness_score as old_score,
           coalesce(max(extract(epoch from (now() - d.debt_since - interval '48 hours')) / 3600.0)
                    filter (where d.paid_status = 'unpaid' and d.debt_since < now() - interval '48 hours'), 0) as overdue_hours,
           coalesce(sum(d.amount) filter (where d.paid_status = 'unpaid' and d.debt_since < now() - interval '48 hours'), 0) as overdue_amount
    from rooms ro
    left join debts d on d.debtor_id = ro.user_id
    where p_user is null or ro.user_id = p_user
    group by ro.user_id, ro.cleanliness_score
  loop
    v_new := case when r.overdue_hours <= 0 then 100 else greatest(0, 100 - ceil(r.overdue_hours / 24.0)::int * 20) end;
    continue when v_new = r.old_score;
    update rooms set cleanliness_score = v_new where user_id = r.user_id;
    select nickname into v_nick from profiles where id = r.user_id;
    if r.old_score > 40 and v_new <= 40 then
      insert into lobby_events (kind, message, actor_id)
      values ('roaches', '🪳 Baratas foram vistas no quarto de @' || v_nick || '. ' ||
              case when r.overdue_amount > 0 then 'Faltam R$ ' || replace(to_char(r.overdue_amount, 'FM999999990.00'), '.', ',') || ' para a dedetização.'
                   else 'Falta pagar para a dedetização.' end, r.user_id);
    elsif r.old_score = 100 and v_new < 100 then
      insert into lobby_events (kind, message, actor_id)
      values ('dirty', '🕷️ O quarto de @' || v_nick || ' acumulou teias de aranha por inadimplência!', r.user_id);
    elsif v_new = 100 then
      insert into lobby_events (kind, message, actor_id)
      values ('clean', '🧹 O quarto de @' || v_nick || ' está limpinho de novo!', r.user_id);
    end if;
  end loop;
end $$;

create or replace function public.get_user_stats(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_total integer; v_wins integer; v_decided integer;
  v_volume numeric; v_overdue integer; v_open integer; v_history jsonb; v_score integer;
begin
  select count(*) filter (where b.status not in ('awaiting_acceptance', 'cancelled')),
         count(*) filter (where bp.result = 'win'),
         count(*) filter (where bp.result is not null)
    into v_total, v_wins, v_decided
  from bet_participants bp join bets_expenses b on b.id = bp.bet_id
  where bp.user_id = p_user;

  select coalesce(sum(amount), 0) into v_volume from debts
   where paid_status = 'confirmed' and (debtor_id = p_user or creditor_id = p_user);
  select count(*) filter (where paid_status = 'unpaid' and debt_since < now() - interval '48 hours'),
         count(*) filter (where paid_status in ('unpaid', 'marked_paid'))
    into v_overdue, v_open
  from debts where debtor_id = p_user;

  select coalesce(jsonb_agg(h order by h.confirmed_at desc), '[]'::jsonb) into v_history from (
    select d.confirmed_at, case when d.debtor_id = p_user then 'paid' else 'received' end as direction,
           d.amount, null::text as prize_text, case when d.bet_id is not null then 'bet' else 'expense' end as type,
           (select nickname from profiles where id = case when d.debtor_id = p_user then d.creditor_id else d.debtor_id end) as counterpart
    from debts d where d.paid_status = 'confirmed' and (d.debtor_id = p_user or d.creditor_id = p_user)
    order by d.confirmed_at desc limit 10) h;

  select cleanliness_score into v_score from rooms where user_id = p_user;
  return jsonb_build_object('total_bets', v_total, 'wins', v_wins, 'decided_bets', v_decided,
    'win_rate', case when v_decided = 0 then 0 else round(v_wins * 100.0 / v_decided, 1) end,
    'volume', v_volume, 'overdue_count', v_overdue, 'open_debts', v_open, 'is_compliant', v_overdue = 0,
    'cleanliness_score', coalesce(v_score, 100), 'history', v_history);
end $$;

create or replace function public.get_contact_info(p_user uuid)
returns table (full_name text, nickname text, pix_key text, whatsapp text)
language sql stable security definer set search_path = public as $$
  select p.full_name, p.nickname, p.pix_key, p.whatsapp
  from profiles p
  where p.id = p_user and (
    p_user = auth.uid()
    or exists (select 1 from bet_participants a join bet_participants b on a.bet_id = b.bet_id where a.user_id = auth.uid() and b.user_id = p_user)
    or exists (select 1 from event_members a join event_members b on a.event_id = b.event_id
               where a.user_id = auth.uid() and b.user_id = p_user and a.status <> 'declined' and b.status <> 'declined')
    or exists (select 1 from debts d where (d.debtor_id = auth.uid() and d.creditor_id = p_user) or (d.creditor_id = auth.uid() and d.debtor_id = p_user))
  );
$$;

create or replace function public.can_view_proof(p_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from debts d where d.proof_image_url = p_path and (d.debtor_id = auth.uid() or d.creditor_id = auth.uid()));
$$;

create or replace function public.purge_expired_proofs()
returns integer language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url text; v_key text; r record; v_count integer := 0;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_url is null or v_key is null then
    raise warning 'purge_expired_proofs: segredos project_url/service_role_key ausentes no Vault';
    return 0;
  end if;
  for r in select id, proof_image_url from debts where proof_image_url is not null and proof_expires_at < now() loop
    perform net.http_delete(
      url := v_url || '/storage/v1/object/proofs/' || r.proof_image_url,
      headers := case when v_key like 'sb\_%' then jsonb_build_object('apikey', v_key)
                      else jsonb_build_object('apikey', v_key, 'Authorization', 'Bearer ' || v_key) end);
    update debts set proof_image_url = null, proof_expires_at = null where id = r.id;
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- 11. MÓVEIS: parede (x = -1 ou y = -1) e em cima de mesas
-- -----------------------------------------------------------------------------

create or replace function public.move_furniture(p_uid text, p_x integer, p_y integer, p_rot integer default 0)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_inv jsonb;
  v_size integer;
  v_item shop_items%rowtype;
  v_old jsonb;
begin
  if p_rot not in (0, 1) then raise exception 'Rotação inválida.'; end if;
  select inventory_json, room_size(room_type) into v_inv, v_size from rooms where user_id = auth.uid() for update;

  select s.* into v_item
  from jsonb_array_elements(v_inv->'furniture') e join shop_items s on s.id = (e->>'item_id')::uuid
  where e->>'uid' = p_uid;
  if not found then raise exception 'Móvel não encontrado.'; end if;
  select e into v_old from jsonb_array_elements(v_inv->'furniture') e where e->>'uid' = p_uid;

  if p_x is not null then
    if v_item.layer = 'wall' then
      if not ((p_x = -1 and p_y between 0 and v_size - 1) or (p_y = -1 and p_x between 0 and v_size - 1)) then
        raise exception 'Esse item vai na parede.';
      end if;
      if exists (select 1 from jsonb_array_elements(v_inv->'furniture') e join shop_items s on s.id = (e->>'item_id')::uuid
                 where e->>'uid' <> p_uid and s.layer = 'wall' and (e->>'x')::int = p_x and (e->>'y')::int = p_y) then
        raise exception 'Já tem um quadro nesse lugar da parede.';
      end if;
    elsif v_item.layer = 'table' then
      if not exists (
        select 1 from jsonb_array_elements(v_inv->'furniture') e join shop_items s on s.id = (e->>'item_id')::uuid
        cross join lateral furniture_tiles((e->>'x')::int, (e->>'y')::int, s.size_x, s.size_y, coalesce((e->>'rot')::int, 0)) t
        where e->>'x' is not null and s.surface_z is not null and t.tx = p_x and t.ty = p_y) then
        raise exception 'Esse item vai em cima de uma mesa.';
      end if;
      if exists (select 1 from jsonb_array_elements(v_inv->'furniture') e join shop_items s on s.id = (e->>'item_id')::uuid
                 where e->>'uid' <> p_uid and s.layer = 'table' and (e->>'x')::int = p_x and (e->>'y')::int = p_y) then
        raise exception 'Já tem algo em cima dessa parte da mesa.';
      end if;
    else
      if exists (select 1 from furniture_tiles(p_x, p_y, v_item.size_x, v_item.size_y, p_rot) t
                 where t.tx < 0 or t.ty < 0 or t.tx >= v_size or t.ty >= v_size) then
        raise exception 'Não cabe aí — tente outro piso ou gire o móvel.';
      end if;
      if exists (
        select 1 from jsonb_array_elements(v_inv->'furniture') e
        join shop_items s on s.id = (e->>'item_id')::uuid
        cross join lateral furniture_tiles((e->>'x')::int, (e->>'y')::int, s.size_x, s.size_y, coalesce((e->>'rot')::int, 0)) o
        join furniture_tiles(p_x, p_y, v_item.size_x, v_item.size_y, p_rot) n on n.tx = o.tx and n.ty = o.ty
        where e->>'uid' <> p_uid and e->>'x' is not null and s.layer = v_item.layer) then
        raise exception 'Esse espaço já está ocupado.';
      end if;
    end if;
  end if;

  select jsonb_set(v_inv, '{furniture}', coalesce(jsonb_agg(
           case when e->>'uid' = p_uid then e || jsonb_build_object('x', p_x, 'y', p_y, 'rot', p_rot) else e end), '[]'::jsonb))
    into v_inv
  from jsonb_array_elements(v_inv->'furniture') e;

  -- mesa saiu do lugar: o que estava em cima volta para o inventário
  if v_item.surface_z is not null and v_old->>'x' is not null then
    select jsonb_set(v_inv, '{furniture}', coalesce(jsonb_agg(
             case when s.layer = 'table' and exists (
                    select 1 from furniture_tiles((v_old->>'x')::int, (v_old->>'y')::int, v_item.size_x, v_item.size_y,
                                                  coalesce((v_old->>'rot')::int, 0)) t
                    where t.tx = (e->>'x')::int and t.ty = (e->>'y')::int)
                  then e || '{"x":null,"y":null}'::jsonb else e end), '[]'::jsonb))
      into v_inv
    from jsonb_array_elements(v_inv->'furniture') e left join shop_items s on s.id = (e->>'item_id')::uuid;
  end if;

  update rooms set inventory_json = v_inv where user_id = auth.uid();
end $$;

-- -----------------------------------------------------------------------------
-- 12. PERMISSÕES E CONQUISTAS RETROATIVAS
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.nickname_available(text) to anon;
revoke execute on function public.purge_expired_proofs() from authenticated;
revoke execute on function public.new_room_number() from authenticated;
revoke execute on function public.grant_achievement(uuid, text) from authenticated;
revoke execute on function public.check_achievements(uuid) from authenticated;

do $$
declare r record;
begin
  for r in select id from public.profiles loop
    perform public.check_achievements(r.id);
  end loop;
end $$;

-- =============================================================================
-- BetHotel — Migração 0005: peso na geração de coins, eventos sem aceite,
-- saída voluntária de eventos e correção do erro "DELETE requires a WHERE clause".
-- Rode DEPOIS da 0004, no SQL Editor do Supabase. Pode rodar de novo.
--
-- Coins (sem teto semanal):
--   calc_hotel_coins(v) — idêntica a src/lib/coins.ts:
--     v >= 54,29  → v (1:1)
--     v <  54,29  → v * (2 - v / 54,29), mínimo 1
--     arredonda: ≥ 0,5 para cima, < 0,5 para baixo
--   * Apostas: só o vencedor ganha, calculado sobre cada pagamento que ele
--     confirma. Empate: ninguém ganha.
--   * Eventos: para cada sub-despesa, a fórmula é aplicada à parte de cada pessoa
--     (ex.: R$ 50 entre 5 = base R$ 10) e somada. Quem adiantou também ganha pela
--     própria parte. Credita quando a pessoa não deve mais nada no evento
--     (evento encerrado e todas as cobranças dela confirmadas).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Fórmula
-- -----------------------------------------------------------------------------

create or replace function public.calc_hotel_coins(p_value numeric)
returns integer language plpgsql immutable as $$
declare
  media constant double precision := 54.29;
  v double precision := coalesce(p_value, 0)::double precision;
  bruto double precision;
begin
  if v >= media then
    bruto := v;
  else
    bruto := v * (1.0 + (1.0 - v / media));
    if bruto < 1 then bruto := 1; end if;
  end if;
  return floor(bruto + 0.5)::integer;  -- igual a Math.round do JavaScript
end $$;

-- -----------------------------------------------------------------------------
-- 2. Colunas novas
-- -----------------------------------------------------------------------------

-- moedas do vencedor (credor) por pagamento de aposta confirmado
alter table public.debts add column if not exists creditor_coins integer not null default 0;
-- moedas creditadas a cada membro pelo evento
alter table public.event_members add column if not exists coins_awarded integer not null default 0;
alter table public.event_members add column if not exists coins_at timestamptz;

alter table public.event_members drop constraint if exists event_members_status_check;
alter table public.event_members add constraint event_members_status_check
  check (status in ('invited', 'accepted', 'declined', 'left'));

-- Convites pendentes em eventos abertos passam a ser participação direta
update public.event_members m set status = 'accepted', responded_at = now()
  from public.events e
 where e.id = m.event_id and e.status = 'open' and m.status = 'invited';

-- -----------------------------------------------------------------------------
-- 3. Eventos: entrada automática, adicionar pessoas, sair
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
  insert into event_members (event_id, user_id, status, responded_at)
  select distinct v_event, u, 'accepted', now() from unnest(coalesce(p_invitees, '{}')) u
  where u <> v_uid and exists (select 1 from profiles where id = u)
  on conflict do nothing;

  select string_agg('@' || p.nickname, ', ' order by p.nickname) into v_nicks
  from event_members m join profiles p on p.id = m.user_id where m.event_id = v_event and m.user_id <> v_uid;
  select nickname into v_nick from profiles where id = v_uid;
  insert into lobby_events (kind, message, actor_id)
  values ('event', '🎉 @' || v_nick || ' criou o evento "' || trim(p_name) || '"' ||
          case when v_nicks is null then '.' else ' com ' || v_nicks || '.' end, v_uid);
  return v_event;
end $$;

-- Adicionar pessoas: entram direto (mesmo nome da função antiga, para o app atual)
create or replace function public.invite_to_event(p_event uuid, p_users uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from events where id = p_event and status = 'open') then raise exception 'Evento encerrado ou inexistente.'; end if;
  if not exists (select 1 from event_members where event_id = p_event and user_id = auth.uid() and status = 'accepted') then
    raise exception 'Só participantes do evento podem adicionar pessoas.';
  end if;
  insert into event_members (event_id, user_id, status, responded_at)
  select distinct p_event, u, 'accepted', now() from unnest(coalesce(p_users, '{}')) u
  where exists (select 1 from profiles where id = u)
  on conflict (event_id, user_id) do update set status = 'accepted', responded_at = now();
end $$;

-- Sair do evento: a parte da pessoa em cada gasto é redistribuída igual entre os
-- demais envolvidos daquele gasto; se ela era a única, o gasto fica com quem pagou.
create or replace function public.leave_event(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_ev events%rowtype;
  r record;
  v_others uuid[];
  v_n integer;
  v_cents integer;
  v_base integer;
  v_rest integer;
  i integer;
  v_nick text;
begin
  select * into v_ev from events where id = p_event for update;
  if not found then raise exception 'Evento não encontrado.'; end if;
  if v_ev.status <> 'open' then raise exception 'O evento já foi encerrado; não dá mais para sair.'; end if;
  if v_ev.creator_id = v_uid then raise exception 'Quem criou o evento não pode sair. Se precisar, apague os gastos.'; end if;
  if not exists (select 1 from event_members where event_id = p_event and user_id = v_uid and status = 'accepted') then
    raise exception 'Você não está nesse evento.';
  end if;
  if exists (select 1 from event_expenses where event_id = p_event and payer_id = v_uid) then
    raise exception 'Você pagou um gasto deste evento. Peça para apagarem esse gasto antes de sair.';
  end if;

  for r in
    select s.expense_id, s.share_amount, e.payer_id
    from event_expense_splits s join event_expenses e on e.id = s.expense_id
    where e.event_id = p_event and s.user_id = v_uid
  loop
    select array_agg(user_id order by user_id) into v_others
    from event_expense_splits where expense_id = r.expense_id and user_id <> v_uid;
    v_n := coalesce(cardinality(v_others), 0);
    v_cents := round(r.share_amount * 100)::int;

    if v_n = 0 then
      insert into event_expense_splits (expense_id, user_id, share_amount)
      values (r.expense_id, r.payer_id, r.share_amount)
      on conflict (expense_id, user_id) do update set share_amount = event_expense_splits.share_amount + excluded.share_amount;
    else
      v_base := v_cents / v_n;
      v_rest := v_cents - v_base * v_n;
      for i in 1..v_n loop
        update event_expense_splits
           set share_amount = share_amount + (v_base + case when i <= v_rest then 1 else 0 end) / 100.0
         where expense_id = r.expense_id and user_id = v_others[i];
      end loop;
    end if;
    delete from event_expense_splits where expense_id = r.expense_id and user_id = v_uid;
  end loop;

  update event_members set status = 'left', responded_at = now() where event_id = p_event and user_id = v_uid;
  select nickname into v_nick from profiles where id = v_uid;
  insert into lobby_events (kind, message, actor_id)
  values ('event', '👋 @' || v_nick || ' saiu do evento "' || v_ev.name || '".', v_uid);
end $$;

-- Quem saiu/recusou não vê mais o evento
create or replace function public.is_event_member(p_event uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from events e where e.id = p_event and e.creator_id = auth.uid())
      or exists (select 1 from event_members m where m.event_id = p_event and m.user_id = auth.uid() and m.status in ('accepted', 'invited'));
$$;

-- -----------------------------------------------------------------------------
-- 4. Moedas de evento
-- -----------------------------------------------------------------------------

create or replace function public.event_coins_for(p_event uuid, p_user uuid)
returns integer language sql stable security definer set search_path = public as $$
  select coalesce(sum(calc_hotel_coins(s.share_amount)), 0)::int
  from event_expense_splits s join event_expenses e on e.id = s.expense_id
  where e.event_id = p_event and s.user_id = p_user and s.share_amount > 0;
$$;

-- Credita as moedas de um membro se o evento está encerrado e ele não deve nada
create or replace function public.award_event_coins(p_event uuid, p_user uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_coins integer;
  v_nick text;
  v_name text;
begin
  if not exists (select 1 from events where id = p_event and status = 'closed') then return 0; end if;
  if not exists (select 1 from event_members where event_id = p_event and user_id = p_user and status = 'accepted' and coins_at is null) then return 0; end if;
  if exists (select 1 from debts where event_id = p_event and debtor_id = p_user and paid_status <> 'confirmed') then return 0; end if;

  v_coins := event_coins_for(p_event, p_user);
  update event_members set coins_awarded = v_coins, coins_at = now() where event_id = p_event and user_id = p_user;
  if v_coins > 0 then
    update profiles set hotel_coins = hotel_coins + v_coins where id = p_user;
    select nickname into v_nick from profiles where id = p_user;
    select name into v_name from events where id = p_event;
    insert into lobby_events (kind, message, actor_id)
    values ('settled', '🪙 @' || v_nick || ' recebeu ' || v_coins || ' Hotel Coins por fechar as contas do evento "' || v_name || '".', p_user);
  end if;
  return v_coins;
end $$;

create or replace function public.close_event(p_event uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_ev events%rowtype;
  v_ids uuid[];
  v_net numeric[];
  v_c integer;
  v_d integer;
  v_v numeric;
  v_count integer := 0;
  i integer;
  r record;
begin
  select * into v_ev from events where id = p_event for update;
  if not found then raise exception 'Evento não encontrado.'; end if;
  if v_ev.creator_id <> auth.uid() then raise exception 'Só quem criou o evento pode encerrar.'; end if;
  if v_ev.status <> 'open' then raise exception 'Evento já encerrado.'; end if;

  -- saldos em arrays (sem tabela temporária)
  select array_agg(m.user_id order by m.user_id),
         array_agg(
           coalesce((select sum(e.amount) from event_expenses e where e.event_id = p_event and e.payer_id = m.user_id), 0)
         - coalesce((select sum(s.share_amount) from event_expense_splits s join event_expenses e on e.id = s.expense_id
                     where e.event_id = p_event and s.user_id = m.user_id), 0)
           order by m.user_id)
    into v_ids, v_net
  from event_members m where m.event_id = p_event and m.status = 'accepted';

  loop
    v_c := null; v_d := null;
    for i in 1..coalesce(cardinality(v_ids), 0) loop
      if v_net[i] > 0.004 and (v_c is null or v_net[i] > v_net[v_c]) then v_c := i; end if;
      if v_net[i] < -0.004 and (v_d is null or v_net[i] < v_net[v_d]) then v_d := i; end if;
    end loop;
    exit when v_c is null or v_d is null;
    v_v := round(least(v_net[v_c], -v_net[v_d]), 2);
    exit when v_v <= 0;
    insert into debts (event_id, title, debtor_id, creditor_id, amount, debt_since)
    values (p_event, v_ev.name, v_ids[v_d], v_ids[v_c], v_v, now());
    v_net[v_c] := v_net[v_c] - v_v;
    v_net[v_d] := v_net[v_d] + v_v;
    v_count := v_count + 1;
  end loop;

  update events set status = 'closed', closed_at = now() where id = p_event;
  insert into lobby_events (kind, message, actor_id)
  values ('event', '🧾 O evento "' || v_ev.name || '" foi encerrado: ' || v_count || ' cobrança' ||
          case when v_count = 1 then '' else 's' end || ' gerada' || case when v_count = 1 then '' else 's' end || '.', auth.uid());

  for r in select user_id from event_members where event_id = p_event and status = 'accepted' loop
    perform award_event_coins(p_event, r.user_id);
    perform check_achievements(r.user_id);
  end loop;
  return v_count;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Pagamento confirmado: moedas pela fórmula, sem teto
-- -----------------------------------------------------------------------------

create or replace function public.confirm_payment(p_debt uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v debts%rowtype;
  v_coins integer := 0;
  v_debtor text;
  v_creditor text;
  v_ev_coins integer := 0;
begin
  select * into v from debts where id = p_debt for update;
  if not found or v.creditor_id <> auth.uid() then raise exception 'Dívida não encontrada.'; end if;
  if v.paid_status <> 'marked_paid' then raise exception 'O devedor ainda não marcou como pago.'; end if;

  if v.bet_id is not null then
    -- aposta: só o vencedor (credor) ganha moedas, sobre o valor recebido
    v_coins := case when v.amount is null then 0 else calc_hotel_coins(v.amount) end;
    update debts set paid_status = 'confirmed', confirmed_at = now(), coins_awarded = 0, creditor_coins = v_coins where id = p_debt;
    update profiles set hotel_coins = hotel_coins + v_coins where id = v.creditor_id;
    update bets_expenses b set status = case
        when not exists (select 1 from debts where bet_id = b.id and paid_status in ('unpaid', 'marked_paid')) then 'settled'
        when exists (select 1 from debts where bet_id = b.id and paid_status = 'marked_paid') then 'awaiting_approval'
        else 'pending' end
     where b.id = v.bet_id;
  else
    update debts set paid_status = 'confirmed', confirmed_at = now() where id = p_debt;
  end if;

  select nickname into v_debtor from profiles where id = v.debtor_id;
  select nickname into v_creditor from profiles where id = v.creditor_id;
  insert into lobby_events (kind, message, actor_id)
  values ('settled',
          case when v.bet_id is not null and v_coins > 0
               then '🪙 @' || v_creditor || ' recebeu o pagamento de @' || v_debtor || ' em "' || v.title || '" e ganhou ' || v_coins || ' Hotel Coins.'
               else '✅ @' || v_debtor || ' quitou "' || v.title || '" com @' || v_creditor || '.' end,
          v.creditor_id);

  if v.event_id is not null then
    v_ev_coins := award_event_coins(v.event_id, v.debtor_id);
  end if;

  perform refresh_cleanliness(v.debtor_id);
  perform check_achievements(v.debtor_id);
  perform check_achievements(v.creditor_id);
  return case when v.bet_id is not null then v_coins else v_ev_coins end;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Correção: declare_result sem tabela temporária (o Supabase bloqueia
--    "DELETE sem WHERE", o que derrubava Confirmar vencedor)
-- -----------------------------------------------------------------------------

create or replace function public.declare_result(p_bet uuid, p_winners uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bet bets_expenses%rowtype;
  v_winners uuid[];
  v_before bigint[];
  v_total integer;
  v_w integer;
  v_each numeric;
  v_names text;
  v_after bigint;
  r record;
  i integer;
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
  if v_w <> cardinality(array(select distinct unnest(coalesce(p_winners, '{}'::uuid[])))) then raise exception 'Vencedor inválido.'; end if;

  v_each := round(v_bet.amount / v_w, 2);

  -- ranking antes, guardado em array
  select array_agg(user_rank(u) order by ord) into v_before
  from unnest(v_winners) with ordinality as t(u, ord);

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

  for i in 1..v_w loop
    v_after := user_rank(v_winners[i]);
    if v_after <= 3 and (v_before[i] is null or v_before[i] > 3) then
      insert into lobby_events (kind, message, actor_id)
      select 'ranking', '🏆 @' || nickname || ' subiu para o Top 3 do ranking de apostadores do hotel.', id from profiles where id = v_winners[i];
    end if;
  end loop;

  for r in select user_id from bet_participants where bet_id = p_bet loop
    perform check_achievements(r.user_id);
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Permissões
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.nickname_available(text) to anon;
revoke execute on function public.purge_expired_proofs() from authenticated;
revoke execute on function public.new_room_number() from authenticated;
revoke execute on function public.grant_achievement(uuid, text) from authenticated;
revoke execute on function public.check_achievements(uuid) from authenticated;
revoke execute on function public.award_event_coins(uuid, uuid) from authenticated;

-- Eventos encerrados antes desta atualização já pagaram moedas pela regra antiga:
-- marca como creditados para não pagar em dobro.
update public.event_members m set coins_at = coalesce(m.coins_at, now())
  from public.events e
 where e.id = m.event_id and e.status = 'closed' and m.coins_at is null;

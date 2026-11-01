-- =============================================================================
-- BetHotel — Migração 0003: layout novo dos mockups
-- Rode DEPOIS da 0001 e da 0002, no SQL Editor do Supabase. Pode rodar de novo.
--
--   * Quartos: Kitnet 4x4 (inicial), Studio 6x6 (50 moedas), Loft 8x8 (150)
--     — contas existentes voltam para Kitnet 4x4; móveis que não cabem vão para o inventário
--   * Moedas: +10 fixas por quitação confirmada, teto de 100 por semana
--   * Categorias: Aposta 1v1, Bolão, Despesa compartilhada (racha), Viagem
--   * Número do quarto (ex.: Quarto 214) e frase curta no perfil
--   * Ranking de apostadores (por vitórias) e aviso de "subiu para o Top 3"
--   * Avisos novos: baratas/dedetização e moedas recebidas
--   * Comprovantes aceitam PDF
--   * Catálogo: + Cama de Casal Estilizada (60), Estante de Troféus (110),
--     nomes alinhados ao mockup; "Cabelos Estilizados" removido
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Perfil: número do quarto e frase
-- -----------------------------------------------------------------------------

alter table public.profiles add column if not exists room_number integer unique;
alter table public.profiles add column if not exists bio text;
alter table public.profiles drop constraint if exists profiles_bio_check;
alter table public.profiles add constraint profiles_bio_check check (bio is null or char_length(bio) <= 80);

create or replace function public.new_room_number()
returns integer language plpgsql volatile security definer set search_path = public as $$
declare
  v integer;
begin
  loop
    v := (1 + floor(random() * 9))::int * 100 + (1 + floor(random() * 30))::int;  -- andar 1-9, quarto 01-30
    exit when not exists (select 1 from profiles where room_number = v);
  end loop;
  return v;
end $$;

update public.profiles set room_number = public.new_room_number() where room_number is null;

grant select (room_number, bio) on public.profiles to authenticated;
grant update (bio) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Tamanhos de quarto
-- -----------------------------------------------------------------------------

alter table public.rooms drop constraint if exists rooms_room_type_check;
alter table public.rooms add constraint rooms_room_type_check check (room_type in ('kitnet', 'studio', 'loft'));

create or replace function public.room_size(p_type text)
returns integer language sql immutable as $$
  select case p_type when 'loft' then 8 when 'studio' then 6 else 4 end;
$$;

-- Kit inicial para a Kitnet 4x4
create or replace function public.starter_furniture()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'uid', gen_random_uuid()::text, 'item_id', s.id,
           'x', k.x, 'y', k.y, 'rot', k.rot) order by k.ord), '[]'::jsonb)
  from (values
    ('bed_basic',   0, 0, 0, 1),   -- encostada na parede esquerda
    ('chair_basic', 3, 1, 0, 2),
    ('plant',       3, 3, 0, 3),
    ('rug',         1, 2, 0, 4)
  ) as k(asset, x, y, rot, ord)
  join shop_items s on s.asset_url = k.asset;
$$;

-- Contas existentes voltam para a Kitnet 4x4 (decisão do produto):
-- o que não cabe vai para o inventário.
update public.rooms r set
  room_type = 'kitnet',
  inventory_json = jsonb_set(r.inventory_json, '{furniture}', coalesce((
    select jsonb_agg(
      case when e->>'x' is null then e
           when exists (
             select 1 from public.furniture_tiles((e->>'x')::int, (e->>'y')::int, s.size_x, s.size_y, coalesce((e->>'rot')::int, 0)) t
             where t.tx >= 4 or t.ty >= 4)
           then e || '{"x":null,"y":null}'::jsonb
           else e end)
    from jsonb_array_elements(r.inventory_json->'furniture') e
    left join public.shop_items s on s.id = (e->>'item_id')::uuid
  ), '[]'::jsonb))
where r.room_type <> 'kitnet' or exists (
  select 1 from jsonb_array_elements(r.inventory_json->'furniture') e
  join public.shop_items s on s.id = (e->>'item_id')::uuid
  cross join lateral public.furniture_tiles((e->>'x')::int, (e->>'y')::int, s.size_x, s.size_y, coalesce((e->>'rot')::int, 0)) t
  where e->>'x' is not null and (t.tx >= 4 or t.ty >= 4)
);

-- Ampliar quarto
create or replace function public.upgrade_room(p_type text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_price integer := case p_type when 'studio' then 50 when 'loft' then 150 end;
  v_current text;
  v_coins integer;
  v_nick text;
begin
  if v_price is null then raise exception 'Quarto inválido.'; end if;
  select room_type into v_current from rooms where user_id = v_uid for update;
  if room_size(p_type) <= room_size(v_current) then raise exception 'Seu quarto já é desse tamanho ou maior.'; end if;
  select hotel_coins, nickname into v_coins, v_nick from profiles where id = v_uid for update;
  if v_coins < v_price then raise exception 'Moedas insuficientes.'; end if;

  update profiles set hotel_coins = hotel_coins - v_price where id = v_uid;
  update rooms set room_type = p_type where user_id = v_uid;
  insert into lobby_events (kind, message, actor_id)
  values ('upgrade', '🏗️ @' || v_nick || ' se mudou para um ' || case p_type when 'studio' then 'Studio 6x6' else 'Loft Master 8x8' end || '!', v_uid);
end $$;

-- move_furniture com o tamanho do quarto
create or replace function public.move_furniture(p_uid text, p_x integer, p_y integer, p_rot integer default 0)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_inv jsonb;
  v_size integer;
  v_type text;
  v_item shop_items%rowtype;
begin
  if p_rot not in (0, 1) then raise exception 'Rotação inválida.'; end if;
  select inventory_json, room_type into v_inv, v_type from rooms where user_id = auth.uid() for update;
  v_size := room_size(v_type);

  select s.* into v_item
  from jsonb_array_elements(v_inv->'furniture') e join shop_items s on s.id = (e->>'item_id')::uuid
  where e->>'uid' = p_uid;
  if not found then raise exception 'Móvel não encontrado.'; end if;

  if p_x is not null then
    if exists (select 1 from furniture_tiles(p_x, p_y, v_item.size_x, v_item.size_y, p_rot) t
               where t.tx < 0 or t.ty < 0 or t.tx >= v_size or t.ty >= v_size) then
      raise exception 'Não cabe aí — tente outro piso ou gire o móvel.';
    end if;
    if exists (
      select 1
      from jsonb_array_elements(v_inv->'furniture') e
      join shop_items s on s.id = (e->>'item_id')::uuid
      cross join lateral furniture_tiles((e->>'x')::int, (e->>'y')::int, s.size_x, s.size_y, coalesce((e->>'rot')::int, 0)) o
      join furniture_tiles(p_x, p_y, v_item.size_x, v_item.size_y, p_rot) n on n.tx = o.tx and n.ty = o.ty
      where e->>'uid' <> p_uid and e->>'x' is not null and s.layer = v_item.layer
    ) then
      raise exception 'Esse espaço já está ocupado.';
    end if;
  end if;

  select jsonb_set(v_inv, '{furniture}', coalesce(jsonb_agg(
           case when e->>'uid' = p_uid then e || jsonb_build_object('x', p_x, 'y', p_y, 'rot', p_rot) else e end), '[]'::jsonb))
    into v_inv
  from jsonb_array_elements(v_inv->'furniture') e;

  update rooms set inventory_json = v_inv where user_id = auth.uid();
end $$;

-- Cadastro: Kitnet 4x4 com kit, número do quarto
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nick text := lower(coalesce(nullif(v_meta->>'nickname', ''), 'hospede_' || substr(new.id::text, 1, 8)));
  v_room integer := new_room_number();
begin
  insert into profiles (id, nickname, full_name, pix_key, whatsapp, room_number)
  values (
    new.id, v_nick,
    coalesce(nullif(v_meta->>'full_name', ''), 'Hóspede'),
    nullif(v_meta->>'pix_key', ''),
    nullif(regexp_replace(coalesce(v_meta->>'whatsapp', ''), '\D', '', 'g'), ''),
    v_room
  );
  insert into rooms (user_id, room_type, inventory_json)
  values (new.id, 'kitnet',
          jsonb_build_object('furniture', starter_furniture(), 'wardrobe', '[]'::jsonb, 'upgrades', '[]'::jsonb));
  insert into lobby_events (kind, message, actor_id)
  values ('checkin', '🛎️ @' || v_nick || ' fez check-in no Quarto ' || v_room || '!', new.id);
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 3. Catálogo alinhado ao mockup
-- -----------------------------------------------------------------------------

insert into public.shop_items (name, category, section, price_coins, asset_url, size_x, size_y, layer, for_sale, sort_order) values
  ('Cama de Casal Estilizada', 'furniture', 'conforto', 60, 'bed_double', 2, 2, 'solid', true, 15)
on conflict (asset_url) do update set
  name = excluded.name, section = excluded.section, price_coins = excluded.price_coins,
  size_x = excluded.size_x, size_y = excluded.size_y, for_sale = true, sort_order = excluded.sort_order;

update public.shop_items set name = v.name, price_coins = v.price
from (values
  ('paint_texture', 'Pintura Texturizada / Tijolinho', 10),
  ('rug',           'Tapete Geométrico Pequeno',       20),
  ('lamp',          'Luminária de Chão Básica',        25),
  ('sofa_mode',     'Sofá Mode 2 Lugares',             45),
  ('stereo',        'Aparelho de Som / Boombox',       75),
  ('tv_plasma',     'TV de Plasma de Parede',          90),
  ('trophy_case',   'Estante de Troféus',             110),
  ('sunglasses',    'Óculos de Sol Retrô',             15)
) as v(asset, name, price)
where shop_items.asset_url = v.asset;

-- Remove "Cabelos Estilizados" (fora do catálogo novo), inclusive de guarda-roupas e avatares
do $$
declare
  v_id uuid;
begin
  select id into v_id from public.shop_items where asset_url = 'hair_styled';
  if v_id is null then return; end if;
  update public.rooms set inventory_json = jsonb_set(inventory_json, '{wardrobe}',
    coalesce((select jsonb_agg(w) from jsonb_array_elements_text(inventory_json->'wardrobe') w where w <> v_id::text), '[]'::jsonb));
  update public.profiles set avatar_config = avatar_config || '{"hair":"short"}'::jsonb
  where avatar_config->>'hair' in ('mohawk', 'curly', 'quiff');
  delete from public.shop_items where id = v_id;
end $$;

-- Volta a validação de avatar ao formato simples (sem cabelos premium)
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
  if new.bio is not null then new.bio := nullif(trim(new.bio), ''); end if;

  if new.avatar_config is distinct from old.avatar_config then
    if new.avatar_config->>'hair' in ('mohawk', 'curly', 'quiff') then
      raise exception 'Esse cabelo não está mais disponível.';
    end if;
    select inventory_json->'wardrobe' into v_wardrobe from rooms where user_id = new.id;
    for v_value in select value from jsonb_each_text(new.avatar_config) loop
      v_item := null;
      select id into v_item from shop_items where category = 'clothing' and asset_url = v_value;
      if v_item is not null and not coalesce(v_wardrobe ? v_item::text, false) then
        raise exception 'Você ainda não comprou este item premium: %', v_value;
      end if;
    end loop;
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 4. Categorias de apostas e despesas
-- -----------------------------------------------------------------------------

alter table public.bets_expenses add column if not exists category text;
update public.bets_expenses b set category = case
    when b.type = 'expense' then 'racha'
    when (select count(*) from public.bet_participants p where p.bet_id = b.id) > 2 then 'bolao'
    else 'aposta' end
where category is null;
alter table public.bets_expenses alter column category set not null;
alter table public.bets_expenses alter column category set default 'aposta';
alter table public.bets_expenses drop constraint if exists bets_expenses_category_check;
alter table public.bets_expenses add constraint bets_expenses_category_check check (
  (type = 'bet' and category in ('aposta', 'bolao')) or (type = 'expense' and category in ('racha', 'viagem'))
);

drop function if exists public.create_bet_expense(text, text, text, numeric, text, uuid, jsonb);

create or replace function public.create_bet_expense(
  p_type text,
  p_title text,
  p_description text,
  p_amount numeric,
  p_prize_text text,
  p_witness_id uuid,
  p_participants jsonb,
  p_category text default null
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
  v_category text;
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

  v_category := coalesce(p_category, case when p_type = 'expense' then 'racha'
                                          when jsonb_array_length(coalesce(p_participants, '[]')) > 1 then 'bolao'
                                          else 'aposta' end);
  if (p_type = 'bet' and v_category not in ('aposta', 'bolao'))
     or (p_type = 'expense' and v_category not in ('racha', 'viagem')) then
    raise exception 'Categoria inválida.';
  end if;

  insert into bets_expenses (creator_id, title, description, amount, prize_text, type, category, witness_id)
  values (v_uid, trim(p_title), nullif(trim(p_description), ''), p_amount,
          nullif(trim(p_prize_text), ''), p_type, v_category, p_witness_id)
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
  if v_category = 'aposta' and v_count > 1 then raise exception 'Aposta 1v1 é só contra uma pessoa. Use Bolão para grupo.'; end if;
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
          case v_category
            when 'aposta' then '🎲 @' || v_nick || ' desafiou ' || v_others || ' num 1v1: "' || trim(p_title) || '".'
            when 'bolao'  then '🎯 @' || v_nick || ' abriu o bolão "' || trim(p_title) || '" com ' || v_others || '.'
            when 'viagem' then '🧳 @' || v_nick || ' dividiu os custos da viagem "' || trim(p_title) || '".'
            else '🧾 @' || v_nick || ' abriu o racha "' || trim(p_title) || '" com ' || v_others || '.' end,
          v_uid);
  return v_bet;
end $$;

-- -----------------------------------------------------------------------------
-- 5. Ranking (por vitórias; desempate por taxa de vitória e antiguidade)
-- -----------------------------------------------------------------------------

create or replace function public.get_ranking(p_limit integer default 50)
returns table (user_id uuid, nickname text, wins bigint, decided bigint, win_rate numeric, rank bigint)
language sql stable security definer set search_path = public as $$
  with s as (
    select p.id, p.nickname, p.created_at,
           count(*) filter (where b.winner_id = p.id) as wins,
           count(*) filter (where b.winner_id is not null) as decided
    from profiles p
    join bet_participants bp on bp.user_id = p.id
    join bets_expenses b on b.id = bp.bet_id and b.type = 'bet'
    group by p.id
  )
  select id, nickname, wins, decided,
         case when decided = 0 then 0 else round(wins * 100.0 / decided, 1) end,
         rank() over (order by wins desc, (case when decided = 0 then 0 else wins::numeric / decided end) desc, created_at)
  from s
  where wins > 0
  order by 6
  limit p_limit;
$$;

create or replace function public.user_rank(p_user uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select rank from get_ranking(100000) where user_id = p_user;
$$;

create or replace function public.declare_winner(p_bet uuid, p_winner uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_bet bets_expenses%rowtype;
  v_nick text;
  v_before bigint;
  v_after bigint;
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

  v_before := user_rank(p_winner);
  update bets_expenses set winner_id = p_winner where id = p_bet;
  update bet_participants
     set paid_status = 'unpaid', creditor_id = p_winner, debt_since = now()
   where bet_id = p_bet and user_id <> p_winner;
  v_after := user_rank(p_winner);

  select nickname into v_nick from profiles where id = p_winner;
  insert into lobby_events (kind, message, actor_id)
  values ('winner', '🏆 @' || v_nick || ' ganhou ' ||
          case v_bet.category when 'bolao' then 'o bolão' else 'o 1v1' end || ' "' || v_bet.title || '".', p_winner);

  if v_after <= 3 and (v_before is null or v_before > 3) then
    insert into lobby_events (kind, message, actor_id)
    values ('ranking', '🏆 @' || v_nick || ' subiu para o Top 3 do ranking de apostadores do hotel.', p_winner);
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Moedas: +10 por quitação confirmada, teto de 100 por semana
-- -----------------------------------------------------------------------------

create or replace function public.confirm_payment(p_participant uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_row bet_participants%rowtype;
  v_bet bets_expenses%rowtype;
  v_week_start timestamptz := date_trunc('week', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
  v_earned integer;
  v_coins integer;
  v_debtor text;
  v_creditor text;
  v_on_time boolean;
  v_noun text;
begin
  select * into v_row from bet_participants where id = p_participant for update;
  if not found or v_row.creditor_id <> auth.uid() then raise exception 'Dívida não encontrada.'; end if;
  if v_row.paid_status <> 'marked_paid' then raise exception 'O devedor ainda não marcou como pago.'; end if;
  if v_row.user_id = v_row.creditor_id then raise exception 'Operação inválida.'; end if;
  select * into v_bet from bets_expenses where id = v_row.bet_id;

  select coalesce(sum(coins_awarded), 0) into v_earned
    from bet_participants where user_id = v_row.user_id and confirmed_at >= v_week_start;
  v_coins := greatest(0, least(10, 100 - v_earned));

  update bet_participants
     set paid_status = 'confirmed', confirmed_at = now(), coins_awarded = v_coins
   where id = p_participant;
  update profiles set hotel_coins = hotel_coins + v_coins where id = v_row.user_id;

  update bets_expenses b
     set status = case
           when not exists (select 1 from bet_participants where bet_id = b.id and paid_status in ('unpaid', 'marked_paid')) then 'settled'
           when exists (select 1 from bet_participants where bet_id = b.id and paid_status = 'marked_paid') then 'awaiting_approval'
           else 'pending' end
   where b.id = v_row.bet_id;

  select nickname into v_debtor from profiles where id = v_row.user_id;
  select nickname into v_creditor from profiles where id = v_row.creditor_id;
  v_on_time := v_row.marked_paid_at <= v_row.debt_since + interval '48 hours';
  v_noun := case v_bet.category when 'bolao' then 'um bolão' when 'viagem' then 'uma viagem' when 'racha' then 'um racha' else 'uma aposta' end;

  insert into lobby_events (kind, message, actor_id)
  values ('settled',
          case when v_coins > 0
               then '🪙 @' || v_debtor || ' recebeu ' || v_coins || ' Hotel Coins por pagar ' || v_noun || case when v_on_time then ' em dia.' else '.' end
               else '✅ @' || v_debtor || ' quitou ' || v_noun || ' com @' || v_creditor || '.' end,
          v_row.user_id);

  perform refresh_cleanliness(v_row.user_id);
  return v_coins;
end $$;

-- -----------------------------------------------------------------------------
-- 7. Índice de limpeza com aviso de baratas/dedetização
-- -----------------------------------------------------------------------------

create or replace function public.refresh_cleanliness(p_user uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  r record;
  v_new integer;
  v_nick text;
  v_owed numeric;
begin
  for r in
    select ro.user_id, ro.cleanliness_score as old_score,
           coalesce(max(extract(epoch from (now() - bp.debt_since - interval '48 hours')) / 3600.0)
                    filter (where bp.paid_status = 'unpaid' and bp.debt_since < now() - interval '48 hours'), 0) as overdue_hours,
           coalesce(sum(bp.share_amount)
                    filter (where bp.paid_status = 'unpaid' and bp.debt_since < now() - interval '48 hours'), 0) as overdue_amount
    from rooms ro
    left join bet_participants bp on bp.user_id = ro.user_id
    where p_user is null or ro.user_id = p_user
    group by ro.user_id, ro.cleanliness_score
  loop
    v_new := case when r.overdue_hours <= 0 then 100
                  else greatest(0, 100 - ceil(r.overdue_hours / 24.0)::int * 20) end;
    continue when v_new = r.old_score;

    update rooms set cleanliness_score = v_new where user_id = r.user_id;
    select nickname into v_nick from profiles where id = r.user_id;
    v_owed := r.overdue_amount;

    if r.old_score > 40 and v_new <= 40 then
      insert into lobby_events (kind, message, actor_id)
      values ('roaches', '🪳 Baratas foram vistas no quarto de @' || v_nick || '. ' ||
              case when v_owed > 0 then 'Faltam ' || 'R$ ' || replace(to_char(v_owed, 'FM999999990.00'), '.', ',') || ' para a dedetização.'
                   else 'Falta pagar a prenda para a dedetização.' end, r.user_id);
    elsif r.old_score = 100 and v_new < 100 then
      insert into lobby_events (kind, message, actor_id)
      values ('dirty', '🕷️ O quarto de @' || v_nick || ' acumulou teias de aranha por inadimplência!', r.user_id);
    elsif v_new = 100 then
      insert into lobby_events (kind, message, actor_id)
      values ('clean', '🧹 O quarto de @' || v_nick || ' está limpinho de novo!', r.user_id);
    end if;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- 8. Comprovantes aceitam PDF
-- -----------------------------------------------------------------------------

update storage.buckets
   set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']
 where id = 'proofs';

-- -----------------------------------------------------------------------------
-- 9. Permissões
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.nickname_available(text) to anon;
revoke execute on function public.purge_expired_proofs() from authenticated;
revoke execute on function public.new_room_number() from authenticated;

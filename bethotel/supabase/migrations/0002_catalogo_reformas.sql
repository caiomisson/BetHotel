-- =============================================================================
-- BetHotel — Migração 0002: catálogo novo, reformas, kit inicial e móveis grandes
-- Rode DEPOIS do 0001, no SQL Editor do Supabase. Pode ser executada de novo.
--
--   * Loja em 5 seções (Reformas, Básicas, Conforto & Lazer, Eletrônicos, Vestuário)
--   * Reformas: pintura simples (5), texturizada (10), lâmpada LED (10)
--     — compradas uma vez, troca de cor/textura à vontade
--   * Quarto novo vem com parede descascada, lâmpada piscando e kit inicial
--     (cama, cadeira, tapete pequeno e planta)
--   * Móveis podem ocupar vários pisos e girar
--   * Itens do catálogo antigo (Sofá Clássico, TV de Tubo, Fliperama, Jaqueta)
--     são apagados de vez, inclusive dos inventários
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Estrutura nova
-- -----------------------------------------------------------------------------

alter table public.shop_items add column if not exists section  text not null default 'basica';
alter table public.shop_items add column if not exists size_x   integer not null default 1;
alter table public.shop_items add column if not exists size_y   integer not null default 1;
alter table public.shop_items add column if not exists layer    text not null default 'solid';
alter table public.shop_items add column if not exists for_sale boolean not null default true;
alter table public.shop_items add column if not exists sort_order integer not null default 0;

alter table public.shop_items drop constraint if exists shop_items_category_check;
alter table public.shop_items add constraint shop_items_category_check
  check (category in ('furniture', 'clothing', 'renovation'));
alter table public.shop_items drop constraint if exists shop_items_section_check;
alter table public.shop_items add constraint shop_items_section_check
  check (section in ('reforma', 'basica', 'conforto', 'eletronicos', 'vestuario', 'inicial'));
alter table public.shop_items drop constraint if exists shop_items_layer_check;
alter table public.shop_items add constraint shop_items_layer_check check (layer in ('solid', 'floor'));
alter table public.shop_items drop constraint if exists shop_items_size_check;
alter table public.shop_items add constraint shop_items_size_check
  check (size_x between 1 and 3 and size_y between 1 and 3);

-- Aparência do quarto: parede descascada e lâmpada piscando até reformar
alter table public.rooms add column if not exists decor jsonb not null
  default '{"wall":"peeling","wallColor":"#d9cfb6","texture":"brick","light":"flicker"}'::jsonb;

-- -----------------------------------------------------------------------------
-- 2. Catálogo
-- -----------------------------------------------------------------------------

insert into public.shop_items (name, category, section, price_coins, asset_url, size_x, size_y, layer, for_sale, sort_order) values
  -- Reformas Iniciais
  ('Pintura Simples de Parede',        'renovation', 'reforma',      5, 'paint_simple',  1, 1, 'solid', true, 10),
  ('Pintura Texturizada / Papel',      'renovation', 'reforma',     10, 'paint_texture', 1, 1, 'solid', true, 20),
  ('Lâmpada de LED Decente',           'renovation', 'reforma',     10, 'led_lamp',      1, 1, 'solid', true, 30),
  -- Mobílias Básicas
  ('Planta Cacto / Yucca',             'furniture',  'basica',      15, 'plant',         1, 1, 'solid', true, 10),
  ('Tapete Pequeno',                   'furniture',  'basica',      20, 'rug',           1, 1, 'floor', true, 20),
  ('Luminária de Chão',                'furniture',  'basica',      25, 'lamp',          1, 1, 'solid', true, 30),
  ('Mesa de Centro',                   'furniture',  'basica',      25, 'table',         1, 1, 'solid', true, 40),
  ('Poltrona Confort',                 'furniture',  'basica',      30, 'armchair',      1, 1, 'solid', true, 50),
  -- Conforto & Lazer
  ('Sofá Mode',                        'furniture',  'conforto',    45, 'sofa_mode',     2, 1, 'solid', true, 10),
  ('Tapete Grande',                    'furniture',  'conforto',    50, 'rug_large',     2, 2, 'floor', true, 20),
  ('Estante de Livros',                'furniture',  'conforto',    55, 'bookshelf',     2, 1, 'solid', true, 30),
  ('Mesa de Reunião',                  'furniture',  'conforto',    70, 'meeting_table', 2, 1, 'solid', true, 40),
  -- Eletrônicos & Destaques
  ('Aparelho de Som',                  'furniture',  'eletronicos', 75, 'stereo',        1, 1, 'solid', true, 10),
  ('TV de Plasma',                     'furniture',  'eletronicos', 90, 'tv_plasma',     1, 1, 'solid', true, 20),
  ('Quadro de Estatísticas / Troféu',  'furniture',  'eletronicos',100, 'trophy_case',   1, 1, 'solid', true, 30),
  ('Máquina de Snacks',                'furniture',  'eletronicos',120, 'snack_machine', 1, 1, 'solid', true, 40),
  -- Vestuário & Aparência
  ('Óculos de Sol',                    'clothing',   'vestuario',   15, 'sunglasses',    1, 1, 'solid', true, 10),
  ('Boné Customizado',                 'clothing',   'vestuario',   20, 'cap',           1, 1, 'solid', true, 20),
  ('Cabelos Estilizados',              'clothing',   'vestuario',   35, 'hair_styled',   1, 1, 'solid', true, 30),
  ('Moletom com Capuz',                'clothing',   'vestuario',   40, 'hoodie',        1, 1, 'solid', true, 40),
  ('Coroa de Ouro Rara',               'clothing',   'vestuario',  250, 'crown',         1, 1, 'solid', true, 50),
  -- Kit inicial (não vendidos)
  ('Cama Básica',                      'furniture',  'inicial',      1, 'bed_basic',     1, 2, 'solid', false, 10),
  ('Cadeira Simples',                  'furniture',  'inicial',      1, 'chair_basic',   1, 1, 'solid', false, 20)
on conflict (asset_url) do update set
  name = excluded.name, category = excluded.category, section = excluded.section,
  price_coins = excluded.price_coins, size_x = excluded.size_x, size_y = excluded.size_y,
  layer = excluded.layer, for_sale = excluded.for_sale, sort_order = excluded.sort_order;

-- -----------------------------------------------------------------------------
-- 3. Apagar itens do catálogo antigo (inclusive de inventários e avatares)
-- -----------------------------------------------------------------------------

do $$
declare
  v_old uuid[];
begin
  select coalesce(array_agg(id), '{}') into v_old
  from public.shop_items where asset_url in ('sofa', 'tv', 'arcade', 'jacket');

  if array_length(v_old, 1) is null then return; end if;

  update public.rooms r set inventory_json = jsonb_build_object(
    'furniture', coalesce((select jsonb_agg(e) from jsonb_array_elements(r.inventory_json->'furniture') e
                           where not ((e->>'item_id')::uuid = any (v_old))), '[]'::jsonb),
    'wardrobe',  coalesce((select jsonb_agg(w) from jsonb_array_elements_text(r.inventory_json->'wardrobe') w
                           where not (w::uuid = any (v_old))), '[]'::jsonb),
    'upgrades',  coalesce(r.inventory_json->'upgrades', '[]'::jsonb)
  );

  update public.profiles set avatar_config = avatar_config || '{"shirt":"tshirt"}'::jsonb
  where avatar_config->>'shirt' = 'jacket';

  delete from public.shop_items where id = any (v_old);
end $$;

-- garante a chave 'upgrades' em todos os inventários
update public.rooms set inventory_json = inventory_json || '{"upgrades":[]}'::jsonb
where not (inventory_json ? 'upgrades');

-- -----------------------------------------------------------------------------
-- 4. Kit inicial (cama, cadeira, tapete pequeno, planta já posicionados)
-- -----------------------------------------------------------------------------

create or replace function public.starter_furniture()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'uid', gen_random_uuid()::text, 'item_id', s.id,
           'x', k.x, 'y', k.y, 'rot', k.rot) order by k.ord), '[]'::jsonb)
  from (values
    ('bed_basic',   0, 0, 0, 1),   -- encostada na parede esquerda
    ('plant',       5, 0, 0, 2),   -- canto da parede direita
    ('chair_basic', 3, 1, 0, 3),
    ('rug',         2, 3, 0, 4)
  ) as k(asset, x, y, rot, ord)
  join shop_items s on s.asset_url = k.asset;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_nick text := lower(coalesce(nullif(v_meta->>'nickname', ''), 'hospede_' || substr(new.id::text, 1, 8)));
begin
  insert into profiles (id, nickname, full_name, pix_key, whatsapp)
  values (
    new.id, v_nick,
    coalesce(nullif(v_meta->>'full_name', ''), 'Hóspede'),
    nullif(v_meta->>'pix_key', ''),
    nullif(regexp_replace(coalesce(v_meta->>'whatsapp', ''), '\D', '', 'g'), '')
  );
  insert into rooms (user_id, room_type, inventory_json)
  values (new.id, 'kitnet',
          jsonb_build_object('furniture', starter_furniture(), 'wardrobe', '[]'::jsonb, 'upgrades', '[]'::jsonb));
  insert into lobby_events (kind, message, actor_id)
  values ('checkin', '🛎️ @' || v_nick || ' fez check-in na sua Kitnet!', new.id);
  return new;
end $$;

-- Contas já existentes: quarto vazio ganha o kit posicionado; os demais recebem
-- o kit guardado no inventário (para não sobrepor o que já foi decorado).
update public.rooms r set inventory_json = jsonb_set(r.inventory_json, '{furniture}', starter_furniture())
where jsonb_array_length(coalesce(r.inventory_json->'furniture', '[]'::jsonb)) = 0;

update public.rooms r set inventory_json = jsonb_set(r.inventory_json, '{furniture}',
  (r.inventory_json->'furniture') || (
    select jsonb_agg(e || '{"x":null,"y":null}'::jsonb) from jsonb_array_elements(starter_furniture()) e))
where not exists (
  select 1 from jsonb_array_elements(r.inventory_json->'furniture') e
  join shop_items s on s.id = (e->>'item_id')::uuid where s.asset_url = 'bed_basic'
);

-- -----------------------------------------------------------------------------
-- 5. Loja: compra de móveis, roupas e reformas
-- -----------------------------------------------------------------------------

create or replace function public.buy_item(p_item uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_item shop_items%rowtype;
  v_coins integer;
  v_inv jsonb;
  v_decor jsonb;
  v_nick text;
begin
  select * into v_item from shop_items where id = p_item and for_sale;
  if not found then raise exception 'Item não encontrado.'; end if;

  select hotel_coins, nickname into v_coins, v_nick from profiles where id = v_uid for update;
  if v_coins < v_item.price_coins then raise exception 'Moedas insuficientes.'; end if;

  select inventory_json, decor into v_inv, v_decor from rooms where user_id = v_uid for update;

  if v_item.category = 'clothing' then
    if coalesce(v_inv->'wardrobe', '[]'::jsonb) ? v_item.id::text then
      raise exception 'Você já tem este item.';
    end if;
    v_inv := jsonb_set(v_inv, '{wardrobe}', coalesce(v_inv->'wardrobe', '[]'::jsonb) || to_jsonb(v_item.id::text));

  elsif v_item.category = 'renovation' then
    if coalesce(v_inv->'upgrades', '[]'::jsonb) ? v_item.asset_url then
      raise exception 'Essa reforma já foi feita.';
    end if;
    v_inv := jsonb_set(v_inv, '{upgrades}', coalesce(v_inv->'upgrades', '[]'::jsonb) || to_jsonb(v_item.asset_url));
    -- aplica a reforma na hora
    v_decor := case v_item.asset_url
      when 'paint_simple'  then v_decor || jsonb_build_object('wall', 'paint',
                                  'wallColor', case when v_decor->>'wall' = 'peeling' then '#e8dcc0' else v_decor->>'wallColor' end)
      when 'paint_texture' then v_decor || jsonb_build_object('wall', 'texture', 'texture', 'brick',
                                  'wallColor', case when v_decor->>'wall' = 'peeling' then '#c9795a' else v_decor->>'wallColor' end)
      when 'led_lamp'      then v_decor || '{"light":"led"}'::jsonb
      else v_decor end;

  else
    v_inv := jsonb_set(v_inv, '{furniture}', coalesce(v_inv->'furniture', '[]'::jsonb)
             || jsonb_build_object('uid', gen_random_uuid()::text, 'item_id', v_item.id, 'x', null, 'y', null, 'rot', 0));
  end if;

  update rooms set inventory_json = v_inv, decor = v_decor where user_id = v_uid;
  update profiles set hotel_coins = hotel_coins - v_item.price_coins where id = v_uid;

  insert into lobby_events (kind, message, actor_id)
  values ('purchase',
          case when v_item.category = 'renovation' then '🔨 @' || v_nick || ' reformou a Kitnet: ' || v_item.name || '!'
               else '🛍️ @' || v_nick || ' comprou ' || v_item.name || ' na loja!' end,
          v_uid);
end $$;

-- Troca cor/textura da parede (depois de comprar a reforma correspondente)
create or replace function public.set_decor(p_wall text, p_color text, p_texture text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_up jsonb;
begin
  select coalesce(inventory_json->'upgrades', '[]'::jsonb) into v_up from rooms where user_id = auth.uid();
  if p_color !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Cor inválida.'; end if;

  if p_wall = 'paint' then
    if not (v_up ? 'paint_simple' or v_up ? 'paint_texture') then raise exception 'Compre a Pintura Simples primeiro.'; end if;
    update rooms set decor = decor || jsonb_build_object('wall', 'paint', 'wallColor', lower(p_color)) where user_id = auth.uid();
  elsif p_wall = 'texture' then
    if not (v_up ? 'paint_texture') then raise exception 'Compre a Pintura Texturizada primeiro.'; end if;
    if p_texture not in ('brick', 'relief') then raise exception 'Textura inválida.'; end if;
    update rooms set decor = decor || jsonb_build_object('wall', 'texture', 'texture', p_texture, 'wallColor', lower(p_color))
    where user_id = auth.uid();
  else
    raise exception 'Opção de parede inválida.';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- 6. Móveis com vários pisos e rotação
-- -----------------------------------------------------------------------------

-- Pisos ocupados por um móvel (rot = 1 troca largura e profundidade)
create or replace function public.furniture_tiles(p_x int, p_y int, p_sx int, p_sy int, p_rot int)
returns table (tx int, ty int) language sql immutable as $$
  select p_x + i, p_y + j
  from generate_series(0, (case when p_rot = 1 then p_sy else p_sx end) - 1) i,
       generate_series(0, (case when p_rot = 1 then p_sx else p_sy end) - 1) j;
$$;

drop function if exists public.move_furniture(text, integer, integer);

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
  v_size := case v_type when 'kitnet' then 6 else 6 end;

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

-- -----------------------------------------------------------------------------
-- 7. Avatar: valida itens premium (inclui os 3 cabelos estilizados)
-- -----------------------------------------------------------------------------

create or replace function public.profiles_before_update()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_wardrobe jsonb;
  v_value text;
  v_asset text;
  v_item uuid;
begin
  new.nickname := lower(new.nickname);
  if new.whatsapp is not null then
    new.whatsapp := nullif(regexp_replace(new.whatsapp, '\D', '', 'g'), '');
  end if;

  if new.avatar_config is distinct from old.avatar_config then
    select inventory_json->'wardrobe' into v_wardrobe from rooms where user_id = new.id;
    for v_value in select value from jsonb_each_text(new.avatar_config) loop
      v_asset := case when v_value in ('mohawk', 'curly', 'quiff') then 'hair_styled' else v_value end;
      v_item := null;
      select id into v_item from shop_items where category = 'clothing' and asset_url = v_asset;
      if v_item is not null and not coalesce(v_wardrobe ? v_item::text, false) then
        raise exception 'Você ainda não comprou este item premium: %', v_value;
      end if;
    end loop;
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- 8. Permissões das funções novas
-- -----------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
grant execute on function public.nickname_available(text) to anon;
revoke execute on function public.purge_expired_proofs() from authenticated;

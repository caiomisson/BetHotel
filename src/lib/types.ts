// Tipos de domínio do BetHotel (espelham o schema em supabase/migrations)

export type HairStyle = "short" | "long" | "spiky" | "bald";
export type ShirtStyle = "tshirt" | "tank" | "hoodie";
export type PantsStyle = "jeans" | "shorts";
export type HatStyle = "none" | "cap" | "crown";
export type GlassesStyle = "none" | "sunglasses";
/** Biotipo do avatar. */
export type BodyType = "normal" | "gordo";

export interface AvatarConfig {
  skin: string;
  hair: HairStyle;
  hairColor: string;
  shirt: ShirtStyle;
  shirtColor: string;
  pants: PantsStyle;
  pantsColor: string;
  hat: HatStyle;
  /** Cor do Boné Customizado. */
  hatColor?: string;
  glasses?: GlassesStyle;
  body?: BodyType;
}

/** Colunas liberadas para leitura pública (Pix/WhatsApp ficam protegidos). */
export const PUBLIC_PROFILE_COLUMNS = "id,nickname,full_name,avatar_config,hotel_coins,room_number,bio,created_at";

export interface PublicProfile {
  id: string;
  nickname: string;
  full_name: string;
  avatar_config: AvatarConfig;
  hotel_coins: number;
  room_number: number | null;
  bio: string | null;
  created_at: string;
}

export interface MyProfile extends PublicProfile {
  pix_key: string | null;
  whatsapp: string | null;
}

export interface ContactInfo {
  full_name: string;
  nickname: string;
  pix_key: string | null;
  whatsapp: string | null;
}

export interface FurniturePlacement {
  uid: string;
  item_id: string;
  x: number | null;
  y: number | null;
  /** 0 = original, 1 = girado 90° (troca largura e profundidade). */
  rot?: 0 | 1;
}

export interface RoomInventory {
  furniture: FurniturePlacement[];
  wardrobe: string[];
  /** asset_url das reformas compradas (paint_simple, paint_texture, led_lamp). */
  upgrades?: string[];
}

export type WallStyle = "peeling" | "paint" | "texture";
export type WallTexture = "brick" | "relief";

export interface RoomDecor {
  wall: WallStyle;
  wallColor: string;
  texture: WallTexture;
  light: "flicker" | "led";
}

export interface Room {
  id: string;
  user_id: string;
  room_type: string;
  cleanliness_score: number;
  inventory_json: RoomInventory;
  decor: RoomDecor;
  created_at: string;
}

export type ShopCategory = "furniture" | "clothing" | "renovation";
export type ShopSection = "reforma" | "basica" | "conforto" | "eletronicos" | "vestuario" | "inicial" | "premio";
/** solid = móvel de chão · floor = tapete · wall = parede · table = em cima de mesa */
export type ItemLayer = "solid" | "floor" | "wall" | "table";

export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  section: ShopSection;
  price_coins: number;
  asset_url: string;
  size_x: number;
  size_y: number;
  layer: ItemLayer;
  for_sale: boolean;
  sort_order: number;
  /** Altura do tampo, para mesas que aceitam itens em cima. */
  surface_z: number | null;
}

export type BetType = "bet" | "expense";
/** aposta = 1v1, bolao = coletiva (definido pelo número de participantes) */
export type BetCategory = "aposta" | "bolao";
export type BetStatus = "awaiting_acceptance" | "active" | "pending" | "awaiting_approval" | "settled" | "draw" | "cancelled";
export type PaidStatus = "unpaid" | "marked_paid" | "confirmed";

export interface BetParticipant {
  id: string;
  bet_id: string;
  user_id: string;
  invite_status: "pending" | "accepted";
  result: "win" | "loss" | null;
  cancel_vote: boolean;
}

export interface Bet {
  id: string;
  creator_id: string;
  title: string;
  amount: number;
  type: BetType;
  category: BetCategory;
  status: BetStatus;
  ends_at: string | null;
  resolved_at: string | null;
  created_at: string;
  bet_participants: BetParticipant[];
}

/** Cobrança gerada por aposta ou evento (validação dupla). */
export interface Debt {
  id: string;
  bet_id: string | null;
  event_id: string | null;
  title: string;
  debtor_id: string;
  creditor_id: string;
  amount: number | null;
  paid_status: PaidStatus;
  debt_since: string;
  marked_paid_at: string | null;
  confirmed_at: string | null;
  coins_awarded: number;
  /** Coins que o credor ganha ao confirmar (só apostas). */
  creditor_coins: number | null;
  proof_image_url: string | null;
  created_at: string;
}

export type EventKind = "viagem" | "churrasco" | "festa" | "reveillon" | "carnaval" | "outro";
export type MemberStatus = "invited" | "accepted" | "declined" | "left";

export interface EventMember {
  event_id: string;
  user_id: string;
  status: MemberStatus;
  coins_awarded?: number;
  coins_at?: string | null;
}

export interface EventSplit {
  expense_id: string;
  user_id: string;
  share_amount: number;
}

export interface EventExpense {
  id: string;
  event_id: string;
  payer_id: string;
  amount: number;
  description: string | null;
  created_by: string;
  created_at: string;
  event_expense_splits: EventSplit[];
}

export interface HotelEvent {
  id: string;
  name: string;
  kind: EventKind;
  creator_id: string;
  status: "open" | "closed";
  created_at: string;
  closed_at: string | null;
  event_members: EventMember[];
  event_expenses: EventExpense[];
}

export interface Achievement {
  code: string;
  title: string;
  rule: string;
  group: "evento" | "aposta";
  item_name: string;
  item_asset: string;
  current: number;
  target: number;
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface Mention {
  id: string;
  nickname: string;
}

export interface ChatMessage {
  id: number;
  user_id: string;
  message: string;
  mentions_json: Mention[];
  created_at: string;
}

export interface LobbyEvent {
  id: number;
  kind: string;
  message: string;
  actor_id: string | null;
  created_at: string;
}

export interface PaymentHistoryEntry {
  confirmed_at: string;
  direction: "paid" | "received";
  amount: number | null;
  prize_text: string | null;
  type: BetType;
  counterpart: string | null;
}

export interface UserStats {
  total_bets: number;
  wins: number;
  decided_bets: number;
  win_rate: number;
  volume: number;
  overdue_count: number;
  open_debts: number;
  is_compliant: boolean;
  cleanliness_score: number;
  history: PaymentHistoryEntry[];
}

export type RoomType = "kitnet" | "studio" | "loft";

/** Hóspede como aparece em listas (chat, diretório, menções). */
export interface NickEntry {
  id: string;
  nickname: string;
  full_name: string;
  avatar_config: AvatarConfig;
  room_number: number | null;
  bio: string | null;
}

export interface RankingEntry {
  user_id: string;
  nickname: string;
  wins: number;
  decided: number;
  win_rate: number;
  rank: number;
}

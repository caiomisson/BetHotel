// Tipos de domínio do BetHotel (espelham o schema em supabase/migrations)

export type HairStyle = "short" | "long" | "spiky" | "bald";
export type ShirtStyle = "tshirt" | "tank" | "hoodie";
export type PantsStyle = "jeans" | "shorts";
export type HatStyle = "none" | "cap" | "crown";
export type GlassesStyle = "none" | "sunglasses";

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
export type ShopSection = "reforma" | "basica" | "conforto" | "eletronicos" | "vestuario" | "inicial";

export interface ShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  section: ShopSection;
  price_coins: number;
  asset_url: string;
  size_x: number;
  size_y: number;
  layer: "solid" | "floor";
  for_sale: boolean;
  sort_order: number;
}

export type BetType = "bet" | "expense";
/** aposta = 1v1, bolao = grupo, racha = despesa compartilhada, viagem = custos de viagem */
export type BetCategory = "aposta" | "bolao" | "racha" | "viagem";
export type BetStatus = "pending" | "awaiting_approval" | "settled";
export type PaidStatus = "not_due" | "unpaid" | "marked_paid" | "confirmed";

export interface BetParticipant {
  id: string;
  bet_id: string;
  user_id: string;
  role: "participant" | "creditor";
  share_amount: number | null;
  paid_status: PaidStatus;
  creditor_id: string | null;
  debt_since: string | null;
  marked_paid_at: string | null;
  confirmed_at: string | null;
  coins_awarded: number;
  proof_image_url: string | null;
  proof_expires_at: string | null;
}

export interface BetExpense {
  id: string;
  creator_id: string;
  title: string;
  description: string | null;
  amount: number | null;
  prize_text: string | null;
  type: BetType;
  category: BetCategory;
  status: BetStatus;
  witness_id: string | null;
  winner_id: string | null;
  proof_image_url: string | null;
  proof_expires_at: string | null;
  created_at: string;
  bet_participants: BetParticipant[];
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

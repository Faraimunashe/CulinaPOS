import type { UserRole, UserStatus } from './user';

export type TrackingType = 'RECIPE' | 'DIRECT';

export type StockMovementType = 'PURCHASE' | 'SALE' | 'ADJUSTMENT';

export type InventoryUnit = 'kg' | 'grams' | 'litres' | 'ml' | 'units';

export type InventoryItemKind = 'INGREDIENT' | 'RETAIL';

export const INVENTORY_UNITS: InventoryUnit[] = [
  'kg',
  'grams',
  'litres',
  'ml',
  'units',
];

export const COMMON_PACK_SIZES = [1, 6, 12, 24] as const;

export const ADJUSTMENT_REASONS = [
  'Spoilage',
  'Damage',
  'Stock count correction',
  'Wastage',
  'Other',
] as const;

export type AdjustmentReason = (typeof ADJUSTMENT_REASONS)[number];

export interface Category {
  id: number;
  name: string;
  sort_order: number;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface Currency {
  id: number;
  name: string;
  symbol: string;
  enabled: number;
  rate_to_primary: number;
}

export interface ConvertedPrice {
  currency_id: number;
  currency_name: string;
  currency_symbol: string;
  rate_to_primary: number;
  price: number;
  is_primary: boolean;
}

export interface InventoryItem {
  id: number;
  name: string;
  unit: InventoryUnit;
  quantity: number;
  minimum_quantity: number;
  cost: number;
  pack_size: number;
  item_kind: InventoryItemKind;
  created_at: string;
  updated_at: string;
  linked_product_id?: number | null;
  linked_product_name?: string | null;
}

export interface StockMovement {
  id: number;
  inventory_item_id: number;
  movement_type: StockMovementType;
  quantity_before: number;
  quantity_change: number;
  quantity_after: number;
  reason: string | null;
  user_id: number | null;
  order_id: number | null;
  created_at: string;
  item_name?: string;
  user_name?: string | null;
}

export interface RecipeItem {
  id: number;
  recipe_id: number;
  inventory_item_id: number;
  quantity: number;
  inventory_name?: string;
  inventory_unit?: InventoryUnit;
  inventory_quantity?: number;
}

export interface Recipe {
  id: number;
  product_id: number;
  created_at: string;
  updated_at: string;
  items: RecipeItem[];
}

export interface Product {
  id: number;
  name: string;
  category_id: number | null;
  description: string | null;
  tracking_type: TrackingType;
  active: number;
  base_price: number;
  inventory_item_id: number | null;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  inventory_item_name?: string | null;
  inventory_quantity?: number | null;
  inventory_pack_size?: number | null;
  inventory_unit?: InventoryUnit | null;
  prices?: ConvertedPrice[];
}

export interface CreateUserInput {
  full_name: string;
  username: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  full_name: string;
  username: string;
  role: UserRole;
}

export interface CategoryInput {
  name: string;
  sort_order: number;
  active: boolean;
}

export interface ProductInput {
  name: string;
  category_id: number | null;
  description: string;
  tracking_type: TrackingType;
  active: boolean;
  base_price: number;
  inventory_item_id: number | null;
  retail_stock?: {
    pack_size: number;
    opening_quantity?: number;
    minimum_quantity: number;
  };
}

export interface InventoryItemInput {
  name: string;
  unit: InventoryUnit;
  quantity: number;
  minimum_quantity: number;
  cost: number;
  pack_size: number;
  item_kind: InventoryItemKind;
}

export interface RecipeItemInput {
  inventory_item_id: number;
  quantity: number;
}

export * from './user';

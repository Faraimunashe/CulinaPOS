import { getDatabase } from '@/database';
import { writeAuditLog } from '@/services/auditService';
import { toIsoNow } from '@/utils/format';
import type { Recipe, RecipeItem, RecipeItemInput } from '@/types';

export async function getRecipeForProduct(
  productId: number
): Promise<Recipe | null> {
  const db = await getDatabase();
  const recipe = await db.getFirstAsync<Omit<Recipe, 'items'>>(
    'SELECT * FROM recipes WHERE product_id = ?',
    productId
  );
  if (!recipe) return null;

  const items = await db.getAllAsync<RecipeItem>(
    `SELECT ri.*,
            i.name as inventory_name,
            i.unit as inventory_unit,
            i.quantity as inventory_quantity
     FROM recipe_items ri
     INNER JOIN inventory_items i ON i.id = ri.inventory_item_id
     WHERE ri.recipe_id = ?
     ORDER BY i.name COLLATE NOCASE ASC`,
    recipe.id
  );

  return { ...recipe, items };
}

export async function saveRecipeForProduct(
  productId: number,
  items: RecipeItemInput[],
  actorId: number
): Promise<Recipe> {
  if (!items.length) {
    throw new Error('Add at least one ingredient to the recipe');
  }

  const seen = new Set<number>();
  for (const item of items) {
    if (seen.has(item.inventory_item_id)) {
      throw new Error('Each ingredient can only appear once in a recipe');
    }
    seen.add(item.inventory_item_id);
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      throw new Error('Ingredient quantities must be greater than zero');
    }
  }

  const db = await getDatabase();
  const product = await db.getFirstAsync<{
    id: number;
    name: string;
    tracking_type: string;
  }>('SELECT id, name, tracking_type FROM products WHERE id = ?', productId);

  if (!product) throw new Error('Product not found');
  if (product.tracking_type !== 'RECIPE') {
    throw new Error('Recipes are only for recipe-based products');
  }

  for (const item of items) {
    const inv = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM inventory_items WHERE id = ?',
      item.inventory_item_id
    );
    if (!inv) throw new Error('One or more ingredients no longer exist');
  }

  const now = toIsoNow();
  let recipe = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM recipes WHERE product_id = ?',
    productId
  );

  if (!recipe) {
    const result = await db.runAsync(
      `INSERT INTO recipes (product_id, created_at, updated_at) VALUES (?, ?, ?)`,
      productId,
      now,
      now
    );
    recipe = { id: Number(result.lastInsertRowId) };
  } else {
    await db.runAsync(
      'UPDATE recipes SET updated_at = ? WHERE id = ?',
      now,
      recipe.id
    );
  }

  await db.runAsync('DELETE FROM recipe_items WHERE recipe_id = ?', recipe.id);

  for (const item of items) {
    await db.runAsync(
      `INSERT INTO recipe_items (recipe_id, inventory_item_id, quantity)
       VALUES (?, ?, ?)`,
      recipe.id,
      item.inventory_item_id,
      item.quantity
    );
  }

  await writeAuditLog({
    userId: actorId,
    action: 'RECIPE_SAVE',
    entityType: 'product',
    entityId: productId,
    details: {
      product: product.name,
      ingredient_count: items.length,
    },
  });

  const saved = await getRecipeForProduct(productId);
  if (!saved) throw new Error('Failed to save recipe');
  return saved;
}

export async function deleteRecipeForProduct(
  productId: number,
  actorId: number
): Promise<void> {
  const db = await getDatabase();
  const recipe = await db.getFirstAsync<{ id: number }>(
    'SELECT id FROM recipes WHERE product_id = ?',
    productId
  );
  if (!recipe) return;

  await db.runAsync('DELETE FROM recipe_items WHERE recipe_id = ?', recipe.id);
  await db.runAsync('DELETE FROM recipes WHERE id = ?', recipe.id);

  await writeAuditLog({
    userId: actorId,
    action: 'RECIPE_DELETE',
    entityType: 'product',
    entityId: productId,
  });
}

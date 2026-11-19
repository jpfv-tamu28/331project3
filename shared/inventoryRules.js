// Inventory rules shared by the API and the React app so low-stock checks and
// reorder target calculations stay in sync.

export const REORDER_MULTIPLIER = 3;

export const isLowStock = (item) => Number(item.onHand) <= Number(item.reorderLevel);

export const canReorder = (item) => isLowStock(item) && Number(item.reorderLevel) > 0;

export const reorderTarget = (reorderLevel) => Number((Number(reorderLevel) * REORDER_MULTIPLIER).toFixed(2));

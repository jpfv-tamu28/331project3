import { useState } from 'react';
import { Api, errorMessage } from '../api';
import { DenseList } from '../components/DenseList';
import { Modal } from '../components/Modal';
import { StateMessage } from '../components/StateMessage';
import { useResource } from '../components/useResource';
import { useToast } from '../components/ToastProvider';
import { quantity } from '../format';
import { REORDER_MULTIPLIER, canReorder, isLowStock, reorderTarget } from '../../../shared/inventoryRules.js';

const UNITS = ['g', 'ml', 'each'];
const LOW = 'Below reorder level';

const FILTERS = [
  { label: 'All', test: () => true },
  { label: 'Low stock', test: isLowStock },
];

const describe = (i) => ({
  title: i.name,
  subtitle: `Updated ${i.updatedAt} · #${i.id}`,
  value: `${quantity(i.onHand)} ${i.unit}`,
  detail: canReorder(i)
    ? `reorder at ${quantity(i.reorderLevel)} · restocks to ${quantity(reorderTarget(i.reorderLevel))}`
    : `reorder at ${quantity(i.reorderLevel)}`,
  badge: isLowStock(i) ? { text: 'Low stock', alert: true } : null,
});

export default function InventoryTab({ refreshKey }) {
  const toast = useToast();
  const inventory = useResource(() => Api.inventory(), [refreshKey]);
  const [editing, setEditing] = useState(null);
  const [reorderingIds, setReorderingIds] = useState(() => new Set());
  const [reorderingAll, setReorderingAll] = useState(false);

  if (!inventory.data) {
    return <StateMessage loading={inventory.loading} error={inventory.error} onRetry={inventory.reload} />;
  }

  const lowReorderableCount = inventory.data.filter(canReorder).length;

  const reorderOne = async (item) => {
    if (reorderingAll || reorderingIds.has(item.id) || !canReorder(item)) return;
    setReorderingIds((prev) => new Set(prev).add(item.id));
    try {
      const updated = await Api.reorderIngredient(item.id);
      toast.success('Ingredient reordered', `${updated.name} set to ${quantity(updated.onHand)} ${updated.unit}.`);
      inventory.reload();
    } catch (err) {
      toast.error('Error reordering ingredient', errorMessage(err));
      if (err?.response?.status === 404 || err?.response?.status === 409) {
        inventory.reload();
      }
    } finally {
      setReorderingIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const reorderAll = async () => {
    if (reorderingAll || reorderingIds.size > 0 || lowReorderableCount === 0) return;
    setReorderingAll(true);
    try {
      const result = await Api.reorderLowInventory();
      if (result.count === 0) {
        toast.info('Nothing to reorder', 'All ingredients with a reorder level are already in stock.');
      } else if (result.count === 1) {
        const item = result.items[0];
        toast.success('Low stock reordered', `${item.name} set to ${quantity(item.onHand)} ${item.unit}.`);
      } else {
        toast.success('Low stock reordered', `Updated ${result.count} ingredients to ${REORDER_MULTIPLIER}× their reorder level.`);
      }
      inventory.reload();
    } catch (err) {
      toast.error('Error reordering inventory', errorMessage(err));
    } finally {
      setReorderingAll(false);
    }
  };

  return (
    <>
      <DenseList
        items={inventory.data}
        searchLabel="Search ingredients"
        filters={FILTERS}
        groupOf={(i) => (isLowStock(i) ? LOW : 'In stock')}
        pinnedGroups={[LOW]}
        describe={describe}
        onOpen={setEditing}
        noun="ingredient"
        actions={(
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={reorderingAll || reorderingIds.size > 0 || lowReorderableCount === 0}
              onClick={reorderAll}
              title={
                lowReorderableCount > 0
                  ? `Set ${lowReorderableCount} low-stock ${lowReorderableCount === 1 ? 'ingredient' : 'ingredients'} to ${REORDER_MULTIPLIER}× reorder level`
                  : 'No low-stock ingredients with a reorder level above 0'
              }
            >
              {reorderingAll
                ? 'Reordering…'
                : lowReorderableCount > 0
                  ? `Reorder All Low Stock (${lowReorderableCount})`
                  : 'Reorder All Low Stock'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>Add Ingredient</button>
          </>
        )}
        rowActions={(item) => {
          if (!isLowStock(item)) return null;
          const busy = reorderingIds.has(item.id);
          const allowed = canReorder(item);
          const targetLabel = `${quantity(reorderTarget(item.reorderLevel))} ${item.unit}`;
          return (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={reorderingAll || busy || !allowed}
              onClick={() => reorderOne(item)}
              title={allowed ? `Set on hand to ${targetLabel}` : 'Set a reorder level above 0 to reorder'}
              aria-label={allowed ? `Reorder ${item.name} to ${targetLabel}` : `Reorder ${item.name} unavailable`}
            >
              {busy ? 'Reordering…' : 'Reorder'}
            </button>
          );
        }}
      />
      {editing && (
        <IngredientDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            inventory.reload();
          }}
        />
      )}
    </>
  );
}

const parseAmount = (text) => {
  const n = Number(String(text).trim());
  return String(text).trim() !== '' && Number.isFinite(n) && n >= 0 ? n : null;
};

function IngredientDialog({ item, onClose, onSaved }) {
  const toast = useToast();
  const editingId = item.id ?? null;
  const [name, setName] = useState(item.name ?? '');
  const [unit, setUnit] = useState(item.unit ?? UNITS[0]);
  const [onHand, setOnHand] = useState(item.onHand != null ? String(item.onHand) : '');
  const [reorderLevel, setReorderLevel] = useState(item.reorderLevel != null ? String(item.reorderLevel) : '');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.warning('Missing ingredient', 'Ingredient is required.');
      return;
    }
    const onHandQty = parseAmount(onHand);
    const reorderQty = parseAmount(reorderLevel);
    if (onHandQty === null || reorderQty === null) {
      toast.warning('Check the amounts', 'On hand and reorder level must be non-negative numbers.');
      return;
    }
    setBusy(true);
    try {
      await Api.saveIngredient(editingId, { name: name.trim(), unit, onHand: onHandQty, reorderLevel: reorderQty });
      toast.success(editingId ? 'Ingredient updated' : 'Ingredient added', name.trim());
      onSaved();
    } catch (err) {
      toast.error('Error saving ingredient', errorMessage(err));
      setBusy(false);
    }
  };

  // Units the Java form didn't offer (from older data) stay selectable when editing.
  const unitOptions = UNITS.includes(unit) ? UNITS : [...UNITS, unit];
  return (
    <Modal title={editingId ? 'Edit Ingredient' : 'Add Ingredient'} submitLabel="Save" onSubmit={save} onClose={onClose} busy={busy}>
      <div className="form-grid">
        <label htmlFor="in-name">Ingredient</label>
        <input id="in-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="in-unit">Unit</label>
        <select id="in-unit" className="field" value={unit} onChange={(e) => setUnit(e.target.value)}>
          {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
        </select>
        <label htmlFor="in-onhand">On Hand</label>
        <input id="in-onhand" className="field" inputMode="decimal" value={onHand} onChange={(e) => setOnHand(e.target.value)} />
        <label htmlFor="in-reorder">Reorder Level</label>
        <input id="in-reorder" className="field" inputMode="decimal" value={reorderLevel}
          onChange={(e) => setReorderLevel(e.target.value)} />
      </div>
    </Modal>
  );
}

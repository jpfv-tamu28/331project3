import { useState } from 'react';
import { Api, errorMessage } from '../api';
import { DenseList } from '../components/DenseList';
import { Modal } from '../components/Modal';
import { StateMessage } from '../components/StateMessage';
import { useResource } from '../components/useResource';
import { useToast } from '../components/ToastProvider';
import { quantity } from '../format';

const UNITS = ['g', 'ml', 'each'];
const LOW = 'Below reorder level';
const isLow = (i) => i.onHand <= i.reorderLevel;

const FILTERS = [
  { label: 'All', test: () => true },
  { label: 'Low stock', test: isLow },
];

const describe = (i) => ({
  title: i.name,
  subtitle: `Updated ${i.updatedAt} · #${i.id}`,
  value: `${quantity(i.onHand)} ${i.unit}`,
  detail: `reorder at ${quantity(i.reorderLevel)}`,
  badge: isLow(i) ? { text: 'Low stock', alert: true } : null,
});

export default function InventoryTab({ refreshKey }) {
  const inventory = useResource(() => Api.inventory(), [refreshKey]);
  const [editing, setEditing] = useState(null);

  if (!inventory.data) {
    return <StateMessage loading={inventory.loading} error={inventory.error} onRetry={inventory.reload} />;
  }
  return (
    <>
      <DenseList
        items={inventory.data}
        searchLabel="Search ingredients"
        filters={FILTERS}
        groupOf={(i) => (isLow(i) ? LOW : 'In stock')}
        pinnedGroups={[LOW]}
        describe={describe}
        onOpen={setEditing}
        noun="ingredient"
        actions={<button type="button" className="btn btn-primary" onClick={() => setEditing({})}>Add Ingredient</button>}
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

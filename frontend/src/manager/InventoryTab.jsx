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
  const [restocking, setRestocking] = useState(null); // ingredients shown in the restock dialog

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
        actions={(
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRestocking(inventory.data)}>Restock</button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>Add Ingredient</button>
          </>
        )}
      />
      {editing && (
        <IngredientDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            inventory.reload();
          }}
          onRestock={() => {
            setRestocking([editing]);
            setEditing(null);
          }}
        />
      )}
      {restocking && (
        <RestockDialog
          items={restocking}
          onClose={() => setRestocking(null)}
          onSaved={() => {
            setRestocking(null);
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

function IngredientDialog({ item, onClose, onSaved, onRestock }) {
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
    <Modal
      title={editingId ? 'Edit Ingredient' : 'Add Ingredient'}
      submitLabel="Save"
      onSubmit={save}
      onClose={onClose}
      busy={busy}
      headerAction={editingId && (
        <button type="button" className="btn btn-secondary" onClick={onRestock} disabled={busy}>Restock…</button>
      )}
    >
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

/** Adds delivered amounts to on-hand stock. Low-stock ingredients are listed first. */
function RestockDialog({ items, onClose, onSaved }) {
  const toast = useToast();
  const [amounts, setAmounts] = useState({}); // id -> text typed
  const [busy, setBusy] = useState(false);

  const rows = [...items].sort((a, b) => (isLow(b) - isLow(a)) || a.name.localeCompare(b.name));

  const save = async () => {
    const lines = [];
    for (const item of rows) {
      const text = String(amounts[item.id] ?? '').trim();
      if (text === '') continue;
      const amount = parseAmount(text);
      if (amount === null || amount === 0) {
        toast.warning('Check the amounts', `Restock amount for ${item.name} must be a positive number.`);
        return;
      }
      lines.push({ id: item.id, amount });
    }
    if (lines.length === 0) {
      toast.warning('Nothing to restock', 'Enter an amount for at least one ingredient.');
      return;
    }
    setBusy(true);
    try {
      const updated = await Api.restockInventory(lines);
      toast.success(
        'Inventory restocked',
        updated.length === 1
          ? `${updated[0].name}: now ${quantity(updated[0].onHand)} ${updated[0].unit}`
          : `${updated.length} ingredients updated`,
      );
      onSaved();
    } catch (err) {
      toast.error('Error restocking', errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={rows.length === 1 ? `Restock ${rows[0].name}` : 'Restock Inventory'}
      submitLabel="Restock"
      onSubmit={save}
      onClose={onClose}
      busy={busy}
      width={560}
    >
      <div className="recipe-table restock-table">
        <table className="data-table">
          <caption className="sr-only">Amounts received</caption>
          <thead>
            <tr>
              <th scope="col"><span>Ingredient</span></th>
              <th scope="col" className="num"><span>On hand</span></th>
              <th scope="col" className="num"><span>Add</span></th>
              <th scope="col" className="num"><span>New total</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => {
              const added = parseAmount(amounts[item.id] ?? '');
              return (
                <tr key={item.id}>
                  <td>
                    {item.name}
                    {isLow(item) && <span className="badge badge-alert" style={{ marginLeft: 8 }}>Low</span>}
                  </td>
                  <td className="num">{quantity(item.onHand)} {item.unit}</td>
                  <td className="num">
                    <input
                      className="field"
                      inputMode="decimal"
                      placeholder="0"
                      aria-label={`Amount of ${item.name} to add (${item.unit})`}
                      value={amounts[item.id] ?? ''}
                      onChange={(e) => setAmounts((a) => ({ ...a, [item.id]: e.target.value }))}
                      style={{ width: 90 }}
                    />
                  </td>
                  <td className="num">{added ? `${quantity(item.onHand + added)} ${item.unit}` : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

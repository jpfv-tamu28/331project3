import { useMemo, useState } from 'react';
import { Api, errorMessage } from '../api';
import { Modal } from '../components/Modal';
import { Segmented } from '../components/Segmented';
import { StatTiles } from '../components/StatTiles';
import { StateMessage } from '../components/StateMessage';
import { StatusBadge, TableView } from '../components/TableView';
import { useResource } from '../components/useResource';
import { useToast } from '../components/ToastProvider';
import { isoDate, quantity } from '../format';
import {
  COVER_DAYS, SOON_DAYS, STATUS, USAGE_WINDOW_DAYS,
  daysOfStock, describeSupply, inventoryCsv, needsAttention, stockStatus, suggestedRestock,
} from './inventoryStatus';

const UNITS = ['g', 'ml', 'each'];

const FILTERS = [
  { label: 'All', test: () => true },
  { label: 'Needs attention', test: needsAttention },
  { label: 'Not in any recipe', test: (i) => i.usedIn === 0 },
];

// Most urgent first; also what the Status column sorts by.
const URGENCY = { out: 0, low: 1, soon: 2, ok: 3 };
const withUnit = (n, i) => `${quantity(n)} ${i.unit}`;

const COLUMNS = [
  { key: 'name', label: 'Ingredient' },
  { key: 'onHand', label: 'On Hand', type: 'number', render: (i) => withUnit(i.onHand, i) },
  { key: 'reorderLevel', label: 'Reorder Level', type: 'number', render: (i) => withUnit(i.reorderLevel, i) },
  { key: 'dailyUse', label: 'Avg Use / Day', type: 'number', render: (i) => (i.dailyUse > 0 ? withUnit(Math.max(0.1, Math.round(i.dailyUse * 10) / 10), i) : '-') },
  {
    key: 'daysLeft',
    label: 'Days of Stock',
    type: 'number',
    render: (i) => {
      const days = daysOfStock(i);
      if (days === null) return '-';
      return days >= 365 ? '365+' : quantity(Math.floor(days));
    },
  },
  {
    key: 'urgency',
    label: 'Status',
    render: (i) => {
      const { badge, group } = STATUS[stockStatus(i)];
      return badge ? <StatusBadge text={badge.text} alert={badge.alert} /> : group;
    },
  },
  { key: 'usedIn', label: 'Used In', type: 'number', render: (i) => `${i.usedIn} item${i.usedIn === 1 ? '' : 's'}` },
  { key: 'updatedAt', label: 'Updated' },
];

const searchText = (i) => `${i.name} ${i.unit} ${STATUS[stockStatus(i)].group}`;

function downloadCsv(items) {
  const blob = new Blob([inventoryCsv(items)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `inventory-${isoDate()}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function InventoryTab({ refreshKey }) {
  const inventory = useResource(() => Api.inventory(), [refreshKey]);
  const [editing, setEditing] = useState(null);
  const [restocking, setRestocking] = useState(null); // ingredients shown in the restock dialog

  const counts = useMemo(() => {
    const c = { out: 0, low: 0, soon: 0, ok: 0 };
    for (const i of inventory.data ?? []) c[stockStatus(i)] += 1;
    return c;
  }, [inventory.data]);

  // Urgent ingredients first, then by name, until a column header is clicked.
  // Unused ingredients sort last by days of stock (they never run out from sales).
  const rows = useMemo(() => (inventory.data ?? [])
    .map((i) => ({ ...i, urgency: URGENCY[stockStatus(i)], daysLeft: daysOfStock(i) ?? Number.MAX_VALUE }))
    .sort((a, b) => (a.urgency - b.urgency) || a.name.localeCompare(b.name)), [inventory.data]);

  if (!inventory.data) {
    return <StateMessage loading={inventory.loading} error={inventory.error} onRetry={inventory.reload} />;
  }
  const items = inventory.data;
  const done = () => {
    setEditing(null);
    setRestocking(null);
    inventory.reload();
  };

  return (
    <div className="inventory-tab">
      <div className="inventory-summary">
        <dl className="inventory-stats">
          {[
            { label: 'Ingredients', value: items.length },
            { label: 'Out of stock', value: counts.out, alert: counts.out > 0 },
            { label: 'Below reorder level', value: counts.out + counts.low, alert: counts.out + counts.low > 0 },
            { label: `Reorder within ${SOON_DAYS} days`, value: counts.soon },
          ].map((t) => (
            <div key={t.label}>
              <dt>{t.label}</dt>
              <dd className={t.alert ? 'text-alert' : undefined}>{t.value}</dd>
            </div>
          ))}
        </dl>
        <p className="inventory-note">
          Usage averaged over the last {USAGE_WINDOW_DAYS} days of sales.
        </p>
      </div>
      <TableView
        rows={rows}
        columns={COLUMNS}
        rowKey={(i) => i.id}
        caption="Inventory"
        searchLabel="Search ingredients"
        searchText={searchText}
        filters={FILTERS}
        onSelect={setEditing}
        noun="ingredient"
        actions={(
          <>
            <button type="button" className="btn btn-ghost" onClick={() => downloadCsv(items)}>Export CSV</button>
            <button type="button" className="btn btn-secondary" onClick={() => setRestocking(items)}>Restock</button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>Add Ingredient</button>
          </>
        )}
      />
      {editing && (
        <IngredientDialog
          item={editing}
          onClose={() => setEditing(null)}
          onSaved={done}
          onRestock={() => {
            setRestocking([editing]);
            setEditing(null);
          }}
        />
      )}
      {restocking && (
        <RestockDialog items={restocking} onClose={() => setRestocking(null)} onSaved={done} />
      )}
    </div>
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
  // The stock the form was opened with; sales may change it in the database while the dialog is open.
  const [baseline, setBaseline] = useState(item.onHand ?? null);
  const [reorderLevel, setReorderLevel] = useState(item.reorderLevel != null ? String(item.reorderLevel) : '');
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    const body = { name: name.trim(), unit, reorderLevel: reorderQty };
    // Only send on hand when it was changed, so saving a rename never overwrites recent sales.
    if (!editingId) body.onHand = onHandQty;
    else if (onHandQty !== baseline) Object.assign(body, { onHand: onHandQty, expectedOnHand: baseline });

    setBusy(true);
    try {
      await Api.saveIngredient(editingId, body);
      toast.success(editingId ? 'Ingredient updated' : 'Ingredient added', name.trim());
      onSaved();
    } catch (err) {
      setBusy(false);
      if (err?.response?.status === 409) {
        // Accept the new database value as the baseline; saving again sets the typed amount.
        const fresh = (await Api.inventory().catch(() => [])).find((i) => i.id === editingId);
        if (fresh) setBaseline(fresh.onHand);
        toast.warning('Stock changed while you were editing', `${errorMessage(err)} Press Save again to keep ${quantity(onHandQty)} ${unit}.`);
        return;
      }
      toast.error('Error saving ingredient', errorMessage(err));
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await Api.deleteIngredient(editingId);
      toast.success('Ingredient deleted', item.name);
      onSaved();
    } catch (err) {
      toast.error('Could not delete ingredient', errorMessage(err));
      setBusy(false);
      setConfirmingDelete(false);
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
      width={editingId ? 520 : undefined}
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
      {editingId && (
        <>
          <IngredientStats item={item} />
          <IngredientRecipes id={editingId} unit={item.unit} />
          <div className="ingredient-danger">
            {item.usedIn > 0 ? (
              <p className="muted">To delete this ingredient, first remove it from the recipes above.</p>
            ) : confirmingDelete ? (
              <>
                <span>Delete {item.name} permanently?</span>
                <button type="button" className="btn btn-ghost" onClick={() => setConfirmingDelete(false)} disabled={busy}>Keep</button>
                <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>Delete</button>
              </>
            ) : (
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmingDelete(true)} disabled={busy}>
                Delete ingredient…
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}

function IngredientStats({ item }) {
  const status = stockStatus(item);
  const suggestion = suggestedRestock(item);
  return (
    <dl className="ingredient-stats">
      <div>
        <dt>Avg use per day</dt>
        <dd>{item.dailyUse > 0 ? `${quantity(item.dailyUse)} ${item.unit}` : 'None recently'}</dd>
      </div>
      <div>
        <dt>Supply</dt>
        <dd>{describeSupply(item)}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd className={STATUS[status].badge?.alert ? 'text-alert' : undefined}>{STATUS[status].group}</dd>
      </div>
      {suggestion > 0 && (
        <div>
          <dt>Suggested order</dt>
          <dd>{quantity(suggestion)} {item.unit}</dd>
        </div>
      )}
    </dl>
  );
}

function IngredientRecipes({ id, unit }) {
  const recipes = useResource(() => Api.ingredientRecipes(id), [id]);
  return (
    <div className="recipe-table">
      <table className="data-table">
        <caption className="sr-only">Menu items that use this ingredient</caption>
        <thead>
          <tr>
            <th scope="col"><span>Used in</span></th>
            <th scope="col" className="num"><span>Per serving</span></th>
          </tr>
        </thead>
        <tbody>
          {!recipes.data ? (
            <tr><td colSpan={2} className="table-empty">{recipes.error ?? 'Loading…'}</td></tr>
          ) : recipes.data.length === 0 ? (
            <tr><td colSpan={2} className="table-empty">Not used in any menu item</td></tr>
          ) : recipes.data.map((m) => (
            <tr key={m.id}>
              <td>
                {m.name}
                {!m.isAvailable && <span className="badge" style={{ marginLeft: 8 }}>Unavailable</span>}
              </td>
              <td className="num">{quantity(m.quantity)} {unit}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Adds delivered amounts to on-hand stock. Ingredients needing attention are listed first. */
function RestockDialog({ items, onClose, onSaved }) {
  const toast = useToast();
  const single = items.length === 1;
  const attentionCount = items.filter(needsAttention).length;
  const [scope, setScope] = useState(!single && attentionCount > 0 ? 'attention' : 'all');
  const [amounts, setAmounts] = useState({}); // id -> text typed
  const [busy, setBusy] = useState(false);

  const rows = items
    .filter((i) => scope === 'all' || needsAttention(i))
    .sort((a, b) => (URGENCY[stockStatus(a)] - URGENCY[stockStatus(b)]) || a.name.localeCompare(b.name));
  const suggestions = rows.filter((i) => suggestedRestock(i) > 0);

  const fillSuggested = () => {
    setAmounts((a) => ({
      ...a,
      ...Object.fromEntries(suggestions.map((i) => [i.id, String(suggestedRestock(i))])),
    }));
  };

  const save = async () => {
    const lines = [];
    // Amounts typed for rows hidden by the "Needs attention" view are still restocked.
    for (const item of items) {
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
      title={single ? `Restock ${items[0].name}` : 'Restock Inventory'}
      submitLabel="Restock"
      onSubmit={save}
      onClose={onClose}
      busy={busy}
      width={620}
    >
      <div className="restock-toolbar">
        {!single && (
          <Segmented
            label="Show"
            options={[
              { value: 'attention', label: `Needs attention (${attentionCount})` },
              { value: 'all', label: `All (${items.length})` },
            ]}
            value={scope}
            onChange={setScope}
          />
        )}
        <button type="button" className="btn btn-secondary" onClick={fillSuggested} disabled={busy || suggestions.length === 0}>
          Fill suggested amounts
        </button>
      </div>
      <p className="inventory-note">
        Suggestions bring stock back to the reorder level plus {COVER_DAYS} days of recent use
        (or the reorder level again, if that is more).
      </p>
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
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="table-empty">Nothing needs restocking right now</td></tr>
            ) : rows.map((item) => {
              const added = parseAmount(amounts[item.id] ?? '');
              const suggestion = suggestedRestock(item);
              const badge = STATUS[stockStatus(item)].badge;
              return (
                <tr key={item.id}>
                  <td>
                    {item.name}
                    {badge && <span className={`badge${badge.alert ? ' badge-alert' : ''}`} style={{ marginLeft: 8 }}>{badge.text}</span>}
                  </td>
                  <td className="num">{quantity(item.onHand)} {item.unit}</td>
                  <td className="num">
                    <input
                      className="field"
                      inputMode="decimal"
                      placeholder="0"
                      title={suggestion > 0 ? `Suggested: ${quantity(suggestion)} ${item.unit}` : undefined}
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

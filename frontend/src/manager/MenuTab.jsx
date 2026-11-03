import { useState } from 'react';
import { Api, errorMessage } from '../api';
import { DenseList } from '../components/DenseList';
import { Modal } from '../components/Modal';
import { StateMessage } from '../components/StateMessage';
import { useResource } from '../components/useResource';
import { useToast } from '../components/ToastProvider';
import { capitalize, money } from '../format';
import { ITEM_TYPES } from '../../../shared/orderRules.js';
import SeasonalItemDialog from './SeasonalItemDialog';

const isTopping = (m) => m.itemType?.toLowerCase() === 'topping';

const FILTERS = [
  { label: 'All', test: () => true },
  { label: 'Drinks', test: (m) => !isTopping(m) },
  { label: 'Toppings', test: isTopping },
  { label: 'Unavailable', test: (m) => !m.isAvailable },
];

const describe = (m) => ({
  title: m.name,
  subtitle: `${capitalize(m.itemType)} · #${m.id}`,
  value: money(m.priceCents),
  badge: m.isAvailable ? null : { text: 'Unavailable' },
});

/** "5.25" -> 525, or null if it isn't a valid non-negative amount with at most 2 decimals. */
export function parsePriceCents(text) {
  const trimmed = String(text).trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, frac = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

export default function MenuTab({ refreshKey }) {
  const menu = useResource(() => Api.menu(), [refreshKey]);
  const [editing, setEditing] = useState(null); // item, or {} for a new one
  const [seasonal, setSeasonal] = useState(false);

  if (!menu.data) {
    return <StateMessage loading={menu.loading} error={menu.error} onRetry={menu.reload} />;
  }
  // Only categories already on the menu can be chosen, as in the Java dialog.
  const categories = [...new Set(menu.data.map((m) => m.category))].sort();

  return (
    <>
      <DenseList
        items={menu.data}
        searchLabel="Search menu"
        filters={FILTERS}
        groupOf={(m) => m.category}
        describe={describe}
        onOpen={setEditing}
        noun="item"
        actions={(
          <>
            <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>Add Item</button>
            <button type="button" className="btn btn-secondary" onClick={() => setSeasonal(true)}>New Seasonal Item</button>
          </>
        )}
      />
      {editing && (
        <MenuItemDialog
          item={editing}
          categories={categories}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            menu.reload();
          }}
        />
      )}
      {seasonal && (
        <SeasonalItemDialog
          onClose={() => setSeasonal(false)}
          onSaved={() => {
            setSeasonal(false);
            menu.reload();
          }}
        />
      )}
    </>
  );
}

function MenuItemDialog({ item, categories, onClose, onSaved }) {
  const toast = useToast();
  const editingId = item.id ?? null;
  const [name, setName] = useState(item.name ?? '');
  const [category, setCategory] = useState(item.category ?? categories[0] ?? '');
  const [itemType, setItemType] = useState(item.itemType ?? ITEM_TYPES[0]);
  const [price, setPrice] = useState(item.priceCents != null ? (item.priceCents / 100).toFixed(2) : '');
  const [isAvailable, setAvailable] = useState(item.isAvailable ?? true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!name.trim() || !category) {
      toast.warning('Missing details', 'Name and category are required.');
      return;
    }
    const priceCents = parsePriceCents(price);
    if (priceCents === null) {
      toast.warning('Check the price', 'Enter a valid price, e.g. 5.25');
      return;
    }
    setBusy(true);
    try {
      await Api.saveMenuItem(editingId, { name: name.trim(), category, itemType, priceCents, isAvailable });
      toast.success(editingId ? 'Menu item updated' : 'Menu item added', name.trim());
      onSaved();
    } catch (err) {
      toast.error('Error saving menu item', errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title={editingId ? 'Edit Menu Item' : 'Add Menu Item'} submitLabel="Save" onSubmit={save} onClose={onClose} busy={busy}>
      <div className="form-grid">
        <label htmlFor="mi-name">Name</label>
        <input id="mi-name" className="field" value={name} onChange={(e) => setName(e.target.value)} />
        <label htmlFor="mi-category">Category</label>
        <select id="mi-category" className="field" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label htmlFor="mi-type">Type</label>
        <select id="mi-type" className="field" value={itemType} onChange={(e) => setItemType(e.target.value)}>
          {ITEM_TYPES.map((t) => <option key={t} value={t}>{capitalize(t)}</option>)}
        </select>
        <label htmlFor="mi-price">Price ($)</label>
        <input id="mi-price" className="field" inputMode="decimal" placeholder="5.25" value={price}
          onChange={(e) => setPrice(e.target.value)} />
        <span />
        <label className="checkbox">
          <input type="checkbox" checked={isAvailable} onChange={(e) => setAvailable(e.target.checked)} />
          Available
        </label>
      </div>
    </Modal>
  );
}

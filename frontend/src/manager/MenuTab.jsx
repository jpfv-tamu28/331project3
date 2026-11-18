import { useMemo, useState } from 'react';
import { Api, errorMessage } from '../api';
import { Modal } from '../components/Modal';
import { StateMessage } from '../components/StateMessage';
import { StatusBadge, TableView } from '../components/TableView';
import { useResource } from '../components/useResource';
import { useToast } from '../components/ToastProvider';
import { capitalize, parsePriceCents } from '../format';
import { ITEM_TYPES } from '../../../shared/orderRules.js';
import SeasonalItemDialog from './SeasonalItemDialog';

const isTopping = (m) => m.itemType?.toLowerCase() === 'topping';

const FILTERS = [
  { label: 'All', test: () => true },
  { label: 'Drinks', test: (m) => !isTopping(m) },
  { label: 'Toppings', test: isTopping },
  { label: 'Unavailable', test: (m) => !m.isAvailable },
];

const COLUMNS = [
  { key: 'id', label: 'ID', type: 'id' },
  { key: 'name', label: 'Name' },
  { key: 'category', label: 'Category' },
  { key: 'itemType', label: 'Type', render: (m) => capitalize(m.itemType) },
  { key: 'priceCents', label: 'Price', type: 'cents' },
  {
    key: 'status',
    label: 'Status',
    render: (m) => (m.isAvailable ? 'Available' : <StatusBadge text="Unavailable" />),
  },
];

const searchText = (m) => `${m.name} ${m.category} ${m.itemType} #${m.id}`;

export default function MenuTab({ refreshKey }) {
  const menu = useResource(() => Api.menu(), [refreshKey]);
  const [editing, setEditing] = useState(null); // item, or {} for a new one
  const [seasonal, setSeasonal] = useState(false);

  // Grouped by category, then by name, until a column header is clicked.
  const rows = useMemo(() => (menu.data ?? [])
    .map((m) => ({ ...m, status: m.isAvailable ? 'Available' : 'Unavailable' }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)), [menu.data]);

  if (!menu.data) {
    return <StateMessage loading={menu.loading} error={menu.error} onRetry={menu.reload} />;
  }
  // Only categories already on the menu can be chosen, as in the Java dialog.
  const categories = [...new Set(menu.data.map((m) => m.category))].sort();

  return (
    <>
      <TableView
        rows={rows}
        columns={COLUMNS}
        rowKey={(m) => m.id}
        caption="Menu items"
        searchLabel="Search menu"
        searchText={searchText}
        filters={FILTERS}
        onSelect={setEditing}
        rowClassName={(m) => (m.isAvailable ? '' : 'row-muted')}
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

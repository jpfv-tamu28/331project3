import { useState } from 'react';
import { Api, errorMessage } from '../api';
import { Modal, Segmented, StateMessage, useResource, useToast } from '../components/ui';
import { capitalize, quantity } from '../format';
import { ITEM_TYPES, parsePriceCents } from './MenuTab';

/** Adds a Seasonal menu item together with its recipe, so inventory usage is tracked from the first sale. */
export default function SeasonalItemDialog({ onClose, onSaved }) {
  const toast = useToast();
  const ingredients = useResource(() => Api.inventory(), []);
  const [name, setName] = useState('');
  const [itemType, setItemType] = useState(ITEM_TYPES[0]);
  const [price, setPrice] = useState('');
  const [isAvailable, setAvailable] = useState(true);
  const [pick, setPick] = useState('');
  const [amount, setAmount] = useState('');
  const [recipe, setRecipe] = useState([]); // [{ ingredient, quantity }]
  const [busy, setBusy] = useState(false);

  const sortedIngredients = [...(ingredients.data ?? [])].sort((a, b) => a.name.localeCompare(b.name));

  // Adding an ingredient that's already listed replaces its quantity (one recipe row per ingredient).
  const addIngredient = () => {
    const ingredient = sortedIngredients.find((i) => String(i.id) === pick);
    if (!ingredient) {
      toast.warning('Pick an ingredient', 'Choose an ingredient to add to the recipe.');
      return;
    }
    const qty = Number(amount);
    if (!amount.trim() || !Number.isFinite(qty) || qty <= 0) {
      toast.warning('Check the quantity', 'Quantity must be a positive number.');
      return;
    }
    setRecipe((r) => [...r.filter((x) => x.ingredient.id !== ingredient.id), { ingredient, quantity: qty }]);
    setAmount('');
  };

  const save = async () => {
    if (!name.trim()) return toast.warning('Check the item', 'Name is required.');
    const priceCents = parsePriceCents(price);
    if (priceCents === null) return toast.warning('Check the item', 'Enter a valid price, e.g. 6.50');
    if (recipe.length === 0) return toast.warning('Check the item', 'Add at least one ingredient.');
    setBusy(true);
    try {
      await Api.createSeasonalItem({
        name: name.trim(),
        itemType,
        priceCents,
        isAvailable,
        recipe: recipe.map((r) => ({ inventoryId: r.ingredient.id, quantity: r.quantity })),
      });
      toast.success('Seasonal item created', name.trim());
      onSaved();
    } catch (err) {
      toast.error('Error saving seasonal item', errorMessage(err));
      setBusy(false);
    }
    return undefined;
  };

  return (
    <Modal title="New Seasonal Menu Item" submitLabel="Create Item" onSubmit={save} onClose={onClose} busy={busy} width={540}>
      <div className="form-grid">
        <label htmlFor="si-name">Name</label>
        <input id="si-name" className="field" placeholder="e.g. Pumpkin Spice Milk Tea" value={name}
          onChange={(e) => setName(e.target.value)} />
        <span className="form-label">Category</span>
        <strong style={{ color: 'var(--text)' }}>Seasonal</strong>
        <span className="form-label" id="si-type-label">Type</span>
        <Segmented label="Type" options={ITEM_TYPES.map((t) => ({ value: t, label: capitalize(t) }))}
          value={itemType} onChange={setItemType} />
        <label htmlFor="si-price">Price ($)</label>
        <input id="si-price" className="field" inputMode="decimal" placeholder="6.50" value={price}
          onChange={(e) => setPrice(e.target.value)} style={{ width: 120 }} />
        <span />
        <label className="checkbox">
          <input type="checkbox" checked={isAvailable} onChange={(e) => setAvailable(e.target.checked)} />
          Available to cashiers
        </label>
      </div>

      {ingredients.data ? (
        <>
          <div className="recipe-picker">
            <select className="field" aria-label="Ingredient" value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose ingredient…</option>
              {sortedIngredients.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
            </select>
            <input
              className="field"
              aria-label="Quantity per serving"
              placeholder="Qty"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds the ingredient instead of submitting the whole dialog.
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addIngredient();
                }
              }}
            />
            <button type="button" className="btn btn-secondary" onClick={addIngredient}>Add</button>
          </div>
          <div className="recipe-table">
            <table className="data-table">
              <caption className="sr-only">Ingredients per serving</caption>
              <thead>
                <tr>
                  <th scope="col"><span>Ingredients per serving</span></th>
                  <th scope="col" className="num"><span>Quantity</span></th>
                  <th scope="col"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {recipe.length === 0 ? (
                  <tr><td colSpan={3} className="table-empty">No ingredients yet</td></tr>
                ) : recipe.map((r) => (
                  <tr key={r.ingredient.id}>
                    <td>{r.ingredient.name}</td>
                    <td className="num">{quantity(r.quantity)} {r.ingredient.unit}</td>
                    <td>
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${r.ingredient.name}`}
                        onClick={() => setRecipe((list) => list.filter((x) => x !== r))}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <StateMessage loading={ingredients.loading} error={ingredients.error} onRetry={ingredients.reload} />
      )}
    </Modal>
  );
}

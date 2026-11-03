import { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { Segmented } from '../components/Segmented';
import { Stepper } from '../components/Stepper';
import { money } from '../format';
import {
  EXTRA_SWEET, LEVELS, MAX_QUANTITY, MAX_TOPPING_COUNT, SIZES, lineCents,
} from './order';

/**
 * Size / ice / sugar / add-ons / quantity for one drink (Cashier.openCustomizationDialog).
 * existing is the order line being edited, or null to add a new one.
 */
export default function CustomizeDialog({ item, toppings, existing, onSave, onClose, className, width = 480 }) {
  const [size, setSize] = useState(existing?.size ?? 'M');
  const [ice, setIce] = useState(existing?.ice ?? '100%');
  const [sugar, setSugar] = useState(existing?.sugar ?? '100%');
  const [quantity, setQuantity] = useState(existing?.quantity ?? 1);
  // Each add-on keeps its own count, so a drink can take e.g. two scoops of boba.
  // Matched by ID; an add-on removed from the menu since then simply starts at zero.
  const [counts, setCounts] = useState(() => Object.fromEntries(
    toppings.map((t) => [t.id, existing?.toppings.find((x) => x.item.id === t.id)?.count ?? 0]),
  ));

  const extraSweet = sugar === EXTRA_SWEET;
  const line = useMemo(() => ({
    item,
    size,
    ice,
    sugar,
    quantity,
    toppings: toppings.filter((t) => counts[t.id] > 0).map((t) => ({ item: t, count: counts[t.id] })),
  }), [item, size, ice, sugar, quantity, toppings, counts]);

  return (
    <Modal
      title={item.name}
      submitLabel={existing ? 'Save Changes' : 'Add to Order'}
      onSubmit={() => onSave(line)}
      onClose={onClose}
      width={width}
      className={className}
    >
      <div className="customize">
        <p className="muted">{item.category} · {money(item.priceCents)}</p>

        <fieldset>
          <legend>Size</legend>
          <Segmented label="Size" options={SIZES} value={size} onChange={setSize} />
        </fieldset>

        <fieldset>
          <legend>Ice Level</legend>
          <Segmented label="Ice level" options={LEVELS} value={ice} onChange={setIce} />
        </fieldset>

        <fieldset>
          <legend>Sugar Level</legend>
          <Segmented label="Sugar level" options={LEVELS} value={extraSweet ? null : sugar} onChange={setSugar} />
          {/* 200% is a rare request, so it sits as a quiet toggle under the regular levels. */}
          <button
            type="button"
            className={`extra-sweet${extraSweet ? ' on' : ''}`}
            aria-pressed={extraSweet}
            onClick={() => setSugar(extraSweet ? '100%' : EXTRA_SWEET)}
          >
            {extraSweet ? '✓' : '+'} Extra sweet (200%)
          </button>
        </fieldset>

        {toppings.length > 0 && (
          <fieldset>
            <legend>Add-Ons</legend>
            <ul className="addons">
              {toppings.map((t) => {
                const n = counts[t.id];
                return (
                  <li key={t.id} className={n > 0 ? 'chosen' : undefined}>
                    <span className="addon-name">
                      {t.name} <span className="muted">+{money(t.priceCents)}</span>
                    </span>
                    <Stepper
                      small
                      label={t.name}
                      value={n}
                      max={MAX_TOPPING_COUNT}
                      onChange={(v) => setCounts((c) => ({ ...c, [t.id]: v }))}
                    />
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        <fieldset>
          <legend>Quantity</legend>
          <div className="qty-row">
            <Stepper label="Quantity" value={quantity} min={1} max={MAX_QUANTITY} onChange={setQuantity} />
            <strong className="line-total" aria-live="polite">
              <span className="sr-only">Line total </span>{money(lineCents(line))}
            </strong>
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}

import { useEffect, useRef } from 'react';
import { Segmented } from '../components/Segmented';
import { Stepper } from '../components/Stepper';
import { money, percent } from '../format';
import { MAX_QUANTITY, PAYMENT_METHODS, SIZES, TAX_RATE } from '../../../shared/orderRules.js';
import { customizationSummary, lineCents } from '../cashier/order';
import DrinkArt from './DrinkArt';

const SIZE_NAMES = Object.fromEntries(SIZES.map((s) => [s.value, s.label]));

/**
 * Slide-out order panel on the left, opened and closed with the cart button.
 * Closed, it is `inert` so its controls can't be tabbed to or read while off screen.
 */
export default function CartPanel({
  open, onClose, lines, totals, payment, onPaymentChange, onEdit, onQuantity, onRemove, onPlaceOrder, placing,
}) {
  const headingRef = useRef(null);

  // Opening moves focus into the panel so keyboard and screen reader users land in their order.
  useEffect(() => {
    if (open) headingRef.current?.focus();
  }, [open]);

  return (
    <aside
      id="kiosk-cart"
      className={`kiosk-cart${open ? ' open' : ''}`}
      aria-labelledby="kiosk-cart-title"
      inert={!open}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <header className="kiosk-cart-header">
        <h2 id="kiosk-cart-title" ref={headingRef} tabIndex={-1}>Your Order</h2>
        <button type="button" className="kiosk-icon-btn" onClick={onClose} aria-label="Close your order">
          ✕
        </button>
      </header>

      <div className="kiosk-cart-lines">
        {lines.length === 0 ? (
          <p className="kiosk-cart-empty">Your order is empty.<br />Tap a drink to add it.</p>
        ) : (
          <ul aria-label="Drinks in your order">
            {lines.map((line, index) => {
              const name = `${line.item.name}, ${SIZE_NAMES[line.size]}`;
              return (
                // eslint-disable-next-line react/no-array-index-key
                <li key={index} className="kiosk-cart-line">
                  <div className="kiosk-cart-thumb"><DrinkArt item={line.item} /></div>
                  <div className="kiosk-cart-info">
                    <strong>{line.item.name}</strong>
                    <span>{SIZE_NAMES[line.size]} · {customizationSummary(line)}</span>
                    <div className="kiosk-cart-actions">
                      <Stepper
                        small
                        label={`quantity of ${name}`}
                        value={line.quantity}
                        min={1}
                        max={MAX_QUANTITY}
                        onChange={(q) => onQuantity(index, q)}
                      />
                      <button type="button" className="kiosk-link-btn" onClick={() => onEdit(index)}
                        aria-label={`Edit ${name}`}>
                        Edit
                      </button>
                      <button type="button" className="kiosk-link-btn" onClick={() => onRemove(index)}
                        aria-label={`Remove ${name}`}>
                        Remove
                      </button>
                    </div>
                  </div>
                  <span className="kiosk-cart-price">{money(lineCents(line))}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <footer className="kiosk-cart-footer">
        <dl className="totals">
          <div><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
          <div><dt>Tax ({percent(TAX_RATE)})</dt><dd>{money(totals.tax)}</dd></div>
          <div className="grand"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
        </dl>
        <div>
          <p className="kiosk-cart-label" id="kiosk-pay-label">How would you like to pay?</p>
          <Segmented label="Payment method" options={PAYMENT_METHODS} value={payment} onChange={onPaymentChange} />
        </div>
        <button
          type="button"
          className="btn btn-primary btn-lg btn-block kiosk-place"
          onClick={onPlaceOrder}
          disabled={lines.length === 0 || placing}
        >
          {placing ? 'Placing order…' : `Place Order · ${money(totals.total)}`}
        </button>
      </footer>
    </aside>
  );
}

import { useMemo, useState } from 'react';
import { Api, errorMessage } from './api';
import { useAuth } from './components/AuthProvider';
import { Modal } from './components/Modal';
import { StateMessage } from './components/StateMessage';
import { useResource } from './components/useResource';
import { useToast } from './components/ToastProvider';
import { money, percent } from './format';
import CustomizeDialog from './cashier/CustomizeDialog';
import OrderHistoryDialog from './cashier/OrderHistoryDialog';
import { customizationSummary, lineCents, orderTotals, toOrderRequest } from './cashier/order';
import { PAYMENT_METHODS, TAX_RATE } from '../../shared/orderRules.js';
import './Cashier.css';


const isTopping = (item) => item.itemType?.toLowerCase() === 'topping';

export default function Cashier() {
  const toast = useToast();
  const { user, logout } = useAuth();
  const menu = useResource(() => Api.menu({ availableOnly: true }), []);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [lines, setLines] = useState([]);
  const [editing, setEditing] = useState(null); // { item, index } ; index -1 adds a new line
  const [dialog, setDialog] = useState(null); // 'history' | 'settings' | 'clear'
  const [payment, setPayment] = useState('card');
  const [discountCode, setDiscountCode] = useState('');
  const [discount, setDiscount] = useState(null); // { code, rate }
  const [submitting, setSubmitting] = useState(false);

  const items = useMemo(() => menu.data ?? [], [menu.data]);
  const drinks = useMemo(() => items.filter((i) => !isTopping(i)), [items]);
  const toppings = useMemo(() => items.filter(isTopping), [items]);
  // Categories come from the menu itself so manager-added ones (e.g. Seasonal) get a tab too.
  const categories = useMemo(() => ['All', ...new Set(drinks.map((d) => d.category))], [drinks]);

  // Search and the category tab narrow the grid together.
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drinks.filter((d) => (category === 'All' || d.category === category)
      && (d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q)));
  }, [drinks, query, category]);

  const totals = orderTotals(lines, discount?.rate ?? 0);

  const resetOrder = () => {
    setLines([]);
    setDiscount(null);
    setDiscountCode('');
  };

  const saveLine = (line) => {
    setLines((current) => (editing.index >= 0
      ? current.map((l, i) => (i === editing.index ? line : l))
      : [...current, line]));
    setEditing(null);
  };

  const applyDiscount = async () => {
    const code = discountCode.trim();
    if (!code) {
      setDiscount(null);
      return;
    }
    try {
      const result = await Api.checkDiscount(code);
      setDiscount(result);
      toast.success('Discount applied', result.label);
    } catch (err) {
      setDiscount(null);
      toast.error('Invalid code', errorMessage(err));
    }
  };

  const finishPayment = async () => {
    if (lines.length === 0) {
      toast.warning('Order is empty', 'Add at least one drink before finishing payment.');
      return;
    }
    setSubmitting(true);
    try {
      const order = await Api.createOrder({
        items: toOrderRequest(lines),
        discountCode: discount?.code,
        paymentMethod: payment,
      });
      toast.success(`Order #${order.id} recorded`, `${money(order.totalCents)} paid by ${PAYMENT_METHODS.find((p) => p.value === payment).label.toLowerCase()}.`);
      resetOrder();
    } catch (err) {
      toast.error("Couldn't save the order", errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="cashier">
      <nav className="cashier-nav" aria-label="Cashier">
        <p className="brand">Boba Bops</p>
        <button
          type="button"
          className="nav-item active"
          aria-current="page"
          onClick={() => lines.length > 0 && setDialog('clear')}
        >
          New Order
        </button>
        <button
          type="button"
          className="nav-item"
          onClick={() => toast.info('Pending Orders', 'All completed orders are recorded. See Order History for status.')}
        >
          Pending Orders
        </button>
        <button type="button" className="nav-item" onClick={() => setDialog('history')}>
          Order History
        </button>
        <button type="button" className="nav-item" onClick={() => setDialog('settings')}>
          Settings
        </button>
        {user && (
          <div className="nav-account">
            <span className="nav-account-name" title={user.email}>{user.name}</span>
            <button type="button" className="nav-item" onClick={logout}>
              Sign Out
            </button>
          </div>
        )}
      </nav>

      <section className="cashier-menu" aria-label="Menu">
        <h1 className="sr-only">New order</h1>
        <input
          type="search"
          className="field menu-search"
          placeholder="Search drinks"
          aria-label="Search drinks"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="tab-row" role="group" aria-label="Category">
          {categories.map((c) => (
            <button key={c} type="button" className="tab" aria-pressed={c === category} onClick={() => setCategory(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="menu-scroll">
          {menu.data ? (
            visible.length > 0 ? (
              <ul className="menu-grid">
                {visible.map((item) => (
                  <li key={item.id}>
                    <button type="button" className="menu-card" onClick={() => setEditing({ item, index: -1 })}>
                      <span className="menu-card-name">{item.name}</span>
                      <span className="menu-card-category">{item.category}</span>
                      <span className="menu-card-price">{money(item.priceCents)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="state-message">No drinks found</p>
            )
          ) : (
            <StateMessage loading={menu.loading} error={menu.error} onRetry={menu.reload} />
          )}
        </div>
      </section>

      <aside className="order-panel" aria-labelledby="current-order-title">
        <header className="order-header">
          <h2 id="current-order-title">Current Order</h2>
        </header>

        <div className="order-lines">
          {lines.length === 0 ? (
            <p className="order-empty">Tap a drink to add it</p>
          ) : (
            <ul aria-label="Order items">
              {lines.map((line, index) => {
                const label = `${line.item.name} (${line.size})`;
                return (
                  // eslint-disable-next-line react/no-array-index-key
                  <li key={index} className="order-line">
                    {/* Tapping anywhere on the line edits it, like the Java row. */}
                    <button type="button" className="order-line-main" onClick={() => setEditing({ item: line.item, index })}>
                      <strong>
                        {label}
                        {line.quantity > 1 && ` ×${line.quantity}`}
                      </strong>
                      <span className="muted">{customizationSummary(line)}</span>
                    </button>
                    <span className="order-line-price">{money(lineCents(line))}</span>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Edit ${label}`}
                      title="Edit this drink"
                      onClick={() => setEditing({ item: line.item, index })}
                    >
                      ✏︎
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove ${label}`}
                      title="Remove"
                      onClick={() => setLines((l) => l.filter((_, i) => i !== index))}
                    >
                      ✕
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="order-footer">
          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{money(totals.subtotal)}</dd></div>
            <div><dt>Taxes ({percent(TAX_RATE)})</dt><dd>{money(totals.tax)}</dd></div>
            <div><dt>Discounts</dt><dd>-{money(totals.discount)}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{money(totals.total)}</dd></div>
          </dl>

          <fieldset className="payment">
            <legend className="sr-only">Payment method</legend>
            {PAYMENT_METHODS.map((p) => (
              <label key={p.value} className="checkbox">
                <input type="radio" name="payment" value={p.value} checked={payment === p.value}
                  onChange={() => setPayment(p.value)} />
                {p.label}
              </label>
            ))}
          </fieldset>

          <form
            className="discount-row"
            onSubmit={(e) => {
              e.preventDefault();
              applyDiscount();
            }}
          >
            <label htmlFor="discount-code" className="subtle">Discount code</label>
            <input
              id="discount-code"
              className="field"
              value={discountCode}
              onChange={(e) => setDiscountCode(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="btn btn-secondary">Apply</button>
          </form>
          {discount && <p className="discount-note">{discount.code}: {Math.round(discount.rate * 100)}% off</p>}

          <div className="due-row">
            <span className="subtle">Amount due</span>
            <strong aria-live="polite">{money(totals.total)}</strong>
          </div>

          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={finishPayment} disabled={submitting}>
            {submitting ? 'Saving order…' : 'Finish Payment'}
          </button>
        </div>
      </aside>

      {editing && (
        <CustomizeDialog
          item={editing.item}
          toppings={toppings}
          existing={editing.index >= 0 ? lines[editing.index] : null}
          onSave={saveLine}
          onClose={() => setEditing(null)}
        />
      )}
      {dialog === 'history' && <OrderHistoryDialog onClose={() => setDialog(null)} />}
      {dialog === 'settings' && (
        <Modal title="Settings" onClose={() => setDialog(null)}>
          <p>Boba Bops POS System v1.0</p>
          {user && <p className="subtle" style={{ marginTop: 8 }}>Signed in as {user.name} ({user.email})</p>}
        </Modal>
      )}
      {dialog === 'clear' && (
        <Modal
          title="Start a new order?"
          submitLabel="Clear Order"
          onSubmit={() => {
            resetOrder();
            setDialog(null);
          }}
          onClose={() => setDialog(null)}
        >
          <p>The items in the current order will be cleared.</p>
        </Modal>
      )}
    </main>
  );
}

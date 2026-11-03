import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Api, errorMessage } from './api';
import { Modal } from './components/Modal';
import { StateMessage } from './components/StateMessage';
import { useResource } from './components/useResource';
import { useToast } from './components/ToastProvider';
import { money } from './format';
import CustomizeDialog from './cashier/CustomizeDialog';
import { orderTotals, toOrderRequest } from './cashier/order';
import CartPanel from './kiosk/CartPanel';
import DrinkArt, { flavorColor, tint } from './kiosk/DrinkArt';
import './Kiosk.css';

const isTopping = (item) => item.itemType?.toLowerCase() === 'topping';
const sectionId = (category) => `kiosk-section-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
// The confirmation screen resets itself for the next customer after this long.
const CONFIRMATION_MS = 20000;
const PAYMENT_NOTES = {
  card: ' charged to your card.',
  giftcard: ' charged to your gift card.',
  cash: ' due at the counter. Please pay the cashier.',
};

/**
 * Self-order kiosk: menu sections laid side by side and scrolled left to right, two rows of
 * large square tiles per section, section tabs across the top, and a cart panel toggled from the top left.
 * Reuses the cashier's customize dialog and pricing so both screens charge the same way.
 */
export default function Kiosk() {
  const toast = useToast();
  const menu = useResource(() => Api.menu({ availableOnly: true }), []);
  const [lines, setLines] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { item, index }; index -1 adds a new line
  const [payment, setPayment] = useState('card');
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(null); // order returned by the server
  const [activeSection, setActiveSection] = useState(null);
  const [bump, setBump] = useState(0); // restarts the cart badge animation on every add
  const trackRef = useRef(null);
  const tabRefs = useRef({});

  const items = useMemo(() => menu.data ?? [], [menu.data]);
  const toppings = useMemo(() => items.filter(isTopping), [items]);
  // One section per drink category, in the order categories first appear on the menu.
  const sections = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      if (isTopping(item)) continue;
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category).push(item);
    }
    return [...map.entries()].map(([category, drinks]) => ({ category, drinks }));
  }, [items]);

  const totals = orderTotals(lines);
  const itemCount = lines.reduce((n, l) => n + l.quantity, 0);
  const current = activeSection ?? sections[0]?.category;

  // While a tab's smooth scroll is running, keep that tab selected instead of tracking every frame.
  const scrollingTo = useRef(null);

  // Where a section starts in the scroller's coordinates (its left edge lined up with the track padding).
  const sectionStart = (category) => {
    const track = trackRef.current;
    const el = document.getElementById(sectionId(category));
    if (!track || !el) return 0;
    return el.offsetLeft - track.offsetLeft - Number.parseFloat(getComputedStyle(track).paddingLeft);
  };

  // Highlight the tab of the section at the left edge of the scroller.
  const syncActiveSection = useCallback(() => {
    const track = trackRef.current;
    if (!track || scrollingTo.current) return;
    let active = sections[0]?.category;
    for (const { category } of sections) {
      if (sectionStart(category) <= track.scrollLeft + 8) active = category;
    }
    // Sections near the end can't reach the left edge; once scrolled all the way, select the last one.
    if (track.scrollLeft > 0 && track.scrollLeft + track.clientWidth >= track.scrollWidth - 4) {
      active = sections.at(-1)?.category;
    }
    setActiveSection(active);
  }, [sections]);

  // A tab's scroll is done when the browser says so (scrollend), or after a second as a fallback.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    const done = () => { scrollingTo.current = null; };
    track.addEventListener('scrollend', done);
    return () => track.removeEventListener('scrollend', done);
  }, [menu.data]);

  // Keep the highlighted tab visible when the tab bar itself overflows.
  useEffect(() => {
    tabRefs.current[current]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [current]);

  const goToSection = (category) => {
    const track = trackRef.current;
    if (!track) return;
    const left = Math.min(sectionStart(category), track.scrollWidth - track.clientWidth);
    setActiveSection(category);
    if (Math.abs(track.scrollLeft - left) < 2) return;
    scrollingTo.current = category;
    setTimeout(() => {
      if (scrollingTo.current === category) scrollingTo.current = null;
    }, 1000);
    track.scrollTo({ left, behavior: 'smooth' });
  };

  const saveLine = (line) => {
    const adding = editing.index < 0;
    setLines((list) => (adding ? [...list, line] : list.map((l, i) => (i === editing.index ? line : l))));
    setEditing(null);
    if (adding) {
      setBump((b) => b + 1);
      toast.success('Added to your order', `${line.quantity} × ${line.item.name}`);
    }
  };

  const startOver = useCallback(() => {
    setLines([]);
    setPlaced(null);
    setCartOpen(false);
    setPayment('card');
    trackRef.current?.scrollTo({ left: 0 });
    setActiveSection(null);
  }, []);

  useEffect(() => {
    if (!placed) return undefined;
    const timer = setTimeout(startOver, CONFIRMATION_MS);
    return () => clearTimeout(timer);
  }, [placed, startOver]);

  const placeOrder = async () => {
    setPlacing(true);
    try {
      const order = await Api.createOrder({ items: toOrderRequest(lines), paymentMethod: payment });
      setPlaced(order);
    } catch (err) {
      toast.error("We couldn't place your order", errorMessage(err));
    } finally {
      setPlacing(false);
    }
  };

  return (
    <main className="kiosk">
      <header className="kiosk-header">
        <button
          type="button"
          className={`kiosk-cart-toggle${cartOpen ? ' active' : ''}`}
          aria-expanded={cartOpen}
          aria-controls="kiosk-cart"
          onClick={() => setCartOpen((o) => !o)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6 7h12l-1.2 12.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.8L6 7Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M9 7V6a3 3 0 0 1 6 0v1" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <span className="sr-only">{cartOpen ? 'Hide' : 'Show'} your order, </span>
          {itemCount > 0 && (
            <span key={bump} className="kiosk-cart-badge">
              {itemCount}
              <span className="sr-only"> {itemCount === 1 ? 'item' : 'items'}</span>
            </span>
          )}
          <span className="kiosk-cart-total">{money(totals.total)}</span>
        </button>
        <h1 className="kiosk-brand">Boba Bops</h1>
        <p className="kiosk-tagline">Tap a drink to start</p>
      </header>

      <nav className="kiosk-tabs" aria-label="Menu sections">
        {sections.map(({ category }) => (
          <button
            key={category}
            ref={(el) => { tabRefs.current[category] = el; }}
            type="button"
            className="kiosk-tab"
            aria-current={category === current ? 'true' : undefined}
            aria-controls={sectionId(category)}
            onClick={() => goToSection(category)}
          >
            {category}
          </button>
        ))}
      </nav>

      <div className="kiosk-body">
        <CartPanel
          open={cartOpen}
          onClose={() => setCartOpen(false)}
          lines={lines}
          totals={totals}
          payment={payment}
          onPaymentChange={setPayment}
          onEdit={(index) => setEditing({ item: lines[index].item, index })}
          onQuantity={(index, quantity) => setLines((list) => list.map((l, i) => (i === index ? { ...l, quantity } : l)))}
          onRemove={(index) => setLines((list) => list.filter((_, i) => i !== index))}
          onPlaceOrder={placeOrder}
          placing={placing}
        />

        {menu.data ? (
          <div
            ref={trackRef}
            className="kiosk-track"
            role="region"
            aria-label="Menu, scroll sideways for more"
            tabIndex={0}
            onScroll={syncActiveSection}
            onWheel={(e) => {
              // A mouse wheel scrolls vertically; turn that into sideways movement on desktop.
              if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) trackRef.current.scrollLeft += e.deltaY;
            }}
          >
            {sections.map(({ category, drinks }) => (
              <section key={category} id={sectionId(category)} className="kiosk-section" aria-labelledby={`${sectionId(category)}-title`}>
                <h2 id={`${sectionId(category)}-title`}>{category}</h2>
                <ul className="kiosk-grid">
                  {drinks.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        className="kiosk-tile"
                        style={{ '--tile-bg': tint(flavorColor(item.name), 0.8) }}
                        onClick={() => setEditing({ item, index: -1 })}
                      >
                        <span className="kiosk-tile-art"><DrinkArt item={item} /></span>
                        <span className="kiosk-tile-name">{item.name}</span>
                        <span className="kiosk-tile-price">{money(item.priceCents)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
            {sections.length === 0 && <p className="state-message">The menu is empty right now.</p>}
          </div>
        ) : (
          <StateMessage loading={menu.loading} error={menu.error} onRetry={menu.reload} />
        )}
      </div>

      {editing && (
        <CustomizeDialog
          item={editing.item}
          toppings={toppings}
          existing={editing.index >= 0 ? lines[editing.index] : null}
          onSave={saveLine}
          onClose={() => setEditing(null)}
          className="kiosk-modal"
          width={600}
        />
      )}

      {placed && (
        <Modal title="Thank you!" submitLabel="Start a new order" onClose={startOver} className="kiosk-modal kiosk-done">
          <p className="kiosk-done-number">Order #{placed.id}</p>
          <p>
            {money(placed.totalCents)}
            {PAYMENT_NOTES[payment]}
          </p>
          <p>We'll call your number when your drinks are ready.</p>
        </Modal>
      )}
    </main>
  );
}

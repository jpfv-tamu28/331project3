import { useRef, useState } from 'react';
import MenuTab from './manager/MenuTab';
import InventoryTab from './manager/InventoryTab';
import EmployeesTab from './manager/EmployeesTab';
import ReportsTab from './manager/ReportsTab';
import XReportTab from './manager/XReportTab';
import ProductUsageTab from './manager/ProductUsageTab';
import DiscountsTab from './manager/DiscountsTab';
import './Manager.css';

const PAGES = [
  { key: 'menu', label: 'Menu Items', Component: MenuTab },
  { key: 'inventory', label: 'Inventory', Component: InventoryTab },
  { key: 'employees', label: 'Employees', Component: EmployeesTab },
  { key: 'reports', label: 'Reports', Component: ReportsTab },
  { key: 'x-report', label: 'X-Report', Component: XReportTab },
  { key: 'usage', label: 'Product Usage', Component: ProductUsageTab },
  { key: 'discounts', label: 'Discounts', Component: DiscountsTab },
];

export default function Manager() {
  const [active, setActiveKey] = useState(PAGES[0].key);
  // Visited tabs stay mounted (hidden) so filters, dates and results survive switching, like CardLayout.
  const [visited, setVisited] = useState(() => new Set([PAGES[0].key]));
  const setActive = (key) => {
    setActiveKey(key);
    setVisited((v) => (v.has(key) ? v : new Set(v).add(key)));
  };
  // Bumped by Refresh; the list tabs reload when it changes (Manager.refreshAll).
  const [refreshKey, setRefreshKey] = useState(0);
  const tabRefs = useRef({});

  // Arrow keys / Home / End move between tabs (WAI-ARIA tabs pattern).
  const onTabKeyDown = (e, index) => {
    const moves = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: PAGES.length - 1 };
    if (!(e.key in moves)) return;
    e.preventDefault();
    const next = PAGES[(moves[e.key] + PAGES.length) % PAGES.length];
    setActive(next.key);
    tabRefs.current[next.key]?.focus();
  };

  return (
    <main className="manager">
      <div className="manager-top">
        <div className="manager-header">
          <h1>Manager Dashboard</h1>
          <button type="button" className="btn btn-secondary" onClick={() => setRefreshKey((k) => k + 1)}>
            Refresh
          </button>
        </div>
        <div className="tab-row manager-tabs" role="tablist" aria-label="Manager sections">
          {PAGES.map((page, i) => (
            <button
              key={page.key}
              ref={(el) => { tabRefs.current[page.key] = el; }}
              id={`tab-${page.key}`}
              type="button"
              role="tab"
              className="tab"
              aria-selected={active === page.key}
              aria-controls={`panel-${page.key}`}
              tabIndex={active === page.key ? 0 : -1}
              onClick={() => setActive(page.key)}
              onKeyDown={(e) => onTabKeyDown(e, i)}
            >
              {page.label}
            </button>
          ))}
        </div>
      </div>

      {PAGES.filter((p) => visited.has(p.key)).map(({ key, Component }) => (
        <div
          key={key}
          id={`panel-${key}`}
          role="tabpanel"
          aria-labelledby={`tab-${key}`}
          className="manager-panel"
          hidden={active !== key}
        >
          <Component refreshKey={refreshKey} />
        </div>
      ))}
    </main>
  );
}
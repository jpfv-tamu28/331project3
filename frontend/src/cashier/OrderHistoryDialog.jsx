import { useState } from 'react';
import { Api } from '../api';
import { DataTable, Modal, SectionBar, StateMessage, useResource } from '../components/ui';
import { capitalize, money } from '../format';

const ORDER_COLUMNS = [
  { key: 'id', label: 'Order ID', type: 'id' },
  { key: 'createdAt', label: 'Date / Time' },
  { key: 'cashier', label: 'Cashier' },
  { key: 'status', label: 'Status', render: (o) => capitalize(o.status) },
  { key: 'totalCents', label: 'Total', type: 'cents' },
];

const ITEM_COLUMNS = [
  { key: 'name', label: 'Item / Customization', render: (i) => (i.parentId ? `+ ${i.name}` : i.name) },
  { key: 'quantity', label: 'Qty', type: 'number' },
  { key: 'unitPriceCents', label: 'Unit Price', type: 'cents' },
  { key: 'lineCents', label: 'Total', type: 'cents', render: (i) => money(i.unitPriceCents * i.quantity) },
];

/** Last 100 orders; pick one to see its lines (Cashier.openOrderHistoryDialog). */
export default function OrderHistoryDialog({ onClose }) {
  const orders = useResource(() => Api.orders(100), []);
  const [selected, setSelected] = useState(null);
  const items = useResource(() => (selected ? Api.orderItems(selected) : Promise.resolve([])), [selected]);

  return (
    <Modal
      title="Order History"
      submitLabel="Close"
      onClose={onClose}
      width={900}
      headerAction={(
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => {
            setSelected(null);
            orders.reload();
          }}
        >
          Refresh
        </button>
      )}
    >
      <div className="history">
        <section className="history-orders" aria-label="Orders">
          <SectionBar title="Orders" note="Last 100 · select one to see its items" />
          <div className="table-wrap">
            {orders.data ? (
              <DataTable
                caption="Recent orders"
                columns={ORDER_COLUMNS}
                rows={orders.data}
                rowKey={(o) => o.id}
                selectedKey={selected}
                onSelect={(o) => setSelected(o.id)}
                emptyText="No orders yet"
              />
            ) : (
              <StateMessage loading={orders.loading} error={orders.error} onRetry={orders.reload} />
            )}
          </div>
        </section>
        <section className="history-items" aria-label="Items in selected order">
          <SectionBar title="Items in selected order" note={selected ? `Order #${selected}` : 'Select an order above'} />
          <div className="table-wrap">
            {items.error ? (
              <StateMessage error={items.error} onRetry={items.reload} />
            ) : (
              <DataTable
                caption={selected ? `Items in order ${selected}` : 'No order selected'}
                columns={ITEM_COLUMNS}
                rows={selected && !items.loading ? items.data ?? [] : []}
                rowKey={(i) => i.id}
                rowClassName={(i) => (i.parentId ? 'child-row' : '')}
                emptyText={selected ? (items.loading ? 'Loading…' : 'This order has no items') : 'Select an order above'}
              />
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}

import { useState } from 'react';
import { Api, errorMessage } from '../api';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { StateMessage } from '../components/StateMessage';
import { useResource } from '../components/useResource';
import { useToast } from '../components/ToastProvider';
import { money, parsePriceCents } from '../format';

const TYPES = [
  { value: 'PERCENT', label: 'Percent off' },
  { value: 'FIXED', label: 'Fixed amount off' },
];

const COLUMNS = [
  { key: 'code', label: 'Code' },
  { key: 'description', label: 'Description', render: (d) => d.description || '-' },
  { key: 'value', label: 'Discount', render: (d) => (d.type === 'PERCENT' ? `${d.value}% off` : `${money(d.value)} off`) },
  { key: 'minOrderCents', label: 'Min Order', render: (d) => (d.minOrderCents ? money(d.minOrderCents) : 'None') },
  { key: 'timesUsed', label: 'Used', render: (d) => (d.maxUses == null ? `${d.timesUsed}` : `${d.timesUsed} / ${d.maxUses}`) },
  { key: 'expiresAt', label: 'Expires', render: (d) => d.expiresAt ?? 'Never' },
  { key: 'status', label: 'Status' },
];

/** Lists every discount code (including inactive and expired ones) and adds new ones. */
export default function DiscountsTab({ refreshKey }) {
  const discounts = useResource(() => Api.discounts(), [refreshKey]);
  const [adding, setAdding] = useState(false);

  if (!discounts.data) {
    return <StateMessage loading={discounts.loading} error={discounts.error} onRetry={discounts.reload} />;
  }
  return (
    <>
      <div className="toolbar">
        <div className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>Add Code</button>
      </div>
      <div className="panel-fill table-wrap">
        <DataTable
          caption="Discount codes"
          columns={COLUMNS}
          rows={discounts.data}
          rowKey={(d) => d.id}
          emptyText="No discount codes yet"
        />
      </div>
      {adding && (
        <DiscountDialog
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            discounts.reload();
          }}
        />
      )}
    </>
  );
}

function DiscountDialog({ onClose, onSaved }) {
  const toast = useToast();
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState(TYPES[0].value);
  const [value, setValue] = useState('');
  const [minOrder, setMinOrder] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expires, setExpires] = useState('');
  const [isActive, setActive] = useState(true);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const cleanCode = code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,50}$/.test(cleanCode)) {
      toast.warning('Check the code', 'Use 3 to 50 letters, numbers, dashes or underscores.');
      return;
    }

    let amount;
    if (type === 'PERCENT') {
      amount = Number(value);
      if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
        toast.warning('Check the discount', 'Percent must be a whole number from 1 to 100.');
        return;
      }
    } else {
      amount = parsePriceCents(value);
      if (amount === null || amount === 0) {
        toast.warning('Check the discount', 'Enter a valid amount, e.g. 2.00');
        return;
      }
    }

    const minOrderCents = minOrder.trim() === '' ? 0 : parsePriceCents(minOrder);
    if (minOrderCents === null) {
      toast.warning('Check the minimum', 'Enter a valid minimum order, e.g. 10.00, or leave it blank.');
      return;
    }

    const uses = maxUses.trim() === '' ? null : Number(maxUses);
    if (uses !== null && (!Number.isInteger(uses) || uses < 1)) {
      toast.warning('Check the usage limit', 'Max uses must be a whole number of 1 or more, or blank for unlimited.');
      return;
    }

    setBusy(true);
    try {
      await Api.createDiscount({
        code: cleanCode,
        description: description.trim() || null,
        type,
        value: amount,
        minOrderCents,
        maxUses: uses,
        expiresAt: expires || null,
        isActive,
      });
      toast.success('Discount code added', cleanCode);
      onSaved();
    } catch (err) {
      toast.error('Error saving discount code', errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Modal title="Add Discount Code" submitLabel="Save" onSubmit={save} onClose={onClose} busy={busy}>
      <div className="form-grid">
        <label htmlFor="dc-code">Code</label>
        <input id="dc-code" className="field" placeholder="e.g. WELCOME10" value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())} />
        <label htmlFor="dc-desc">Description</label>
        <input id="dc-desc" className="field" placeholder="Shown to cashiers" value={description}
          onChange={(e) => setDescription(e.target.value)} />
        <label htmlFor="dc-type">Type</label>
        <select id="dc-type" className="field" value={type} onChange={(e) => setType(e.target.value)}>
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <label htmlFor="dc-value">{type === 'PERCENT' ? 'Percent off (%)' : 'Amount off ($)'}</label>
        <input id="dc-value" className="field" inputMode="decimal" placeholder={type === 'PERCENT' ? '10' : '2.00'}
          value={value} onChange={(e) => setValue(e.target.value)} style={{ width: 120 }} />
        <label htmlFor="dc-min">Min order ($)</label>
        <input id="dc-min" className="field" inputMode="decimal" placeholder="None" value={minOrder}
          onChange={(e) => setMinOrder(e.target.value)} style={{ width: 120 }} />
        <label htmlFor="dc-max">Max uses</label>
        <input id="dc-max" className="field" inputMode="numeric" placeholder="Unlimited" value={maxUses}
          onChange={(e) => setMaxUses(e.target.value.replace(/\D/g, ''))} style={{ width: 120 }} />
        <label htmlFor="dc-exp">Expires</label>
        <input id="dc-exp" type="date" className="field" value={expires} onChange={(e) => setExpires(e.target.value)} />
        <span />
        <label className="checkbox">
          <input type="checkbox" checked={isActive} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      </div>
    </Modal>
  );
}

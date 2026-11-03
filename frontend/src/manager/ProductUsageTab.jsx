import { useState } from 'react';
import { Api, errorMessage } from '../api';
import { ChipBar } from '../components/ChipBar';
import { DataTable } from '../components/DataTable';
import { useToast } from '../components/ToastProvider';
import { quantity } from '../format';
import { DateRangeToolbar, useDateRange } from './DateRange';

const ALL_UNITS = 'All units';
const COLUMNS = [
  { key: 'ingredient', label: 'Ingredient' },
  { key: 'unit', label: 'Unit' },
  { key: 'amount', label: 'Amount Used', type: 'number' },
];

/** Inventory used over a date range: sold quantity × recipe amounts, summed per ingredient (ProductUsage.java). */
export default function ProductUsageTab() {
  const toast = useToast();
  const [range, setRange] = useDateRange();
  const [results, setResults] = useState(null);
  const [unit, setUnit] = useState(ALL_UNITS);

  const run = async ({ from, to } = range) => {
    if (to < from) {
      toast.warning('Check the dates', 'The To date must be on or after the From date.');
      return;
    }
    try {
      const rows = await Api.productUsage(from, to);
      setResults(rows);
      // Keep the current unit when it's still offered.
      if (!rows.some((r) => r.unit === unit)) setUnit(ALL_UNITS);
    } catch (err) {
      toast.error("Couldn't load product usage", errorMessage(err));
    }
  };

  const units = [ALL_UNITS, ...[...new Set((results ?? []).map((r) => r.unit))].sort()];
  const shown = (results ?? []).filter((r) => unit === ALL_UNITS || r.unit === unit);

  return (
    <>
      <div className="toolbar">
        <ChipBar label="Unit" options={units} value={unit} onChange={setUnit} />
      </div>
      <DateRangeToolbar range={range} setRange={setRange} onRun={run} runLabel="Run" />
      <div className="usage-split">
        <UsageChart rows={shown} unit={unit === ALL_UNITS ? null : unit} ran={results !== null} />
        <div className="table-wrap">
          <DataTable caption="Amount used per ingredient" columns={COLUMNS} rows={shown}
            rowKey={(r) => `${r.ingredient}|${r.unit}`} emptyText={results ? 'No usage in this range' : 'No data yet'} />
        </div>
      </div>
    </>
  );
}

/**
 * Horizontal bars, longest first, one series in the tea-brown accent.
 * Units are mixed (g, ml, each), so the unit filter keeps bars comparable; the table beside it is the exact view.
 */
function UsageChart({ rows, unit, ran }) {
  const max = Math.max(...rows.map((r) => r.amount), 0) || 1;
  const title = `Amount used per ingredient${unit ? ` (${unit})` : ''}`;
  return (
    <figure className="bar-chart" aria-label={title}>
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted">{ran ? 'No ingredients were used in this range.' : 'Pick a date range and click Run.'}</p>
      ) : (
        <ol>
          {rows.map((r) => {
            const amount = `${quantity(r.amount)} ${r.unit}`;
            return (
              <li key={`${r.ingredient}|${r.unit}`}>
                <span className="bar-label" title={r.ingredient}>{r.ingredient}</span>
                <span className="bar-track" title={`${r.ingredient}: ${amount}`}>
                  <span className="bar" style={{ width: `calc((100% - 110px) * ${r.amount / max})` }} />
                  <span className="bar-value">{amount}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </figure>
  );
}

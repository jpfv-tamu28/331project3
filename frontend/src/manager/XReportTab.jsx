import { useCallback, useEffect, useState } from 'react';
import { Api, errorMessage } from '../api';
import { DataTable, StatTiles, useToast } from '../components/ui';
import { hourLabel, isoDate, longDate, money } from '../format';

const COLUMNS = [
  { key: 'hour', label: 'Hour', render: (h) => `${hourLabel(h.hour)} - ${hourLabel((h.hour + 1) % 24)}` },
  { key: 'orders', label: 'Orders', type: 'number' },
  { key: 'drinksSold', label: 'Drinks Sold', type: 'number' },
  { key: 'revenueCents', label: 'Revenue', type: 'cents' },
  { key: 'avgCents', label: 'Avg Order', type: 'cents' },
];

/** Hourly sales snapshot for one day, today by default. Read-only: running it doesn't reset anything. */
export default function XReportTab() {
  const toast = useToast();
  const [date, setDate] = useState(isoDate());
  const [report, setReport] = useState(null);

  const run = useCallback(async (day) => {
    try {
      const data = await Api.xReport(day);
      setReport({ ...data, generatedAt: new Date() });
    } catch (err) {
      toast.error("Couldn't run the X-Report", errorMessage(err));
    }
  }, [toast]);

  useEffect(() => {
    run(date);
  }, [date, run]);

  const hours = (report?.hours ?? []).map((h) => ({ ...h, avgCents: h.orders ? h.revenueCents / h.orders : 0 }));
  // The tiles carry the day's totals, so the table only lists hours.
  const orders = hours.reduce((s, h) => s + h.orders, 0);
  const drinks = hours.reduce((s, h) => s + h.drinksSold, 0);
  const revenue = hours.reduce((s, h) => s + h.revenueCents, 0);
  const generated = report?.generatedAt.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <>
      <div className="toolbar">
        <label className="subtle" htmlFor="xreport-date">Date</label>
        <input id="xreport-date" type="date" className="field" value={date} max={isoDate()}
          onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button type="button" className="btn btn-secondary" onClick={() => (date === isoDate() ? run(date) : setDate(isoDate()))}>
          Today
        </button>
        <div className="spacer" />
        <button type="button" className="btn btn-primary" onClick={() => run(date)}>Run X-Report</button>
      </div>
      <div className="xreport-overview">
        <StatTiles tiles={[
          { label: 'Orders', value: report ? orders.toLocaleString() : '-' },
          { label: 'Drinks sold', value: report ? drinks.toLocaleString() : '-' },
          { label: 'Revenue', value: report ? money(revenue) : '-' },
          { label: 'Average order', value: report && orders ? money(revenue / orders) : '-' },
        ]} />
        <p className="xreport-summary" aria-live="polite">
          {report && (orders === 0
            ? `No sales recorded for ${longDate(report.date)}. Generated ${generated}`
            : `X-Report for ${longDate(report.date)}. Generated ${generated}`)}
        </p>
      </div>
      <div className="panel-fill table-wrap">
        <DataTable caption="Sales by hour" columns={COLUMNS} rows={hours} rowKey={(h) => h.hour} emptyText="No sales for this day" />
      </div>
    </>
  );
}

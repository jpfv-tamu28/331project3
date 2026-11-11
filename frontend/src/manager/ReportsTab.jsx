import { useEffect, useState } from 'react';
import { Api, errorMessage } from '../api';
import { ChipBar } from '../components/ChipBar';
import { DataTable } from '../components/DataTable';
import { StateMessage } from '../components/StateMessage';
import { useResource } from '../components/useResource';
import { useToast } from '../components/ToastProvider';
import { DateRangeToolbar } from './DateRange';
import { useDateRange } from './useDateRange';

/** Pick a report and a date range, then run it (Reports.java). */
export default function ReportsTab({ refreshKey }) {
  const toast = useToast();
  const reports = useResource(() => Api.reportList(), []);
  const [chosen, setChosen] = useState(null);
  const [range, setRange] = useDateRange();
  const [result, setResult] = useState(null);
  const [running, setRunning] = useState(false);

  const list = reports.data ?? [];
  const current = chosen ?? list[0]?.key;

  const run = async (key = current, { from, to } = range) => {
    if (!key) return;
    if (to < from) {
      toast.warning('Check the dates', 'The To date must be on or after the From date.');
      return;
    }
    setRunning(true);
    try {
      setResult(await Api.report(key, from, to));
    } catch (err) {
      toast.error("Couldn't run the report", errorMessage(err));
    } finally {
      setRunning(false);
    }
  };

  useEffect(() => {
    if (refreshKey > 0 && result) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);
  
  if (!reports.data) {
    return <StateMessage loading={reports.loading} error={reports.error} onRetry={reports.reload} />;
  }

  const columns = result?.columns.map((c) => ({
    key: c.key,
    label: c.label,
    type: c.money ? 'money' : typeof result.rows[0]?.[c.key] === 'number' ? 'number' : 'text',
  }));

  return (
    <>
      <div className="toolbar">
        <ChipBar
          label="Report"
          options={list.map((r) => r.title)}
          value={list.find((r) => r.key === current)?.title}
          onChange={(title) => {
            const key = list.find((r) => r.title === title).key;
            setChosen(key);
            run(key);
          }}
        />
      </div>
      <DateRangeToolbar range={range} setRange={setRange} onRun={(r) => run(current, r)} runLabel="Run Report" />
      <div className="panel-fill table-wrap" aria-busy={running}>
        {result ? (
          <DataTable
            caption={result.title}
            columns={columns}
            rows={result.rows}
            rowKey={(row) => JSON.stringify(row)}
            emptyText="No sales in this date range"
          />
        ) : (
          <StateMessage loading={running}>Pick a report and date range, then press Run Report.</StateMessage>
        )}
      </div>
    </>
  );
}

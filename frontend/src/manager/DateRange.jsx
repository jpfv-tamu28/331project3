import { useId } from 'react';
import { ChipBar } from '../components/ChipBar';
import { daysAgo, isoDate } from '../format';
import { DEFAULT_RANGE_DAYS } from './useDateRange';

const PRESETS = {
  'Last 30 days': () => daysAgo(DEFAULT_RANGE_DAYS),
  'This month': () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  },
  'This quarter': () => {
    const d = new Date();
    return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
  },
  'This year': () => new Date(new Date().getFullYear(), 0, 1),
};

/**
 * Second toolbar row for range reports (DatePicker.rangeToolbar): quick ranges, the two dates, and the run button.
 * A quick range fills both dates and runs; picking a custom date clears the highlight.
 */
export function DateRangeToolbar({ range, setRange, onRun, runLabel }) {
  const today = isoDate();
  const id = useId();
  return (
    <div className="toolbar">
      <ChipBar
        label="Quick ranges"
        options={Object.keys(PRESETS)}
        value={range.preset}
        onChange={(preset) => {
          const next = { from: isoDate(PRESETS[preset]()), to: today, preset };
          setRange(next);
          onRun(next);
        }}
      />
      <label className="subtle" htmlFor={`${id}-from`}>From</label>
      <input id={`${id}-from`} type="date" className="field" value={range.from} max={today}
        onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value, preset: null })} />
      <label className="subtle" htmlFor={`${id}-to`}>to</label>
      <input id={`${id}-to`} type="date" className="field" value={range.to} max={today}
        onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value, preset: null })} />
      <div className="spacer" />
      <button type="button" className="btn btn-primary" onClick={() => onRun(range)}>{runLabel}</button>
    </div>
  );
}

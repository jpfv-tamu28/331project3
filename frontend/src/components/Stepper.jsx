export function Stepper({ value, min = 0, max = 99, onChange, label, small = false }) {
  return (
    <div className={`stepper${small ? ' small' : ''}`} role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min}
        aria-label={`Decrease ${label}`}>
        −
      </button>
      <output className={value === 0 ? 'zero' : undefined} aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max}
        aria-label={`Increase ${label}`}>
        +
      </button>
    </div>
  );
}

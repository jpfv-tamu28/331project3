/** Row of single-select filter buttons (DenseList.ChipBar). value may be null for "none highlighted". */
export function ChipBar({ options, value, onChange, label }) {
  return (
    <div className="chip-bar" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          className="chip"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

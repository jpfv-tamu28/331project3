import { useRef } from 'react';

/** Equal-width buttons where exactly one option is picked (DenseList.Segmented). */
export function Segmented({ options, value, onChange, label }) {
  const refs = useRef([]);
  // Arrow keys move between options, like a native radio group.
  const onKeyDown = (e, index) => {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    onChange(options[next].value ?? options[next]);
    refs.current[next]?.focus();
  };
  const selectedIndex = options.findIndex((o) => (o.value ?? o) === value);
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((option, i) => {
        const optValue = option.value ?? option;
        const checked = optValue === value;
        return (
          <button
            key={optValue}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (selectedIndex === -1 && i === 0) ? 0 : -1}
            onClick={() => onChange(optValue)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {option.label ?? option}
          </button>
        );
      })}
    </div>
  );
}

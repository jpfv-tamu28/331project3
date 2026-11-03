import { useEffect, useId, useRef } from 'react';

/**
 * Native <dialog> opened with showModal(): it traps focus, makes the page behind it inert and closes on Esc.
 * Mount it only while it should be open. Enter submits, like the Java dialogs' default button.
 */
export function Modal({
  title, onClose, onSubmit, submitLabel = 'OK', cancelLabel = 'Cancel', tone, width,
  busy = false, headerAction, className = '', children,
}) {
  const ref = useRef(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog.open) dialog.showModal();
    // Focus the first editable field, otherwise the main button (Alerts.firstTextField).
    const field = dialog.querySelector('input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea');
    (field ?? dialog.querySelector('button[type=submit]'))?.focus();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal ${className}`.trim()}
      aria-labelledby={titleId}
      style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
    >
      <form
        className="modal-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) (onSubmit ?? onClose)();
        }}
      >
        {tone && <div className={`modal-tone tone-${tone}`} />}
        <div className="modal-header">
          <h2 id={titleId}>{title}</h2>
          {headerAction}
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          {cancelLabel && onSubmit && (
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
              {cancelLabel}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Saving…' : submitLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}

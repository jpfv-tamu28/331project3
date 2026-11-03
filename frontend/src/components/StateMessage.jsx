export function StateMessage({ error, loading, onRetry, children }) {
  if (error) {
    return (
      <div className="state-message error" role="alert">
        <p>{error}</p>
        {onRetry && <button type="button" className="btn btn-secondary" onClick={onRetry}>Try again</button>}
      </div>
    );
  }
  if (loading) {
    return <div className="state-message" role="status">Loading…</div>;
  }
  return <div className="state-message">{children}</div>;
}

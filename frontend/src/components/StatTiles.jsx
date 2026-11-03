export function StatTiles({ tiles }) {
  return (
    <dl className="stat-tiles">
      {tiles.map((t) => (
        <div key={t.label} className="stat-tile">
          <dt>{t.label}</dt>
          <dd>{t.value}</dd>
        </div>
      ))}
    </dl>
  );
}

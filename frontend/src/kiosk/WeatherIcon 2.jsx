const stroke = {
  fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round',
};

const CLOUD = 'M7 18h10a4 4 0 0 0 .6-7.96A5.5 5.5 0 0 0 7.1 9.6 4.2 4.2 0 0 0 7 18Z';

function Sun({ cx = 12, cy = 12, r = 4, rays = true }) {
  const lines = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
    const a = (deg * Math.PI) / 180;
    return (
      <line
        key={deg}
        x1={cx + Math.cos(a) * (r + 2.5)} y1={cy + Math.sin(a) * (r + 2.5)}
        x2={cx + Math.cos(a) * (r + 4.5)} y2={cy + Math.sin(a) * (r + 4.5)}
      />
    );
  });
  return <g {...stroke}><circle cx={cx} cy={cy} r={r} />{rays && lines}</g>;
}

const Moon = ({ transform }) => (
  <path {...stroke} transform={transform} d="M19 14.5A7.5 7.5 0 1 1 9.5 5a6 6 0 0 0 9.5 9.5Z" />
);

const Drops = ({ heavy }) => (
  <g {...stroke}>
    {(heavy ? [8, 12, 16] : [9, 15]).map((x) => <line key={x} x1={x} y1="20" x2={x - 1} y2="22.5" />)}
  </g>
);

export default function WeatherIcon({ icon, isDay = true, className }) {
  let art;
  switch (icon) {
    case 'clear':
      art = isDay ? <Sun /> : <Moon />;
      break;
    case 'partly-cloudy':
      art = (
        <>
          {isDay ? <Sun cx={8.5} cy={8} r={3} /> : <Moon transform="translate(-3 -4) scale(0.75)" />}
          <path {...stroke} d="M9 20h8a3.5 3.5 0 0 0 .5-6.96 4.8 4.8 0 0 0-9.2 1.2A2.9 2.9 0 0 0 9 20Z" />
        </>
      );
      break;
    case 'fog':
      art = (
        <g {...stroke}>
          <path d={CLOUD} transform="translate(0 -3)" />
          <line x1="4" y1="19" x2="20" y2="19" />
          <line x1="6" y1="22" x2="18" y2="22" />
        </g>
      );
      break;
    case 'drizzle':
    case 'rain':
      art = <><path {...stroke} d={CLOUD} transform="translate(0 -2)" /><Drops heavy={icon === 'rain'} /></>;
      break;
    case 'snow':
      art = (
        <>
          <path {...stroke} d={CLOUD} transform="translate(0 -2)" />
          <g fill="currentColor">{[8, 12, 16].map((x, i) => <circle key={x} cx={x} cy={i === 1 ? 22 : 20.5} r="1.1" />)}</g>
        </>
      );
      break;
    case 'thunderstorm':
      art = (
        <>
          <path {...stroke} d={CLOUD} transform="translate(0 -2)" />
          <path {...stroke} d="M12.5 15.5 10 19.5h3l-1.5 3.5" />
        </>
      );
      break;
    default: // cloudy
      art = <path {...stroke} d={CLOUD} />;
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">{art}</svg>
  );
}

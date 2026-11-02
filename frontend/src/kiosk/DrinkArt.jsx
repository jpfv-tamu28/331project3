// Illustrated boba cup for a kiosk tile. The menu has no photos, so each drink gets a cup
// whose tea color comes from its name (taro is purple, matcha green, mango gold...).

const FLAVORS = [
  [/taro|ube/i, '#b39ad8'],
  [/matcha/i, '#8db365'],
  [/mango/i, '#f2b33d'],
  [/strawberry/i, '#ee8b9f'],
  [/thai/i, '#e98d4f'],
  [/brown sugar/i, '#b07345'],
  [/passion/i, '#efbf3f'],
  [/lychee/i, '#f4d6dc'],
  [/peach/i, '#f6a97c'],
  [/winter ?melon/i, '#d8c38e'],
  [/honeydew|melon/i, '#a9d68b'],
  [/jasmine|green tea/i, '#c9d47a'],
  [/oolong/i, '#c08f5f'],
  [/pumpkin|chai/i, '#d98a46'],
  [/coffee|espresso/i, '#8a5a3c'],
];
const FALLBACK = '#c9a27e'; // classic milk tea

export function flavorColor(name) {
  return FLAVORS.find(([pattern]) => pattern.test(name))?.[1] ?? FALLBACK;
}

/** Mixes a #rrggbb color toward white; amount 0 = unchanged, 1 = white. */
export function tint(hex, amount) {
  const n = Number.parseInt(hex.slice(1), 16);
  const mix = (c) => Math.round(c + (255 - c) * amount);
  return `rgb(${mix(n >> 16)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}

const PEARLS = [[40, 103], [50, 106], [60, 103], [70, 106], [80, 103], [45, 97], [56, 98], [66, 97], [76, 98]];

export default function DrinkArt({ item }) {
  const color = flavorColor(item.name);
  // Clear and fruit teas look translucent; milk teas and slushes are opaque.
  const clear = /fruit|clear/i.test(item.category);
  const slush = /slush/i.test(item.category);
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true" focusable="false" className="drink-art">
      {/* straw */}
      <rect x="66" y="6" width="7" height="40" rx="2" transform="rotate(12 69 26)" fill="#1f1d1b" opacity="0.85" />
      {/* lid dome */}
      <path d="M30 34 Q60 14 90 34 Z" fill="#ffffff" stroke="#1f1d1b" strokeOpacity="0.25" strokeWidth="1.5" />
      <rect x="27" y="33" width="66" height="6" rx="3" fill="#ffffff" stroke="#1f1d1b" strokeOpacity="0.25" strokeWidth="1.5" />
      {/* cup */}
      <path d="M31 40 L89 40 L82 112 Q60 116 38 112 Z" fill="#ffffff" fillOpacity="0.75" stroke="#1f1d1b" strokeOpacity="0.25" strokeWidth="1.5" />
      {/* drink */}
      <path d="M33 50 L87 50 L82 110 Q60 114 38 110 Z" fill={color} fillOpacity={clear ? 0.7 : 1} />
      {slush && <path d="M33 50 L87 50 L86 58 Q60 64 34 58 Z" fill="#ffffff" fillOpacity="0.55" />}
      {/* boba pearls */}
      {PEARLS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4.2" fill="#2b1f1a" />)}
      {/* highlight */}
      <path d="M38 46 L42 46 L44 104 L41 104 Z" fill="#ffffff" fillOpacity="0.45" />
    </svg>
  );
}

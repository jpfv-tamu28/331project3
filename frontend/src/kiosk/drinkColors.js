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

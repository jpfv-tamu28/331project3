import { Router } from 'express';
import { pool } from '../db.js';
import { HttpError, asyncRoute } from '../http.js';

// The kiosk always shows the weather for the store's zip code.
const ZIP = '77840';
const PLACE = 'College Station, TX';
const LATITUDE = 30.6045;
const LONGITUDE = -96.3123;
const WEATHER_TTL_MS = 10 * 60 * 1000;

// api.weather.gov rejects requests without a User-Agent that names the app.
const NWS_HEADERS = { 'User-Agent': 'BobaBops-Kiosk/1.0 (CSCE 331 class project)', Accept: 'application/geo+json' };

// The National Weather Service describes conditions in words ("Partly Sunny", "Rain Showers Likely").
// Checked in order, so "Chance Rain And Snow" counts as snow and "Mostly Cloudy" isn't read as clear.
const NWS_ICONS = [
  [/thunder|t-storm/i, 'thunderstorm'],
  [/snow|sleet|flurr|ice|wintry|blizzard/i, 'snow'],
  [/drizzle/i, 'drizzle'],
  [/rain|shower/i, 'rain'],
  [/fog|haze|mist|smoke|dust/i, 'fog'],
  [/partly|mostly sunny|mostly clear/i, 'partly-cloudy'],
  [/sunny|clear|fair/i, 'clear'],
];

// WMO weather codes (https://open-meteo.com/en/docs) grouped into the icons the kiosk can draw.
const WMO_CONDITIONS = [
  [[0], 'clear', 'Clear'],
  [[1], 'clear', 'Mostly clear'],
  [[2], 'partly-cloudy', 'Partly cloudy'],
  [[3], 'cloudy', 'Overcast'],
  [[45, 48], 'fog', 'Fog'],
  [[51, 53, 55, 56, 57], 'drizzle', 'Drizzle'],
  [[61, 63, 65, 66, 67, 80, 81, 82], 'rain', 'Rain'],
  [[71, 73, 75, 77, 85, 86], 'snow', 'Snow'],
  [[95, 96, 99], 'thunderstorm', 'Thunderstorm'],
];

function describeNwsForecast(text) {
  const icon = NWS_ICONS.find(([pattern]) => pattern.test(text))?.[1] ?? 'cloudy';
  return { icon, condition: text };
}

function describeWeatherCode(code) {
  const match = WMO_CONDITIONS.find(([codes]) => codes.includes(code));
  return match ? { icon: match[1], condition: match[2] } : { icon: 'cloudy', condition: 'Cloudy' };
}

async function fetchJson(url, headers = {}) {
  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
  } catch (err) {
    // Node's "fetch failed" hides the reason (DNS, refused, timeout) in err.cause.
    throw new Error(`${url} failed: ${err.cause?.code ?? err.cause?.message ?? err.message}`);
  }
  if (!res.ok) throw new Error(`${url} responded with ${res.status}`);
  return res.json();
}

// Primary source: the National Weather Service. Free, no key, and no rate limit shared with
// everyone else on a cloud host the way Open-Meteo's free tier has.
let nwsForecastUrl = null; // the store's NWS grid never changes, so look it up once
async function fromNws() {
  if (!nwsForecastUrl) {
    const point = await fetchJson(`https://api.weather.gov/points/${LATITUDE},${LONGITUDE}`, NWS_HEADERS);
    nwsForecastUrl = point.properties.forecastHourly;
  }
  const hour = (await fetchJson(nwsForecastUrl, NWS_HEADERS)).properties.periods[0];
  const f = hour.temperatureUnit === 'C' ? (hour.temperature * 9) / 5 + 32 : hour.temperature;
  return {
    temperatureF: Math.round(f),
    ...describeNwsForecast(hour.shortForecast),
    isDay: hour.isDaytime,
    observedAt: hour.startTime,
  };
}

// Fallback: Open-Meteo. Its free tier limits requests per IP, and Render's outbound IPs are shared,
// so on the deployed site it often answers 429.
async function fromOpenMeteo() {
  const params = new URLSearchParams({
    latitude: LATITUDE,
    longitude: LONGITUDE,
    current: 'temperature_2m,weather_code,is_day',
    temperature_unit: 'fahrenheit',
    timezone: 'auto',
  });
  const { current } = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
  return {
    temperatureF: Math.round(current.temperature_2m),
    ...describeWeatherCode(current.weather_code),
    isDay: current.is_day === 1,
    observedAt: current.time,
  };
}

const SOURCES = [['nws', fromNws], ['open-meteo', fromOpenMeteo]];
let cached = null; // { at, data }

async function getWeather() {
  if (cached && Date.now() - cached.at < WEATHER_TTL_MS) return cached.data;
  for (const [source, load] of SOURCES) {
    try {
      const data = { zip: ZIP, place: PLACE, ...(await load()), source };
      cached = { at: Date.now(), data };
      return data;
    } catch (err) {
      console.error(`[WARN] Weather lookup failed (${source}):`, err.message);
    }
  }
  // Every source failed: the last reading is better than nothing.
  if (!cached) throw new HttpError(502, 'The weather service is unavailable right now.');
  return cached.data;
}

const HOT_F = 85;
const COLD_F = 60;
const GLOOMY = ['rain', 'drizzle', 'thunderstorm', 'snow', 'fog'];

/** Picks the menu categories to suggest for the weather, best fit first. */
export function suggestCategories({ temperatureF, icon }) {
  if (GLOOMY.includes(icon) || temperatureF < COLD_F) {
    return { reason: 'Cozy up with something creamy', categories: ['Milk Tea', 'Specialty'] };
  }
  if (temperatureF >= HOT_F) {
    return { reason: 'Beat the heat with something icy', categories: ['Slush', 'Fruit/Clear Tea'] };
  }
  return { reason: 'A light, fruity pick for a nice day', categories: ['Fruit/Clear Tea', 'Milk Tea'] };
}

const SUGGESTION_COUNT = 3;

const router = Router();

// GET /api/weather -> { zip, place, temperatureF, icon, condition, isDay, observedAt, source }
router.get('/', asyncRoute(async (_req, res) => {
  res.json(await getWeather());
}));

// GET /api/weather/suggestions -> { weather, reason, items: [{ id, name, category, description, priceCents }] }
// A weather outage only hides the suggestions, so it answers with an empty list instead of an error.
router.get('/suggestions', asyncRoute(async (_req, res) => {
  let weather;
  try {
    weather = await getWeather();
  } catch {
    res.json({ weather: null, reason: null, items: [] });
    return;
  }
  const { reason, categories } = suggestCategories(weather);
  const { rows } = await pool.query(
    `SELECT menu_item_id AS id, name, category, description, price_cents AS "priceCents"
     FROM menu_items
     WHERE is_available AND item_type = 'drink' AND category = ANY($1)
     ORDER BY array_position($1, category), name
     LIMIT $2`,
    [categories, SUGGESTION_COUNT],
  );
  res.json({ weather, reason, items: rows });
}));

export default router;

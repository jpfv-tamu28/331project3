import { Router } from 'express';
import { HttpError, asyncRoute } from '../http.js';

export const DEFAULT_ZIP = process.env.WEATHER_ZIP || '77840';
const ZIP_PATTERN = /^\d{5}$/;
const WEATHER_TTL_MS = 10 * 60 * 1000;

// WMO weather codes (https://open-meteo.com/en/docs) grouped into the icons the kiosk can draw.
const CONDITIONS = [
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

/** Maps a WMO code to { icon, condition }; unknown codes fall back to a plain cloud. */
export function describeWeatherCode(code) {
  const match = CONDITIONS.find(([codes]) => codes.includes(code));
  return match ? { icon: match[1], condition: match[2] } : { icon: 'cloudy', condition: 'Cloudy' };
}

async function defaultFetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const err = new Error(`${url} responded with ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function createWeatherRoutes({ fetchJson = defaultFetchJson, now = Date.now } = {}) {
  const router = Router();
  const places = new Map();
  const cache = new Map();

  async function lookupPlace(zip) {
    if (places.has(zip)) return places.get(zip);
    let body;
    try {
      body = await fetchJson(`https://api.zippopotam.us/us/${zip}`);
    } catch (err) {
      if (err.status === 404) throw new HttpError(404, `Zip code ${zip} was not found.`);
      throw err;
    }
    const place = body.places?.[0];
    if (!place) throw new HttpError(404, `Zip code ${zip} was not found.`);
    const result = {
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
      name: `${place['place name']}, ${place['state abbreviation']}`,
    };
    places.set(zip, result);
    return result;
  }

  // GET /api/weather?zip=77840 -> { zip, place, temperatureF, icon, condition, isDay, observedAt }
  router.get('/', asyncRoute(async (req, res) => {
    const zip = String(req.query.zip ?? DEFAULT_ZIP).trim();
    if (!ZIP_PATTERN.test(zip)) throw new HttpError(400, 'Zip code must be 5 digits.');

    const cached = cache.get(zip);
    if (cached && now() - cached.at < WEATHER_TTL_MS) {
      res.json(cached.data);
      return;
    }

    try {
      const place = await lookupPlace(zip);
      const params = new URLSearchParams({
        latitude: place.latitude,
        longitude: place.longitude,
        current: 'temperature_2m,weather_code,is_day',
        temperature_unit: 'fahrenheit',
        timezone: 'auto',
      });
      const { current } = await fetchJson(`https://api.open-meteo.com/v1/forecast?${params}`);
      const data = {
        zip,
        place: place.name,
        temperatureF: Math.round(current.temperature_2m),
        ...describeWeatherCode(current.weather_code),
        isDay: current.is_day === 1,
        observedAt: current.time,
      };
      cache.set(zip, { at: now(), data });
      res.json(data);
    } catch (err) {
      if (err instanceof HttpError) throw err;
      if (cached) {
        res.json(cached.data);
        return;
      }
      console.error('[WARN] Weather lookup failed:', err.message);
      throw new HttpError(502, 'The weather service is unavailable right now.');
    }
  }));

  return router;
}

export default createWeatherRoutes();

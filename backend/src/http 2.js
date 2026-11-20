// Small helpers shared by the route files.

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Lets async route handlers throw; Express 4 doesn't catch rejected promises on its own. */
export const asyncRoute = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export const PIN_PATTERN = /^\d{6}$/;

export function requireText(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, `${label} is required.`);
  }
  return value.trim();
}

export function requireNonNegativeNumber(value, label) {
  const n = typeof value === 'string' ? Number(value.trim()) : value;
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    throw new HttpError(400, `${label} must be a non-negative number.`);
  }
  return n;
}

export function requireCents(value, label = 'Price') {
  if (!Number.isInteger(value) || value < 0) {
    throw new HttpError(400, `${label} must be a whole number of cents, 0 or more.`);
  }
  return value;
}

export function requireId(value, label = 'ID') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new HttpError(400, `${label} must be a positive integer.`);
  }
  return n;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Validates a YYYY-MM-DD string and returns it unchanged. */
export function requireDate(value, label) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, `${label} must be a date in YYYY-MM-DD format.`);
  }
  return value;
}

/** Validates ?from=&to= and returns them; `to` is inclusive, so SQL should use < to + 1 day. */
export function requireRange(query) {
  const from = requireDate(query.from, 'from');
  const to = requireDate(query.to, 'to');
  if (to < from) {
    throw new HttpError(400, 'The "to" date must be on or after the "from" date.');
  }
  return { from, to };
}

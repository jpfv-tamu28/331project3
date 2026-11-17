import { HttpError } from './http.js';

// Resend's shared test sender. It can only deliver to the email that owns the Resend account,
// so set RESEND_FROM to an address on a verified domain to email real customers.
const DEFAULT_FROM = 'Boba Bops <onboarding@resend.dev>';

export const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Sends one email through the Resend API (https://resend.com/docs/api-reference/emails/send-email). */
export async function sendEmail({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new HttpError(503, 'Email is not set up on this server.');

  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || DEFAULT_FROM, to: [to], subject, html }),
      signal: AbortSignal.timeout(8000),
    });
  } catch (err) {
    console.error('[WARN] Resend request failed:', err.cause?.code ?? err.message);
  }
  if (!res?.ok) {
    if (res) console.error(`[WARN] Resend responded with ${res.status}:`, await res.text());
    throw new HttpError(502, 'The email could not be sent right now.');
  }
}

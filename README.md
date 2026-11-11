# Welcome to Group 55's Project 3

Boba Bops point-of-sale web app: a React frontend and a Node/Express API over the
team's PostgreSQL database on the TAMU server. The Cashier and Manager screens are
ports of the Project 2 Java Swing app.

Website link: https://three31project3-7gku.onrender.com

## Layout

```
backend/            Express API (port 3001)
  src/server.js     app setup, routes, error handling, serves frontend/dist in production
  src/db.js         pg connection pool + transaction helper
  src/routes/       auth, menu, inventory, employees, orders, reports
frontend/           React + Vite app (port 5173 in dev)
  src/Portal.jsx    entry screen: pick Kiosk, Cashier or Manager
  src/Kiosk.jsx     Customer Kiosk (+ src/kiosk/: cart panel, drink illustrations)
  src/Cashier.jsx   order entry (+ src/cashier/: customize dialog, order history, pricing)
  src/Manager.jsx   dashboard tabs (+ src/manager/: menu, inventory, employees, reports, X-report, product usage)
  src/components/   shared UI (auth provider, modal, toasts, tables, dense list, app shell)
database/           schema (setup.sql) and Project 2 queries
```

## Running locally

Requires Node 20+

```bash
cp backend/.env.example backend/.env   # set DB_PASSWORD, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET in backend/.env
npm install                            # installs the root, backend/ and frontend/ packages
npm run dev                            # starts the API (:3001) and the React app (:5173) together
```

Open http://localhost:5173. http://localhost:5173/api/health should report `"database": "connected"`.
Make sure you are on TAMU Wifi or TAMU VPN.

### Google OAuth 2.0 Setup

1. In the [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create an **OAuth 2.0 Client ID** (Web application).
2. Add the **Authorized redirect URIs**:
   - Local development: `http://localhost:5173/api/auth/google/callback`
   - Production (Render): `https://three31project3-7gku.onrender.com/api/auth/google/callback`
3. Copy the Client ID and Client Secret into `backend/.env` as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, and set `SESSION_SECRET` to a random string.

## How the screens work

| Route | What |
|---|---|
| `/` | Portal: choose Customer Kiosk (public), or Cashier / Manager (protected by Google OAuth). |
| `/kiosk` | Self-order kiosk for a landscape iPad (no sign-in required): menu sections scroll left to right with two rows of large square tiles; section tabs across the top jump between them; tapping a tile opens the same customize dialog the cashier uses; the cart button (top left) opens and closes the order panel; placing an order shows the order number and resets after 20 seconds. |
| `/cashier` | Requires Google OAuth sign-in. Menu grid with category tabs and search, drink customization (size, ice, sugar incl. 200%, add-ons ×1–5, quantity), current order with tax, discount code, payment method, order history. |
| `/manager` | Requires Google OAuth sign-in. Menu items (add, edit, seasonal item with recipe), inventory (low-stock grouping), employees, sales reports, X-report, product usage chart, discounts. |

The portal is the only screen that links to the views. Once a view is open it has no link to the portal or to
another view, and the portal is replaced in the browser history, so Back doesn't return to it either.
Orders placed this way have no employee attached (`orders.employee_id` is NULL, shown as "Unassigned").

## API

All routes are under `/api`. Errors come back as `{ "error": "message" }`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | DB connectivity check |
| GET | `/auth/me` | Current OAuth session (`{ authenticated, configured, user }`) |
| GET | `/auth/google?returnTo=` | Redirects to Google OAuth 2.0 consent screen |
| GET | `/auth/google/callback` | OAuth callback; exchanges code and sets `HttpOnly` session cookie |
| POST | `/auth/logout` | Clears the session cookie |
| GET | `/menu[?available=true]` | all items, or only sellable ones |
| POST / PUT | `/menu`, `/menu/:id` | `{ name, category, itemType, priceCents, isAvailable }` (requires OAuth) |
| POST | `/menu/seasonal` | adds a Seasonal item and its recipe in one transaction (requires OAuth) |
| GET / POST / PUT | `/inventory`, `/inventory/:id` | `{ name, unit, onHand, reorderLevel }` (requires OAuth) |
| GET / POST / PUT | `/employees`, `/employees/:id` | `{ name, role, pin, isActive }`; PINs are never returned (requires OAuth) |
| GET | `/orders?limit=100` | most recent first (requires OAuth) |
| GET | `/orders/:id/items` | lines of one order; add-ons carry `parentId` (requires OAuth) |
| GET / POST | `/orders/discounts` | list all discount codes or create a new one (requires OAuth) |
| GET | `/orders/discounts/:code` | validates a discount code |
| POST | `/orders` | see below |
| GET | `/reports` | list of range reports (requires OAuth) |
| GET | `/reports/:key?from=&to=` | `daily-sales`, `top-items`, `sales-by-hour`, `category-sales`, `employee-performance` (requires OAuth) |
| GET | `/reports/x-report?date=` | hourly totals for one day (requires OAuth) |
| GET | `/reports/product-usage?from=&to=` | ingredient usage from recipes (requires OAuth) |

`POST /orders` takes `{ employeeId?, paymentMethod, discountCode?, items: [{ menuItemId, size: S|M|L, ice, sugar, quantity, toppings: [{ menuItemId, count }] }] }`.
The server looks up every price in the database and computes subtotal, 8.25% tax and discount itself, so totals
can't be changed from the browser. The order and its lines are written in one transaction.

## Deploying to Render

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Environment:** `DB_PASSWORD`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_SECRET` (plus the other `DB_*` values from `backend/.env.example` if they differ). Render sets `PORT`.

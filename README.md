# Welcome to Group 55's Project 3

Boba Bops point-of-sale web app: a React frontend and a Node/Express API over the
team's PostgreSQL database on the TAMU server. The Cashier and Manager screens are
ports of the Project 2 Java Swing app (`src/*.java`).

Website link: https://three31project3-7gku.onrender.com

## Layout

```
backend/            Express API (port 3001)
  src/server.js     app setup, routes, error handling, serves frontend/dist in production
  src/db.js         pg connection pool + transaction helper
  src/routes/       menu, inventory, employees, orders, reports
frontend/           React + Vite app (port 5173 in dev)
  src/Portal.jsx    entry screen: pick Kiosk, Cashier or Manager
  src/Kiosk.jsx     Customer Kiosk (+ src/kiosk/: cart panel, drink illustrations)
  src/Cashier.jsx   order entry (+ src/cashier/: customize dialog, order history, pricing)
  src/Manager.jsx   dashboard tabs (+ src/manager/: menu, inventory, employees, reports, X-report, product usage)
  src/components/   shared UI (modal, toasts, tables, dense list, app shell)
database/           schema (setup.sql) and Project 2 queries
src/                Project 2 Java Swing app (reference for the web screens)
```

## Running locally

Requires Node 20+. Run these from the project root (the folder with this README):

```bash
cp backend/.env.example backend/.env   # then set DB_PASSWORD in backend/.env
npm install                            # installs the root, backend/ and frontend/ packages
npm run dev                            # starts the API (:3001) and the React app (:5173) together
```

Open http://localhost:5173. http://localhost:5173/api/health should report `"database": "connected"`.
Stop both with Ctrl+C.

Vite forwards `/api/*` to `localhost:3001`, so no CORS setup is needed in development.

## How the screens work

| Route | What |
|---|---|
| `/` | Portal: choose Customer Kiosk, Cashier or Manager. No sign-in. |
| `/kiosk` | Self-order kiosk for a landscape iPad: menu sections scroll left to right with two rows of large square tiles; section tabs across the top jump between them; tapping a tile opens the same customize dialog the cashier uses; the cart button (top left) opens and closes the order panel; placing an order shows the order number and resets after 20 seconds. |
| `/cashier` | Menu grid with category tabs and search, drink customization (size, ice, sugar incl. 200%, add-ons ×1–5, quantity), current order with tax, discount code, payment method, order history. |
| `/manager` | Menu items (add, edit, seasonal item with recipe), inventory (low-stock grouping), employees, sales reports, X-report, product usage chart. |

The portal is the only screen that links to the views. Once a view is open it has no link to the portal or to
another view, and the portal is replaced in the browser history, so Back doesn't return to it either.
Orders placed this way have no employee attached (`orders.employee_id` is NULL, shown as "Unassigned").

## API

All routes are under `/api`. Errors come back as `{ "error": "message" }`.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | DB connectivity check |
| GET | `/menu[?available=true]` | all items, or only sellable ones |
| POST / PUT | `/menu`, `/menu/:id` | `{ name, category, itemType, priceCents, isAvailable }` |
| POST | `/menu/seasonal` | adds a Seasonal item and its recipe in one transaction |
| GET / POST / PUT | `/inventory`, `/inventory/:id` | `{ name, unit, onHand, reorderLevel }` |
| GET / POST / PUT | `/employees`, `/employees/:id` | `{ name, role, pin, isActive }`; PINs are never returned |
| GET | `/orders?limit=100` | most recent first |
| GET | `/orders/:id/items` | lines of one order; add-ons carry `parentId` |
| GET | `/orders/discounts/:code` | validates a discount code |
| POST | `/orders` | see below |
| GET | `/reports` | list of range reports |
| GET | `/reports/:key?from=&to=` | `daily-sales`, `top-items`, `sales-by-hour`, `category-sales`, `employee-performance` |
| GET | `/reports/x-report?date=` | hourly totals for one day |
| GET | `/reports/product-usage?from=&to=` | ingredient usage from recipes |

`POST /orders` takes `{ employeeId?, paymentMethod, discountCode?, items: [{ menuItemId, size: S|M|L, ice, sugar, quantity, toppings: [{ menuItemId, count }] }] }`.
The server looks up every price in the database and computes subtotal, 8.25% tax and discount itself, so totals
can't be changed from the browser. The order and its lines are written in one transaction.

## Deploying to Render

One Web Service can host both halves: Express serves the built React app.

- **Build command:** `npm install && npm run build`
- **Start command:** `npm start`
- **Environment:** `DB_PASSWORD` (plus the other `DB_*` values from `backend/.env.example` if they differ). Render sets `PORT`.

If the frontend is instead deployed as a separate static site, build it with `VITE_API_URL=https://<api-host>/api`
and set `CORS_ORIGIN=https://<frontend-host>` on the API.

## Known gaps / next steps

- **There is no sign-in.** Anyone who can open the site, or call the API directly, can use the Manager view and
  its routes. Employee PINs are still stored and editable for when sign-in comes back.
- Payment method is sent with each order but not stored; `orders` has no column for it yet.
- `orders`, `menu_items` and `employees` IDs are not `SERIAL`, so new IDs are `MAX + 1` under a table lock.
  Switching those columns to identity columns would remove the lock.
- The menu has no photos, so kiosk tiles show an illustrated cup colored from the drink's name (`src/kiosk/DrinkArt.jsx`).
  An `image_url` column on `menu_items` would let real photos replace it.

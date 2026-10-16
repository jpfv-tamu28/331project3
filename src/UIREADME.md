# Boba Bops Management System (Java Swing)

A desktop GUI for managing a boba shop: a manager login screen plus a management
system with Dashboard, Trend, Employee and Inventory views. Built with plain
Java Swing (no external libraries), based on the Figma design PDFs.

## Files

| File | Purpose |
|------|---------|
| `BobaBopsLogin.java` | Login screen. Entry point of the app. |
| `ManagementSystem.java` | Main window with all management views. |

## Requirements

- JDK 8 or newer (developed and compiled against JDK 21)
- A desktop environment (Swing needs a display)

## Build and run

Keep both files in the same folder (the login screen opens `ManagementSystem`,
and Log out opens the login screen again):

```bash
javac *.java
java BobaBopsLogin
```

To skip the login while developing, run the main window directly:

```bash
java ManagementSystem
```

---

## `BobaBopsLogin.java`

The "Log in as manager" screen.

- **Layout:** title, subtitle, employee ID field, "Access management system"
  button, and a footer with clickable Terms of Service / Privacy Policy links.
- **ID field:** shows `1234ABC` as grey placeholder text that clears on focus
  and returns if the field is left empty.
- **`handleLogin()`:** currently only checks that an ID was entered (empty or
  the placeholder is rejected with a warning). On success it opens
  `ManagementSystem` and closes the login window.
  **Replace this method's check with real authentication.**
- The footer links show placeholder dialogs.

## `ManagementSystem.java`

One `JFrame` containing a header bar, a navigation row, and a `CardLayout`
that swaps between views. Each view sits in its own scroll pane.

### Views

| View | Nav button | Contents |
|------|-----------|----------|
| Dashboard | "Dashboard" (header) | Profit/Expense/Customer cards, sales line chart, employee list, inventory with quick "Order 50" buttons, sales-by-item bar chart |
| Trend View | View Trends | Stat cards, time-range selector, 2x2 grid: Profits, Customers, Expenses, Sales of each item |
| Employee View | View Employees | Searchable/filterable task list, time-range selector, "Time spent on each task" bar chart |
| Inventory View | View inventory | Recommended refills, Inventory (stock levels), Past orders, Shop (order form with live totals) |
| Cashier View | Cashier View | Placeholder only. No design was provided yet. |

The header title changes with the active view. **Log out** returns to the login
screen.

### What works

- Navigation between all views.
- Employee View: task search box and a Filter button (filter by priority).
- Inventory View: typing an amount in the Shop updates each item's cost and the
  total live. Place Order confirms and then clears the amounts. "Order 50" and
  past-order "Place Order" buttons show confirmation dialogs.
- Stock levels are color-coded: red (0), olive (under 50), green (50+).

### What is not wired up yet

- Time-range selectors (48 hours ... max, Week/2 months/Year) only change the
  highlighted button. Hook into the `onSelect` callback of `segmented(...)`.
- The top-bar search box, Share button, "..." button, and the
  List/Grid/Calendar toggle do nothing yet.
- Orders are not saved anywhere.

### Sample data

All numbers are hard-coded `static final` arrays at the top of the class. Swap
these for your real data source (database, API, files):

| Constant | Used for |
|----------|----------|
| `PROFIT`, `EXPENSE` | Line chart data points |
| `ITEM_LABELS`, `ITEM_SALES` | Sales-by-item bar chart |
| `REFILLS` | Recommended refills / dashboard inventory (name, sold, change, remaining) |
| `STOCK` | Inventory table (name, days of stock, rate, remaining) |
| `TASKS` | Employee task list (id, employee, task, priority, date) |
| `SHOP_ITEMS`, `SHOP_UNIT`, `SHOP_PRESET` | Shop item names, unit prices, and pre-filled amounts |
| `RANGES`, `X_LABELS` | Time-range button labels and chart x-axis labels |

The stat cards (`$45,678.90`, `$2,405`, `10,353`) are set in `statRow()`.

### Code layout

Methods:

- `dashboardView()`, `trendView()`, `employeeView()`, `inventoryView()`,
  `cashierView()`: build each screen.
- `refillsCard()`, `inventoryCard()`, `pastOrdersCard()`, `shopCard()`: the
  inventory-screen cards.
- `buildHeader()`, `buildNav()`, `showView(key)`: top bar, navigation, view
  switching.
- Static helpers: `row(...)` (aligned table rows), `split(...)` (two cards side
  by side), `segmented(...)` (pill-style selector), `vbox()`, `leftWrap()`,
  `lbl()`.

Nested classes (custom-painted components):

| Class | Description |
|-------|-------------|
| `Card` | White rounded panel with an optional bold title |
| `RButton` | Rounded button with hover effect (dark, green, black variants) |
| `SegButton`, `RoundPanel` | Pieces of the segmented time-range selector |
| `Pill` | Rounded outline label for task names and priorities |
| `Avatar` | Circle with the person's initials |
| `Field` | Text field with a grey hint shown while empty |
| `LineChart`, `BarChart` | Charts drawn with Java2D, no chart library |
| `TasksCard` | The searchable, filterable task list |
| `ScrollPanel` | Panel that tracks viewport width so content resizes with the window |

## Notes

- Layout and chart values were read off the design PDFs, so spacing is close but
  not pixel-exact.
- Avatars are colored initials rather than photos.
- Shop unit prices beyond the first four items are placeholders; the first four
  are chosen so the default total matches the design ($352).
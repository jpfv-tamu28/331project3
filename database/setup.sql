-- deletes all tables
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS recipes CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS inventory CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- creates all tables detailed in the design doc
CREATE TABLE employees (
    employee_id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    pin CHAR(6) UNIQUE
);

CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    employee_id INT REFERENCES employees(employee_id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP NOT NULL,
    total_cents INT NOT NULL DEFAULT 0
);

CREATE TABLE menu_items (
    menu_item_id INT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    item_type VARCHAR(50) NOT NULL,
    description TEXT,
    price_cents INT NOT NULL,
    is_available BOOLEAN NOT NULL DEFAULT TRUE
);


CREATE TABLE inventory (
    inventory_id SERIAL PRIMARY KEY,
    ingredient_name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) NOT NULL,
    quantity_on_hand NUMERIC(10, 2) NOT NULL DEFAULT 0,
    reorder_level NUMERIC(10, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE recipes (
    menu_item_id INT REFERENCES menu_items(menu_item_id) ON DELETE CASCADE,
    inventory_id INT REFERENCES inventory(inventory_id) ON DELETE CASCADE,
    quantity_required NUMERIC(10, 2) NOT NULL,
    PRIMARY KEY (menu_item_id, inventory_id)
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INT REFERENCES orders(order_id) ON DELETE CASCADE,
    menu_item_id INT REFERENCES menu_items(menu_item_id),
    parent_order_item_id INT REFERENCES order_items(order_item_id) ON DELETE CASCADE,
    item_name_snapshot VARCHAR(255) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price_cents INT NOT NULL
);

-- random employees to be seeded
-- pin is the 6-digit login code; employees without one cannot log in
INSERT INTO employees (employee_id, name, role, is_active, pin) VALUES
(1, 'Alice Cashier', 'Cashier', TRUE, '298214'),
(2, 'Bob Barista', 'Barista', TRUE, NULL),
(3, 'Charlie Manager', 'Manager', TRUE, '582958'),
(4, 'Diana Shift Lead', 'Shift Lead', TRUE, NULL),
(5, 'Evan Barista', 'Barista', TRUE, NULL);

-- Load CSVs (run psql from the folder containing the CSVs)
\copy menu_items FROM 'menu_items.csv' WITH (FORMAT csv, HEADER true);
\copy orders FROM 'sales_history.csv' WITH (FORMAT csv, HEADER true);
\copy inventory FROM 'inventory.csv' WITH (FORMAT csv, HEADER true);
\copy recipes FROM 'recipes.csv' WITH (FORMAT csv, HEADER true);
\copy order_items FROM 'order_items.csv' WITH (FORMAT csv, HEADER true);

-- Sync SERIAL sequences with the explicit ids loaded above
SELECT setval('inventory_inventory_id_seq', (SELECT MAX(inventory_id) FROM inventory));
SELECT setval('order_items_order_item_id_seq', (SELECT MAX(order_item_id) FROM order_items));
# project2_squad55

Project 2 Github Repository for Squad 55.

# How to use

- In the database folder, run `script.py` to create .csv data
- Connect to psql server
- Also in the database folder, run `setup.sql` to initialize the schema
- Verify the schema has been setup correctly by running any of the other sql query files in the database folder
- To run the GUIs, first create a `.env` file in the project root containing `DB_PASSWORD=<squad password>` (it is gitignored), then run:

  ``` bash
  javac -cp "lib/*" -d bin .src/*.java
  ```
  ``` bash
  set -a; . ./.env; set +a
  ```
  ``` bash
  java -cp "bin:lib/*" Login
  ```
- Log in with a 6-digit PIN (set in the `pin` column of `employees`):
  - Cashier (Alice Cashier): `298214` opens the cashier view
  - Manager (Charlie Manager): `582958` opens both the cashier and manager views as tabs

# Included files

- average_order_by_weekday.sql
  - How many orders and how much per order does each day of the week bring in?
- category_sales_breakdown.sql
  - Lists revenue gained from each category
- employee_performance_report.sql
  - Lists the count of orders handled by each employee
- ingredient_inventory.sql
  - Lists the count of each ingredient in inventory
- low_performance_day_stats.sql
  - For each week, finds the day with the lowest total sales, show the sales amount, and identifies the top-selling menu item on that day
- menu_item_ingredient_cost.sql
  - Shows the ingredient cost of each menu item
- order_total_verification.sql
  - Lists any order whose total does not equal the sum of its line items (expect none).
- peak_sales_days.sql
  - Ranks the days in order of total product value sold
- sales_by_hour.sql
  - Lists the orders and their details within each previous hour
- top_selling_items.sql
  - Ranks all menu items by the amount of orders they have appeared in
- topping_popularity.sql
  - Ranks toppings by total quantity ordered and revenue generated
- weekly_sales_history.sql
  - Lists all orders given over the course of a week.

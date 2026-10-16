import csv
import random
from datetime import datetime, timedelta

MENU_ITEMS = [
    {"name": "Classic Milk Tea", "category": "Milk Tea", "item_type": "drink", "description": "Black tea with milk", "price_cents": 500, "is_available": True},
    {"name": "Taro Milk Tea", "category": "Milk Tea", "item_type": "drink", "description": "Sweet taro root blend", "price_cents": 550, "is_available": True},
    {"name": "Matcha Milk Tea", "category": "Milk Tea", "item_type": "drink", "description": "Premium matcha green tea", "price_cents": 600, "is_available": True},
    {"name": "Thai Tea", "category": "Milk Tea", "item_type": "drink", "description": "Spiced black tea with condensed milk", "price_cents": 550, "is_available": True},
    {"name": "Brown Sugar Boba Milk", "category": "Specialty", "item_type": "drink", "description": "Caramelized brown sugar with fresh milk", "price_cents": 650, "is_available": True},
    {"name": "Jasmine Green Tea", "category": "Fruit/Clear Tea", "item_type": "drink", "description": "Lightly floral green tea", "price_cents": 450, "is_available": True},
    {"name": "Mango Green Tea", "category": "Fruit/Clear Tea", "item_type": "drink", "description": "Jasmine tea with mango puree", "price_cents": 500, "is_available": True},
    {"name": "Passionfruit Black Tea", "category": "Fruit/Clear Tea", "item_type": "drink", "description": "Black tea with passionfruit seeds", "price_cents": 500, "is_available": True},
    {"name": "Wintermelon Tea", "category": "Specialty", "item_type": "drink", "description": "Traditional sweet wintermelon", "price_cents": 450, "is_available": True},
    {"name": "Strawberry Slush", "category": "Slush", "item_type": "drink", "description": "Blended ice with fresh strawberries", "price_cents": 600, "is_available": True},
    {"name": "Oolong Milk Tea", "category": "Milk Tea", "item_type": "drink", "description": "Roasted oolong tea with milk", "price_cents": 500, "is_available": True},
    {"name": "Honeydew Milk Tea", "category": "Milk Tea", "item_type": "drink", "description": "Melon flavored milk tea", "price_cents": 550, "is_available": True},
    {"name": "Tapioca Pearls (Boba)", "category": "Topping", "item_type": "topping", "description": "Chewy cassava root balls", "price_cents": 75, "is_available": True},
    {"name": "Lychee Jelly", "category": "Topping", "item_type": "topping", "description": "Sweet lychee flavored cubes", "price_cents": 75, "is_available": True},
    {"name": "Aloe Vera", "category": "Topping", "item_type": "topping", "description": "Marinated aloe chunks", "price_cents": 75, "is_available": True},
    {"name": "Cheese Foam", "category": "Topping", "item_type": "topping", "description": "Savory and sweet cream topping", "price_cents": 100, "is_available": True},
    {"name": "Egg Pudding", "category": "Topping", "item_type": "topping", "description": "Soft sweet custard", "price_cents": 100, "is_available": True},
    {"name": "Red Bean", "category": "Topping", "item_type": "topping", "description": "Sweetened azuki beans", "price_cents": 75, "is_available": True}
]

INVENTORY_ITEMS = [
    "Black Tea Leaves", "Green Tea Leaves", "Oolong Tea Leaves", "Matcha Powder", 
    "Taro Powder", "Non-Dairy Creamer", "Whole Milk", "Brown Sugar Syrup", 
    "Mango Puree", "Passionfruit Syrup", "Wintermelon Syrup", "Strawberry Puree",
    "Raw Tapioca Pearls", "Raw Lychee Jelly", "Raw Aloe Vera", "Cream Cheese Block",
    "Pudding Mix", "Canned Red Bean", "Ice", "Filtered Water",
    "Plastic Cup (Regular)", "Plastic Cup (Large)", "Sealing Film", "Boba Straws", 
    "Napkins", "Drink Carrier (2-cup)", "Plastic Bags"
]

for i, item in enumerate(MENU_ITEMS, start=1):
    item["menu_item_id"] = i

END_DATE = datetime(2026, 9, 25)
START_DATE = END_DATE - timedelta(weeks=39)
TOTAL_DAYS = (END_DATE - START_DATE).days
TARGET_TOTAL_CENTS = 75000000
DAILY_AVERAGE_CENTS = TARGET_TOTAL_CENTS / TOTAL_DAYS

PEAK_DAYS = [
    datetime(2026, 3, 29).date(),
    datetime(2026, 8, 30).date()
]


def make_order_item(order_item_id, order_id, menu_item, parent_order_item_id=""):
    # parent_order_item_id is empty (NULL in \copy csv) for drinks, the drink's id for toppings
    return {
        "order_item_id": order_item_id,
        "order_id": order_id,
        "menu_item_id": menu_item["menu_item_id"],
        "parent_order_item_id": parent_order_item_id,
        "item_name_snapshot": menu_item["name"],
        "quantity": 1,
        "unit_price_cents": menu_item["price_cents"]
    }


def generate_data():
    sales_history = []
    order_items = []
    order_id_counter = 1
    order_item_id_counter = 1
    current_date = START_DATE

    drinks = [m for m in MENU_ITEMS if m["item_type"] == "drink"]
    toppings = [m for m in MENU_ITEMS if m["item_type"] == "topping"]

    while current_date <= END_DATE:
        if current_date.date() in PEAK_DAYS:
            daily_target = DAILY_AVERAGE_CENTS * 3.5
        else:
            daily_target = DAILY_AVERAGE_CENTS * random.uniform(0.8, 1.2)

        daily_cents_accumulated = 0

        while daily_cents_accumulated < daily_target:
            order_cents = 0
            num_drinks = random.choices([1, 2, 3, 4], weights=[60, 25, 10, 5])[0]
            
            for _ in range(num_drinks):
                drink = random.choice(drinks)
                order_cents += drink["price_cents"]

                drink_item_id = order_item_id_counter
                order_items.append(make_order_item(drink_item_id, order_id_counter, drink))
                order_item_id_counter += 1

                if random.random() < 0.6:
                    num_toppings = random.choices([1, 2], weights=[80, 20])[0]
                    for _ in range(num_toppings):
                        topping = random.choice(toppings)
                        order_cents += topping["price_cents"]
                        order_items.append(make_order_item(order_item_id_counter, order_id_counter, topping, drink_item_id))
                        order_item_id_counter += 1

            hour = random.randint(10, 20)
            minute = random.randint(0, 59)
            second = random.randint(0, 59)
            order_time = current_date.replace(hour=hour, minute=minute, second=second)
            emp_id = random.randint(1, 5)

            sales_history.append({
                "order_id": order_id_counter,
                "employee_id": emp_id,
                "status": "closed",
                "created_at": order_time.strftime("%Y-%m-%d %H:%M:%S"),
                "total_cents": order_cents
            })

            daily_cents_accumulated += order_cents
            order_id_counter += 1

        current_date += timedelta(days=1)

    return sales_history, order_items


def export_csvs(sales_data, order_items_data):
    with open('menu_items.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["menu_item_id", "name", "category", "item_type", "description", "price_cents", "is_available"])
        writer.writeheader()
        writer.writerows(MENU_ITEMS)
    
    with open('sales_history.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["order_id", "employee_id", "status", "created_at", "total_cents"])
        writer.writeheader()
        writer.writerows(sales_data)

    with open('order_items.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["order_item_id", "order_id", "menu_item_id", "parent_order_item_id", "item_name_snapshot", "quantity", "unit_price_cents"])
        writer.writeheader()
        writer.writerows(order_items_data)


INVENTORY_STOCK = {
    # name: (unit, quantity_on_hand, reorder_level)
    # on hand ~= one week of supply, reorder ~= 2-3 days (~400 drinks/day)
    # Matcha Powder and Drink Carrier are intentionally below reorder level
    "Black Tea Leaves":       ("g",     8000,  3000),
    "Green Tea Leaves":       ("g",     5000,  2000),
    "Oolong Tea Leaves":      ("g",     2000,   750),
    "Matcha Powder":          ("g",      450,   500),
    "Taro Powder":            ("g",     9000,  3000),
    "Non-Dairy Creamer":      ("g",    35000, 12000),
    "Whole Milk":             ("ml",  200000, 60000),
    "Brown Sugar Syrup":      ("ml",   15000,  5000),
    "Mango Puree":            ("ml",    9000,  3000),
    "Passionfruit Syrup":     ("ml",    9000,  3000),
    "Wintermelon Syrup":      ("ml",    9000,  3000),
    "Strawberry Puree":       ("ml",   16000,  5000),
    "Raw Tapioca Pearls":     ("g",    40000, 15000),
    "Raw Lychee Jelly":       ("g",    20000,  7000),
    "Raw Aloe Vera":          ("g",    20000,  7000),
    "Cream Cheese Block":     ("g",     8000,  3000),
    "Pudding Mix":            ("g",    16000,  5000),
    "Canned Red Bean":        ("g",    16000,  5000),
    "Ice":                    ("g",   100000, 40000),
    "Filtered Water":         ("ml",  150000, 50000),
    "Plastic Cup (Regular)":  ("each",  4000,  1500),
    "Plastic Cup (Large)":    ("each",  1000,   300),
    "Sealing Film":           ("each",  4000,  1500),
    "Boba Straws":            ("each",  5000,  1500),
    "Napkins":                ("each",  5000,  1500),
    "Drink Carrier (2-cup)":  ("each",   350,   400),
    "Plastic Bags":           ("each",  1000,   300),
}

PACKAGING = [("Plastic Cup (Regular)", 1), ("Sealing Film", 1), ("Boba Straws", 1)]

RECIPES = {
    # drinks: base + flavor + ice/water + packaging (amounts per serving)
    "Classic Milk Tea":       [("Black Tea Leaves", 5), ("Non-Dairy Creamer", 25), ("Ice", 150), ("Filtered Water", 250)] + PACKAGING,
    "Taro Milk Tea":          [("Black Tea Leaves", 5), ("Taro Powder", 30), ("Non-Dairy Creamer", 25), ("Ice", 150), ("Filtered Water", 250)] + PACKAGING,
    "Matcha Milk Tea":        [("Matcha Powder", 4), ("Whole Milk", 200), ("Ice", 150), ("Filtered Water", 60)] + PACKAGING,
    "Thai Tea":               [("Black Tea Leaves", 6), ("Non-Dairy Creamer", 20), ("Whole Milk", 60), ("Ice", 150), ("Filtered Water", 250)] + PACKAGING,
    "Brown Sugar Boba Milk":  [("Brown Sugar Syrup", 30), ("Whole Milk", 250), ("Raw Tapioca Pearls", 60), ("Ice", 120)] + PACKAGING,
    "Jasmine Green Tea":      [("Green Tea Leaves", 5), ("Ice", 150), ("Filtered Water", 300)] + PACKAGING,
    "Mango Green Tea":        [("Green Tea Leaves", 5), ("Mango Puree", 30), ("Ice", 150), ("Filtered Water", 270)] + PACKAGING,
    "Passionfruit Black Tea": [("Black Tea Leaves", 5), ("Passionfruit Syrup", 30), ("Ice", 150), ("Filtered Water", 270)] + PACKAGING,
    "Wintermelon Tea":        [("Black Tea Leaves", 5), ("Wintermelon Syrup", 30), ("Ice", 150), ("Filtered Water", 270)] + PACKAGING,
    "Strawberry Slush":       [("Strawberry Puree", 60), ("Whole Milk", 60), ("Ice", 250),
                               ("Plastic Cup (Large)", 1), ("Sealing Film", 1), ("Boba Straws", 1)],
    "Oolong Milk Tea":        [("Oolong Tea Leaves", 5), ("Non-Dairy Creamer", 25), ("Ice", 150), ("Filtered Water", 250)] + PACKAGING,
    "Honeydew Milk Tea":      [("Green Tea Leaves", 5), ("Non-Dairy Creamer", 20), ("Whole Milk", 60), ("Ice", 150), ("Filtered Water", 200)] + PACKAGING,

    # toppings: the raw ingredient (+ sweetener where it makes sense)
    "Tapioca Pearls (Boba)":  [("Raw Tapioca Pearls", 60), ("Brown Sugar Syrup", 15)],
    "Lychee Jelly":           [("Raw Lychee Jelly", 50)],
    "Aloe Vera":              [("Raw Aloe Vera", 50)],
    "Cheese Foam":            [("Cream Cheese Block", 20), ("Whole Milk", 30)],
    "Egg Pudding":            [("Pudding Mix", 40), ("Whole Milk", 60)],
    "Red Bean":               [("Canned Red Bean", 40)],
}


def export_inventory_and_recipes():
    inv_id = {name: i for i, name in enumerate(INVENTORY_ITEMS, start=1)}
    menu_id = {m["name"]: m["menu_item_id"] for m in MENU_ITEMS}
    updated_at = END_DATE.strftime("%Y-%m-%d %H:%M:%S")

    with open('inventory.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["inventory_id", "ingredient_name", "unit", "quantity_on_hand", "reorder_level", "updated_at"])
        writer.writeheader()
        for name in INVENTORY_ITEMS:
            unit, on_hand, reorder = INVENTORY_STOCK[name]
            writer.writerow({
                "inventory_id": inv_id[name],
                "ingredient_name": name,
                "unit": unit,
                "quantity_on_hand": on_hand,
                "reorder_level": reorder,
                "updated_at": updated_at
            })

    with open('recipes.csv', 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=["menu_item_id", "inventory_id", "quantity_required"])
        writer.writeheader()
        for item_name, ingredients in RECIPES.items():
            for ingredient, amount in ingredients:
                writer.writerow({
                    "menu_item_id": menu_id[item_name],
                    "inventory_id": inv_id[ingredient],
                    "quantity_required": amount
                })


if __name__ == "__main__":
    sales_history_data, order_items_data = generate_data()
    export_csvs(sales_history_data, order_items_data)
    export_inventory_and_recipes()

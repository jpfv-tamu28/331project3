import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.math.BigDecimal;
import java.sql.*;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.IntPredicate;

/**
 * Manager dashboard panel for handling menu items, inventory, and employees.
 * 
 * @author Generated
 */
public class Manager extends JPanel {

    private static final String[] ROLES = {"Cashier", "Manager"};
    private static final String[] UNITS = {"g", "ml", "each"};
    private static final Color ACCENT = new Color(0x8B5E3C);

    private final Connection dbConnection;

    private final DefaultTableModel menuModel = readOnlyModel(
            "ID", "Name", "Category", "Type", "Price", "Available");
    private final DefaultTableModel inventoryModel = readOnlyModel(
            "ID", "Ingredient", "Unit", "On Hand", "Reorder Level", "Last Updated");
    private final DefaultTableModel employeeModel = readOnlyModel(
            "ID", "Name", "Role", "Active");

    /**
     * Constructs a new Manager panel.
     * 
     * @param dbConnection the database connection
     */
    public Manager(Connection dbConnection) {
        this.dbConnection = dbConnection;
        setLayout(new BorderLayout());

        initUI();
        refreshAll();
    }

    /**
     * Initializes the user interface components.
     */
    private void initUI() {
        setBackground(DenseList.SURFACE);

        JLabel title = new JLabel("Manager Dashboard");
        title.setFont(DenseList.font(Font.BOLD, 20));
        title.setForeground(DenseList.TEXT);
        JButton btnRefresh = secondaryButton("Refresh");
        btnRefresh.addActionListener(e -> refreshAll());

        JPanel header = new JPanel(new BorderLayout());
        header.setOpaque(false);
        header.setBorder(new EmptyBorder(16, 20, 4, 20));
        header.add(title, BorderLayout.WEST);
        header.add(btnRefresh, BorderLayout.EAST);

        JButton btnAddItem = primaryButton("Add Item");
        btnAddItem.addActionListener(e -> showMenuItemDialog(-1));
        JButton btnSeasonal = secondaryButton("New Seasonal Item");
        btnSeasonal.addActionListener(e -> {
            if (SeasonalItemDialog.show(this, dbConnection)) {
                loadMenuItems();
            }
        });
        JButton btnAddIngredient = primaryButton("Add Ingredient");
        btnAddIngredient.addActionListener(e -> showInventoryDialog(-1));
        JButton btnAddEmployee = primaryButton("Add Employee");
        btnAddEmployee.addActionListener(e -> showEmployeeDialog(-1));

        Map<String, JComponent> pages = new LinkedHashMap<>();
        pages.put("Menu Items", menuList(btnAddItem, btnSeasonal));
        pages.put("Inventory", inventoryList(btnAddIngredient));
        pages.put("Employees", employeeList(btnAddEmployee));
        pages.put("Reports", new Reports(dbConnection));
        pages.put("X-Report", new XReport(dbConnection));
        pages.put("Product Usage", new ProductUsage(dbConnection));

        CardLayout cards = new CardLayout();
        JPanel content = new JPanel(cards);
        pages.forEach((name, page) -> content.add(page, name));

        JPanel tabBar = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        tabBar.setOpaque(false);
        tabBar.setBorder(new EmptyBorder(0, 20, 0, 20));
        List<JButton> tabs = new java.util.ArrayList<>();
        for (String name : pages.keySet()) {
            JButton tab = new JButton(name);
            tab.setContentAreaFilled(false);
            tab.setFocusPainted(false);
            tab.setRolloverEnabled(true);
            tab.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            tab.addActionListener(e -> {
                cards.show(content, name);
                styleTabs(tabs, tab);
            });
            tab.getModel().addChangeListener(e -> {
                if (!Boolean.TRUE.equals(tab.getClientProperty("selected"))) {
                    tab.setForeground(tab.getModel().isRollover() ? DenseList.TEXT : DenseList.MUTED);
                }
            });
            tabs.add(tab);
            tabBar.add(tab);
        }
        styleTabs(tabs, tabs.get(0));

        JPanel top = new JPanel(new BorderLayout());
        top.setBackground(DenseList.SURFACE);
        top.setBorder(BorderFactory.createMatteBorder(0, 0, 1, 0, DenseList.LINE));
        top.add(header, BorderLayout.NORTH);
        top.add(tabBar, BorderLayout.SOUTH);

        add(top, BorderLayout.NORTH);
        add(content, BorderLayout.CENTER);
    }

    /**
     * Styles the tabs in the tab bar.
     * 
     * @param tabs the list of tab buttons
     * @param selected the currently selected tab button
     */
    private static void styleTabs(List<JButton> tabs, JButton selected) {
        for (JButton tab : tabs) {
            boolean on = tab == selected;
            tab.putClientProperty("selected", on);
            tab.setFont(DenseList.font(on ? Font.BOLD : Font.PLAIN, 13));
            tab.setForeground(on ? DenseList.TEXT : DenseList.MUTED);
            tab.setBorder(BorderFactory.createCompoundBorder(
                    new EmptyBorder(0, 0, 0, 24),
                    BorderFactory.createCompoundBorder(
                            BorderFactory.createMatteBorder(0, 0, 2, 0, on ? ACCENT : DenseList.SURFACE),
                            new EmptyBorder(10, 0, 10, 0))));
        }
    }

    /**
     * Creates a primary styled button.
     * 
     * @param text the button text
     * @return the created primary button
     */
    static JButton primaryButton(String text) {
        Cashier.FlatButton btn = new Cashier.FlatButton(text, DenseList.TEXT, new Color(0x3A3632), Color.BLACK, 8);
        btn.setFont(DenseList.font(Font.BOLD, 13));
        btn.setForeground(Color.WHITE);
        btn.setBorder(new EmptyBorder(8, 14, 8, 14));
        return btn;
    }

    /**
     * Creates a secondary styled button.
     * 
     * @param text the button text
     * @return the created secondary button
     */
    static JButton secondaryButton(String text) {
        Cashier.FlatButton btn = new Cashier.FlatButton(text, DenseList.CHIP, DenseList.LINE, new Color(0xCFC9C1), 8);
        btn.setFont(DenseList.font(Font.BOLD, 13));
        btn.setForeground(DenseList.TEXT);
        btn.setBorder(new EmptyBorder(8, 14, 8, 14));
        return btn;
    }

    /**
     * Creates the menu items list component.
     * 
     * @param actions the action buttons for the list
     * @return the DenseList component for menu items
     */
    private DenseList menuList(JButton... actions) {
        Map<String, IntPredicate> filters = new LinkedHashMap<>();
        filters.put("All", r -> true);
        filters.put("Drinks", r -> !"topping".equalsIgnoreCase((String) menuModel.getValueAt(r, 3)));
        filters.put("Toppings", r -> "topping".equalsIgnoreCase((String) menuModel.getValueAt(r, 3)));
        filters.put("Unavailable", r -> "No".equals(menuModel.getValueAt(r, 5)));
        return new DenseList(menuModel, "Search menu", filters, List.of(),
                r -> (String) menuModel.getValueAt(r, 2),
                r -> new DenseList.Row(
                        (String) menuModel.getValueAt(r, 1),
                        capitalize((String) menuModel.getValueAt(r, 3)) + " \u00b7 #" + menuModel.getValueAt(r, 0),
                        (String) menuModel.getValueAt(r, 4),
                        null,
                        "No".equals(menuModel.getValueAt(r, 5)) ? DenseList.Badge.muted("Unavailable") : null),
                this::showMenuItemDialog, "item", actions);
    }

    /**
     * Creates the inventory list component.
     * 
     * @param actions the action buttons for the list
     * @return the DenseList component for inventory
     */
    private DenseList inventoryList(JButton... actions) {
        String low = "Below reorder level";
        IntPredicate isLow = r -> ((BigDecimal) inventoryModel.getValueAt(r, 3))
                .compareTo((BigDecimal) inventoryModel.getValueAt(r, 4)) <= 0;
        Map<String, IntPredicate> filters = new LinkedHashMap<>();
        filters.put("All", r -> true);
        filters.put("Low stock", isLow);
        return new DenseList(inventoryModel, "Search ingredients", filters, List.of(low),
                r -> isLow.test(r) ? low : "In stock",
                r -> {
                    String unit = (String) inventoryModel.getValueAt(r, 2);
                    return new DenseList.Row(
                            (String) inventoryModel.getValueAt(r, 1),
                            "Updated " + inventoryModel.getValueAt(r, 5) + " \u00b7 #" + inventoryModel.getValueAt(r, 0),
                            plain((BigDecimal) inventoryModel.getValueAt(r, 3)) + " " + unit,
                            "reorder at " + plain((BigDecimal) inventoryModel.getValueAt(r, 4)),
                            isLow.test(r) ? DenseList.Badge.alert("Low stock") : null);
                },
                this::showInventoryDialog, "ingredient", actions);
    }

    /**
     * Creates the employee list component.
     * 
     * @param actions the action buttons for the list
     * @return the DenseList component for employees
     */
    private DenseList employeeList(JButton... actions) {
        Map<String, IntPredicate> filters = new LinkedHashMap<>();
        filters.put("All", r -> true);
        filters.put("Active", r -> "Yes".equals(employeeModel.getValueAt(r, 3)));
        filters.put("Inactive", r -> "No".equals(employeeModel.getValueAt(r, 3)));
        return new DenseList(employeeModel, "Search employees", filters, List.of("Managers", "Cashiers"),
                r -> employeeModel.getValueAt(r, 2) + "s",
                r -> new DenseList.Row(
                        (String) employeeModel.getValueAt(r, 1),
                        "Employee #" + employeeModel.getValueAt(r, 0),
                        (String) employeeModel.getValueAt(r, 2),
                        null,
                        "No".equals(employeeModel.getValueAt(r, 3)) ? DenseList.Badge.muted("Inactive") : null),
                this::showEmployeeDialog, "employee", actions);
    }

    /**
     * Capitalizes the first letter of a string.
     * 
     * @param s the string to capitalize
     * @return the capitalized string
     */
    private static String capitalize(String s) {
        return s == null || s.isEmpty() ? "" : Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    /**
     * Converts a BigDecimal to a plain string with trailing zeros stripped.
     * 
     * @param value the BigDecimal value
     * @return the plain string representation
     */
    private static String plain(BigDecimal value) {
        return value.stripTrailingZeros().toPlainString();
    }

    /**
     * Shows the dialog for adding or editing an inventory ingredient.
     * 
     * @param modelRow the model row index, or -1 when adding a new ingredient
     * @throws SQLException if a database access error occurs
     */
    private void showInventoryDialog(int modelRow) {
        boolean editing = modelRow >= 0;
        JTextField name = new JTextField(editing ? (String) inventoryModel.getValueAt(modelRow, 1) : "", 20);
        JComboBox<String> unit = new JComboBox<>(UNITS);
        if (editing) {
            unit.setSelectedItem(inventoryModel.getValueAt(modelRow, 2));
        }
        JTextField onHand = new JTextField(editing ? inventoryModel.getValueAt(modelRow, 3).toString() : "");
        JTextField reorder = new JTextField(editing ? inventoryModel.getValueAt(modelRow, 4).toString() : "");

        JPanel form = new JPanel(new GridLayout(0, 2, 5, 5));
        form.add(new JLabel("Ingredient:"));
        form.add(name);
        form.add(new JLabel("Unit:"));
        form.add(unit);
        form.add(new JLabel("On Hand:"));
        form.add(onHand);
        form.add(new JLabel("Reorder Level:"));
        form.add(reorder);

        if (!Alerts.form(this, editing ? "Edit Ingredient" : "Add Ingredient", form, "Save")) {
            return;
        }

        if (name.getText().isBlank()) {
            Alerts.warning(this, "Missing ingredient", "Ingredient is required.");
            return;
        }
        BigDecimal onHandQty = parseQuantity(onHand.getText());
        BigDecimal reorderQty = parseQuantity(reorder.getText());
        if (onHandQty == null || reorderQty == null) {
            Alerts.warning(this, "Check the amounts", "On hand and reorder level must be non-negative numbers.");
            return;
        }

        String sql = editing
                ? "UPDATE inventory SET ingredient_name = ?, unit = ?, quantity_on_hand = ?, reorder_level = ?, updated_at = NOW() WHERE inventory_id = ?"
                : "INSERT INTO inventory (ingredient_name, unit, quantity_on_hand, reorder_level) VALUES (?, ?, ?, ?)";
        try (PreparedStatement pstmt = dbConnection.prepareStatement(sql)) {
            pstmt.setString(1, name.getText().trim());
            pstmt.setString(2, (String) unit.getSelectedItem());
            pstmt.setBigDecimal(3, onHandQty);
            pstmt.setBigDecimal(4, reorderQty);
            if (editing) {
                pstmt.setInt(5, (Integer) inventoryModel.getValueAt(modelRow, 0));
            }
            pstmt.executeUpdate();
        } catch (SQLException e) {
            showError("saving ingredient", e);
        }
        loadInventory();
    }

    /**
     * Shows the dialog for adding or editing an employee.
     * 
     * @param modelRow the model row index, or -1 when adding a new employee
     * @throws SQLException if a database access error occurs
     */
    private void showEmployeeDialog(int modelRow) {
        boolean editing = modelRow >= 0;
        JTextField name = new JTextField(editing ? (String) employeeModel.getValueAt(modelRow, 1) : "", 20);
        JComboBox<String> role = new JComboBox<>(ROLES);
        if (editing) {
            role.setSelectedItem(employeeModel.getValueAt(modelRow, 2));
        }
        JTextField pin = new JTextField();
        JCheckBox active = new JCheckBox("Active", !editing || "Yes".equals(employeeModel.getValueAt(modelRow, 3)));

        JPanel form = new JPanel(new GridLayout(0, 2, 5, 5));
        form.add(new JLabel("Name:"));
        form.add(name);
        form.add(new JLabel("Role:"));
        form.add(role);
        form.add(new JLabel(editing ? "New PIN (blank = keep):" : "PIN:"));
        form.add(pin);
        form.add(new JLabel());
        form.add(active);

        if (!Alerts.form(this, editing ? "Edit Employee" : "Add Employee", form, "Save")) {
            return;
        }

        String pinText = pin.getText().trim();
        if (name.getText().isBlank()) {
            Alerts.warning(this, "Missing name", "Name is required.");
            return;
        }
        if (!(editing && pinText.isEmpty()) && !pinText.matches("\\d{" + Login.PIN_LENGTH + "}")) {
            Alerts.warning(this, "Invalid PIN", "PIN must be " + Login.PIN_LENGTH + " digits.");
            return;
        }

        // employee_id is not SERIAL, so new IDs are assigned as MAX + 1.
        String sql = editing
                ? "UPDATE employees SET name = ?, role = ?, is_active = ?, pin = COALESCE(?, pin) WHERE employee_id = ?"
                : "INSERT INTO employees (name, role, is_active, pin, employee_id) "
                + "VALUES (?, ?, ?, ?, (SELECT COALESCE(MAX(employee_id), 0) + 1 FROM employees))";
        try (PreparedStatement pstmt = dbConnection.prepareStatement(sql)) {
            pstmt.setString(1, name.getText().trim());
            pstmt.setString(2, (String) role.getSelectedItem());
            pstmt.setBoolean(3, active.isSelected());
            pstmt.setString(4, pinText.isEmpty() ? null : pinText);
            if (editing) {
                pstmt.setInt(5, (Integer) employeeModel.getValueAt(modelRow, 0));
            }
            pstmt.executeUpdate();
        } catch (SQLException e) {
            showError("saving employee", e);
        }
        loadEmployees();
    }

    /**
     * Parses a quantity from text.
     * 
     * @param text the text to parse
     * @return the parsed BigDecimal quantity, or null if invalid
     */
    private static BigDecimal parseQuantity(String text) {
        try {
            BigDecimal value = new BigDecimal(text.trim());
            return value.signum() >= 0 ? value : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /**
     * Shows the dialog for adding or editing a menu item.
     * 
     * @param modelRow the model row index, or -1 when adding a new item
     * @throws SQLException if a database access error occurs
     */
    private void showMenuItemDialog(int modelRow) {
        boolean editing = modelRow >= 0;
        JTextField name = new JTextField(editing ? (String) menuModel.getValueAt(modelRow, 1) : "", 20);
        // Only categories already on the menu can be chosen.
        Set<String> categories = new TreeSet<>();
        for (int row = 0; row < menuModel.getRowCount(); row++) {
            categories.add((String) menuModel.getValueAt(row, 2));
        }
        JComboBox<String> category = new JComboBox<>(categories.toArray(new String[0]));
        JComboBox<String> type = new JComboBox<>(SeasonalItemDialog.ITEM_TYPES);
        if (editing) {
            category.setSelectedItem(menuModel.getValueAt(modelRow, 2));
            type.setSelectedItem(menuModel.getValueAt(modelRow, 3));
        }
        JTextField price = new JTextField(editing ? ((String) menuModel.getValueAt(modelRow, 4)).substring(1) : "");
        JCheckBox available = new JCheckBox("Available", !editing || "Yes".equals(menuModel.getValueAt(modelRow, 5)));

        JPanel form = new JPanel(new GridLayout(0, 2, 5, 5));
        form.add(new JLabel("Name:"));
        form.add(name);
        form.add(new JLabel("Category:"));
        form.add(category);
        form.add(new JLabel("Type:"));
        form.add(type);
        form.add(new JLabel("Price ($):"));
        form.add(price);
        form.add(new JLabel());
        form.add(available);

        if (!Alerts.form(this, editing ? "Edit Menu Item" : "Add Menu Item", form, "Save")) {
            return;
        }

        if (name.getText().isBlank() || category.getSelectedItem() == null) {
            Alerts.warning(this, "Missing details", "Name and category are required.");
            return;
        }
        int priceCents;
        try {
            priceCents = new BigDecimal(price.getText().trim()).movePointRight(2).intValueExact();
        } catch (NumberFormatException | ArithmeticException ex) {
            priceCents = -1;
        }
        if (priceCents < 0) {
            Alerts.warning(this, "Check the price", "Enter a valid price, e.g. 5.25");
            return;
        }

        // menu_item_id is not SERIAL, so new IDs are assigned as MAX + 1.
        String sql = editing
                ? "UPDATE menu_items SET name = ?, category = ?, item_type = ?, price_cents = ?, is_available = ? WHERE menu_item_id = ?"
                : "INSERT INTO menu_items (name, category, item_type, price_cents, is_available, menu_item_id) "
                + "VALUES (?, ?, ?, ?, ?, (SELECT COALESCE(MAX(menu_item_id), 0) + 1 FROM menu_items))";
        try (PreparedStatement pstmt = dbConnection.prepareStatement(sql)) {
            pstmt.setString(1, name.getText().trim());
            pstmt.setString(2, (String) category.getSelectedItem());
            pstmt.setString(3, (String) type.getSelectedItem());
            pstmt.setInt(4, priceCents);
            pstmt.setBoolean(5, available.isSelected());
            if (editing) {
                pstmt.setInt(6, (Integer) menuModel.getValueAt(modelRow, 0));
            }
            pstmt.executeUpdate();
        } catch (SQLException e) {
            showError("saving menu item", e);
        }
        loadMenuItems();
    }

    /**
     * Refreshes all data models and views.
     */
    public void refreshAll() {
        loadMenuItems();
        loadInventory();
        loadEmployees();
    }

    /**
     * Loads menu items from the database into the model.
     * 
     * @throws SQLException if a database access error occurs
     */
    private void loadMenuItems() {
        menuModel.setRowCount(0);
        String sql = "SELECT menu_item_id, name, category, item_type, price_cents, is_available FROM menu_items ORDER BY menu_item_id";
        try (Statement stmt = dbConnection.createStatement(); ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                menuModel.addRow(new Object[]{
                        rs.getInt("menu_item_id"),
                        rs.getString("name"),
                        rs.getString("category"),
                        rs.getString("item_type"),
                        String.format("$%.2f", rs.getInt("price_cents") / 100.0),
                        rs.getBoolean("is_available") ? "Yes" : "No"
                });
            }
        } catch (SQLException e) {
            showError("loading menu items", e);
        }
    }

    /**
     * Loads inventory items from the database into the model.
     * 
     * @throws SQLException if a database access error occurs
     */
    private void loadInventory() {
        inventoryModel.setRowCount(0);
        String sql = "SELECT inventory_id, ingredient_name, unit, quantity_on_hand, reorder_level, updated_at FROM inventory ORDER BY inventory_id";
        try (Statement stmt = dbConnection.createStatement(); ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                inventoryModel.addRow(new Object[]{
                        rs.getInt("inventory_id"),
                        rs.getString("ingredient_name"),
                        rs.getString("unit"),
                        rs.getBigDecimal("quantity_on_hand"),
                        rs.getBigDecimal("reorder_level"),
                        rs.getTimestamp("updated_at").toLocalDateTime().withNano(0).toString().replace('T', ' ')
                });
            }
        } catch (SQLException e) {
            showError("loading inventory", e);
        }
    }

    /**
     * Loads employees from the database into the model.
     * 
     * @throws SQLException if a database access error occurs
     */
    private void loadEmployees() {
        employeeModel.setRowCount(0);
        String sql = "SELECT employee_id, name, role, is_active FROM employees ORDER BY employee_id";
        try (Statement stmt = dbConnection.createStatement(); ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                employeeModel.addRow(new Object[]{
                        rs.getInt("employee_id"),
                        rs.getString("name"),
                        rs.getString("role"),
                        rs.getBoolean("is_active") ? "Yes" : "No"
                });
            }
        } catch (SQLException e) {
            showError("loading employees", e);
        }
    }

    /**
     * Shows an error message for a failed database action.
     * 
     * @param action the description of the action that failed
     * @param e the SQL exception that occurred
     */
    private void showError(String action, SQLException e) {
        System.err.println("Error " + action + ": " + e.getMessage());
        Alerts.error(this, "Error " + action, e.getMessage());
    }

    /**
     * Creates a read-only table model with the specified columns.
     * 
     * @param columns the column names
     * @return the read-only DefaultTableModel
     */
    static DefaultTableModel readOnlyModel(String... columns) {
        return new DefaultTableModel(columns, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };
    }
}
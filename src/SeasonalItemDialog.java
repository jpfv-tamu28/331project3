import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.math.BigDecimal;
import java.sql.*;

// Adds a seasonal menu item together with its recipe, so inventory usage is tracked for it from the first sale.
public class SeasonalItemDialog {

    static final String[] ITEM_TYPES = {"drink", "topping"};
    private static final String CATEGORY = "Seasonal";

    private record Ingredient(int id, String name, String unit) {
        @Override
        public String toString() {
            return name + " (" + unit + ")";
        }
    }

    private final Component parent;
    private final Connection dbConnection;
    private final DefaultTableModel recipeModel = Manager.readOnlyModel("Ingredient", "Quantity");

    private SeasonalItemDialog(Component parent, Connection dbConnection) {
        this.parent = parent;
        this.dbConnection = dbConnection;
    }

    // Returns true if a new item was saved.
    public static boolean show(Component parent, Connection dbConnection) {
        return new SeasonalItemDialog(parent, dbConnection).run();
    }

    private boolean run() {
        JComboBox<Ingredient> ingredientChoice = new JComboBox<>();
        try {
            loadIngredients(ingredientChoice);
        } catch (SQLException e) {
            showError("loading ingredients", e);
            return false;
        }

        JTextField name = new Cashier.RoundTextField("e.g. Pumpkin Spice Milk Tea");
        name.setFont(DenseList.font(Font.PLAIN, 13));
        name.setPreferredSize(new Dimension(260, 34));
        DenseList.Segmented type = new DenseList.Segmented(ITEM_TYPES, ITEM_TYPES[0]);
        JTextField price = new Cashier.RoundTextField("6.50");
        price.setFont(DenseList.font(Font.PLAIN, 13));
        price.setPreferredSize(new Dimension(120, 34));
        JCheckBox available = new JCheckBox("Available to cashiers", true);
        available.setFont(DenseList.font(Font.PLAIN, 13));
        available.setForeground(DenseList.TEXT);

        JLabel category = new JLabel(CATEGORY);
        category.setFont(DenseList.font(Font.BOLD, 13));
        category.setForeground(DenseList.TEXT);

        JPanel details = new JPanel(new GridBagLayout());
        GridBagConstraints gc = new GridBagConstraints();
        gc.insets = new Insets(4, 0, 4, 12);
        gc.anchor = GridBagConstraints.WEST;
        addDetail(details, gc, 0, "Name", name);
        addDetail(details, gc, 1, "Category", category);
        addDetail(details, gc, 2, "Type", type);
        addDetail(details, gc, 3, "Price ($)", price);
        gc.gridx = 1;
        gc.gridy = 4;
        details.add(available, gc);

        JTable recipeTable = new JTable(recipeModel);
        recipeTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        JScrollPane recipeScroll = DenseList.styledTable(recipeTable, column -> false);
        recipeScroll.setBorder(BorderFactory.createMatteBorder(0, 1, 1, 1, DenseList.LINE));
        recipeScroll.setPreferredSize(new Dimension(460, 150));

        JTextField quantity = new Cashier.RoundTextField("Qty");
        quantity.setFont(DenseList.font(Font.PLAIN, 13));
        quantity.setPreferredSize(new Dimension(80, 34));
        JButton btnAdd = Manager.secondaryButton("Add");
        btnAdd.addActionListener(e -> addIngredient((Ingredient) ingredientChoice.getSelectedItem(), quantity));
        JButton btnRemove = Manager.secondaryButton("Remove Selected");
        btnRemove.addActionListener(e -> {
            int row = recipeTable.getSelectedRow();
            if (row >= 0) {
                recipeModel.removeRow(recipeTable.convertRowIndexToModel(row));
            }
        });

        JPanel picker = new JPanel(new FlowLayout(FlowLayout.LEFT, 6, 0));
        picker.add(ingredientChoice);
        picker.add(quantity);
        picker.add(btnAdd);
        picker.add(btnRemove);

        JPanel recipeTop = new JPanel(new BorderLayout(0, 8));
        recipeTop.add(picker, BorderLayout.NORTH);
        recipeTop.add(DenseList.sectionBar("Ingredients per serving", null), BorderLayout.SOUTH);

        JPanel recipe = new JPanel(new BorderLayout());
        recipe.add(recipeTop, BorderLayout.NORTH);
        recipe.add(recipeScroll, BorderLayout.CENTER);

        JPanel form = new JPanel(new BorderLayout(0, 16));
        form.add(details, BorderLayout.NORTH);
        form.add(recipe, BorderLayout.CENTER);

        // Re-open the dialog on invalid input so the entered ingredients aren't lost.
        while (true) {
            if (!Alerts.form(parent, "New Seasonal Menu Item", form, "Create Item")) {
                return false;
            }

            String error = validate(name, price);
            if (error != null) {
                Alerts.warning(parent, "Check the item", error);
                continue;
            }
            int priceCents = new BigDecimal(price.getText().trim()).movePointRight(2).intValueExact();
            return save(name.getText().trim(), CATEGORY, type.selected(),
                    priceCents, available.isSelected());
        }
    }

    private static void addDetail(JPanel panel, GridBagConstraints gc, int row, String label, JComponent field) {
        gc.gridx = 0;
        gc.gridy = row;
        panel.add(new JLabel(label), gc);
        gc.gridx = 1;
        gc.weightx = 1;
        panel.add(field, gc);
        gc.weightx = 0;
    }

    private void loadIngredients(JComboBox<Ingredient> choice) throws SQLException {
        String sql = "SELECT inventory_id, ingredient_name, unit FROM inventory ORDER BY ingredient_name";
        try (Statement stmt = dbConnection.createStatement(); ResultSet rs = stmt.executeQuery(sql)) {
            while (rs.next()) {
                choice.addItem(new Ingredient(rs.getInt("inventory_id"), rs.getString("ingredient_name"),
                        rs.getString("unit")));
            }
        }
    }

    // Adding an ingredient that is already listed replaces its quantity, since recipes allow one row per ingredient.
    private void addIngredient(Ingredient ingredient, JTextField quantity) {
        if (ingredient == null) {
            return;
        }
        BigDecimal qty;
        try {
            qty = new BigDecimal(quantity.getText().trim());
        } catch (NumberFormatException e) {
            qty = null;
        }
        if (qty == null || qty.signum() <= 0) {
            Alerts.warning(parent, "Check the quantity", "Quantity must be a positive number.");
            return;
        }

        for (int row = 0; row < recipeModel.getRowCount(); row++) {
            if (recipeModel.getValueAt(row, 0) == ingredient) {
                recipeModel.setValueAt(qty, row, 1);
                quantity.setText("");
                return;
            }
        }
        recipeModel.addRow(new Object[]{ingredient, qty});
        quantity.setText("");
    }

    private String validate(JTextField name, JTextField price) {
        if (name.getText().isBlank()) {
            return "Name is required.";
        }
        try {
            if (new BigDecimal(price.getText().trim()).movePointRight(2).intValueExact() < 0) {
                return "Enter a valid price, e.g. 6.50";
            }
        } catch (NumberFormatException | ArithmeticException e) {
            return "Enter a valid price, e.g. 6.50";
        }
        if (recipeModel.getRowCount() == 0) {
            return "Add at least one ingredient.";
        }
        return null;
    }

    // The menu item and its recipe rows are saved in one transaction so a failure leaves no half-created item.
    private boolean save(String name, String category, String type, int priceCents, boolean available) {
        // menu_item_id is not SERIAL, so new IDs are assigned as MAX + 1.
        String itemSql = "INSERT INTO menu_items (menu_item_id, name, category, item_type, price_cents, is_available) "
                + "VALUES ((SELECT COALESCE(MAX(menu_item_id), 0) + 1 FROM menu_items), ?, ?, ?, ?, ?) "
                + "RETURNING menu_item_id";
        String recipeSql = "INSERT INTO recipes (menu_item_id, inventory_id, quantity_required) VALUES (?, ?, ?)";

        try {
            dbConnection.setAutoCommit(false);
            int menuItemId;
            try (PreparedStatement pstmt = dbConnection.prepareStatement(itemSql)) {
                pstmt.setString(1, name);
                pstmt.setString(2, category);
                pstmt.setString(3, type);
                pstmt.setInt(4, priceCents);
                pstmt.setBoolean(5, available);
                try (ResultSet rs = pstmt.executeQuery()) {
                    rs.next();
                    menuItemId = rs.getInt(1);
                }
            }
            try (PreparedStatement pstmt = dbConnection.prepareStatement(recipeSql)) {
                for (int row = 0; row < recipeModel.getRowCount(); row++) {
                    pstmt.setInt(1, menuItemId);
                    pstmt.setInt(2, ((Ingredient) recipeModel.getValueAt(row, 0)).id());
                    pstmt.setBigDecimal(3, (BigDecimal) recipeModel.getValueAt(row, 1));
                    pstmt.addBatch();
                }
                pstmt.executeBatch();
            }
            dbConnection.commit();
            return true;
        } catch (SQLException e) {
            try {
                dbConnection.rollback();
            } catch (SQLException rollbackError) {
                System.err.println("Rollback failed: " + rollbackError.getMessage());
            }
            showError("saving seasonal item", e);
            return false;
        } finally {
            try {
                dbConnection.setAutoCommit(true);
            } catch (SQLException e) {
                System.err.println("Could not restore auto-commit: " + e.getMessage());
            }
        }
    }

    private void showError(String action, SQLException e) {
        System.err.println("Error " + action + ": " + e.getMessage());
        Alerts.error(parent, "Error " + action, e.getMessage());
    }
}

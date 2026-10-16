import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.sql.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

public class Reports extends JPanel {


    // Each query takes two parameters: the start of the range and the exclusive end.
    private static final Map<String, String> REPORTS = new LinkedHashMap<>();
    static {
        REPORTS.put("Daily Sales",
                "SELECT DATE(created_at) AS day, COUNT(*) AS orders, "
                + "ROUND(SUM(total_cents) / 100.0, 2) AS revenue_dollars, "
                + "ROUND(AVG(total_cents) / 100.0, 2) AS avg_order_dollars "
                + "FROM orders WHERE created_at >= ? AND created_at < ? "
                + "GROUP BY day ORDER BY day");
        REPORTS.put("Top Selling Items",
                "SELECT mi.name AS item, mi.category, SUM(oi.quantity) AS quantity_sold, "
                + "ROUND(SUM(oi.quantity * oi.unit_price_cents) / 100.0, 2) AS revenue_dollars "
                + "FROM order_items oi "
                + "JOIN orders o ON o.order_id = oi.order_id "
                + "JOIN menu_items mi ON mi.menu_item_id = oi.menu_item_id "
                + "WHERE o.created_at >= ? AND o.created_at < ? "
                + "GROUP BY mi.name, mi.category ORDER BY quantity_sold DESC");
        REPORTS.put("Sales by Hour",
                "SELECT EXTRACT(HOUR FROM created_at)::int AS hour, COUNT(*) AS orders, "
                + "ROUND(SUM(total_cents) / 100.0, 2) AS revenue_dollars "
                + "FROM orders WHERE created_at >= ? AND created_at < ? "
                + "GROUP BY hour ORDER BY hour");
        REPORTS.put("Category Sales",
                "SELECT mi.category, SUM(oi.quantity) AS items_sold, "
                + "ROUND(SUM(oi.quantity * oi.unit_price_cents) / 100.0, 2) AS revenue_dollars "
                + "FROM order_items oi "
                + "JOIN orders o ON o.order_id = oi.order_id "
                + "JOIN menu_items mi ON mi.menu_item_id = oi.menu_item_id "
                + "WHERE o.created_at >= ? AND o.created_at < ? "
                + "GROUP BY mi.category ORDER BY revenue_dollars DESC");
        REPORTS.put("Employee Performance",
                "SELECT e.name, e.role, COUNT(o.order_id) AS orders, "
                + "ROUND(SUM(o.total_cents) / 100.0, 2) AS revenue_dollars "
                + "FROM employees e JOIN orders o ON o.employee_id = e.employee_id "
                + "WHERE o.created_at >= ? AND o.created_at < ? "
                + "GROUP BY e.employee_id, e.name, e.role ORDER BY orders DESC");
    }

    private final Connection dbConnection;
    private final DefaultTableModel resultModel = Manager.readOnlyModel();
    private final Set<Integer> moneyColumns = new HashSet<>();
    private final DenseList.ChipBar reportChoice;
    private final DatePicker fromField = new DatePicker(LocalDate.now().minusDays(DatePicker.DEFAULT_RANGE_DAYS), null);
    private final DatePicker toField = new DatePicker(LocalDate.now(), null);
    private final CardLayout cards = new CardLayout();
    private final JPanel body = new JPanel(cards);

    public Reports(Connection dbConnection) {
        this.dbConnection = dbConnection;
        setLayout(new BorderLayout());
        setBackground(DenseList.SURFACE);

        reportChoice = new DenseList.ChipBar(new ArrayList<>(REPORTS.keySet()), name -> runReport());
        JButton btnRun = Manager.primaryButton("Run Report");
        btnRun.addActionListener(e -> runReport());

        JTable table = new JTable(resultModel);
        table.setAutoCreateRowSorter(true);

        JLabel hint = new JLabel("Pick a report and date range, then press Run Report.", SwingConstants.CENTER);
        hint.setFont(DenseList.font(Font.PLAIN, 13));
        hint.setForeground(DenseList.MUTED);
        body.setBackground(DenseList.SURFACE);
        body.add(hint, "hint");
        body.add(DenseList.styledTable(table, moneyColumns::contains), "table");

        JPanel top = new JPanel(new BorderLayout());
        top.add(DenseList.toolbar(new JComponent[]{reportChoice}), BorderLayout.NORTH);
        top.add(DatePicker.rangeToolbar(fromField, toField, this::runReport, btnRun), BorderLayout.SOUTH);
        add(top, BorderLayout.NORTH);
        add(body, BorderLayout.CENTER);
    }

    // "revenue_dollars" -> "Revenue", "quantity_sold" -> "Quantity Sold"
    private static String prettyLabel(String column) {
        StringBuilder out = new StringBuilder();
        for (String word : column.replace("_dollars", "").split("_")) {
            if (word.isEmpty()) continue;
            if (out.length() > 0) out.append(' ');
            out.append(Character.toUpperCase(word.charAt(0))).append(word.substring(1));
        }
        return out.toString();
    }

    private void runReport() {
        LocalDate from = fromField.getDate();
        LocalDate to = toField.getDate();
        if (to.isBefore(from)) {
            Alerts.warning(this, "Check the dates", "The To date must be on or after the From date.");
            return;
        }

        String sql = REPORTS.get(reportChoice.selected());
        try (PreparedStatement pstmt = dbConnection.prepareStatement(sql)) {
            pstmt.setTimestamp(1, Timestamp.valueOf(from.atStartOfDay()));
            pstmt.setTimestamp(2, Timestamp.valueOf(to.plusDays(1).atStartOfDay()));
            try (ResultSet rs = pstmt.executeQuery()) {
                ResultSetMetaData meta = rs.getMetaData();
                int columns = meta.getColumnCount();
                String[] headers = new String[columns];
                moneyColumns.clear();
                for (int i = 0; i < columns; i++) {
                    String label = meta.getColumnLabel(i + 1);
                    headers[i] = prettyLabel(label);
                    if (label.endsWith("_dollars")) {
                        moneyColumns.add(i);
                    }
                }
                resultModel.setColumnIdentifiers(headers);
                resultModel.setRowCount(0);
                while (rs.next()) {
                    Object[] row = new Object[columns];
                    for (int i = 0; i < columns; i++) {
                        row[i] = rs.getObject(i + 1);
                    }
                    resultModel.addRow(row);
                }
            }
            cards.show(body, "table");
        } catch (SQLException e) {
            System.err.println("Error running report: " + e.getMessage());
            Alerts.error(this, "Couldn't run the report", e.getMessage());
        }
    }
}

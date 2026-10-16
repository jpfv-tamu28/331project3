import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.sql.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

// Hourly sales snapshot for a single day (today by default). Read-only: running it does not reset anything.
public class XReport extends JPanel {

    // Items sold counts drinks only, toppings are child rows with a parent_order_item_id.
    private static final String HOURLY_SQL =
            "SELECT EXTRACT(HOUR FROM o.created_at)::int AS hour, COUNT(*) AS orders, "
            + "COALESCE(SUM(items.qty), 0) AS items_sold, SUM(o.total_cents) AS revenue_cents "
            + "FROM orders o "
            + "LEFT JOIN (SELECT order_id, SUM(quantity) AS qty FROM order_items "
            + "           WHERE parent_order_item_id IS NULL GROUP BY order_id) items "
            + "ON items.order_id = o.order_id "
            + "WHERE o.created_at >= ? AND o.created_at < ? "
            + "GROUP BY hour ORDER BY hour";

    private static final DateTimeFormatter GENERATED_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd h:mm a");

    private final Connection dbConnection;
    private final DefaultTableModel model = Manager.readOnlyModel(
            "Hour", "Orders", "Drinks Sold", "Revenue", "Avg Order");
    private final DatePicker dateField = new DatePicker(LocalDate.now(), day -> runReport());
    private final JLabel statOrders = statValue();
    private final JLabel statDrinks = statValue();
    private final JLabel statRevenue = statValue();
    private final JLabel statAverage = statValue();
    private final JLabel summary = new JLabel(" ");

    public XReport(Connection dbConnection) {
        this.dbConnection = dbConnection;
        setLayout(new BorderLayout());
        setBackground(DenseList.SURFACE);

        JButton btnRun = Manager.primaryButton("Run X-Report");
        btnRun.addActionListener(e -> runReport());
        JButton btnToday = Manager.secondaryButton("Today");
        btnToday.addActionListener(e -> {
            dateField.setDate(LocalDate.now());
            runReport();
        });

        JPanel tiles = new JPanel(new GridLayout(1, 4, 12, 0));
        tiles.setOpaque(false);
        tiles.add(statTile("Orders", statOrders));
        tiles.add(statTile("Drinks sold", statDrinks));
        tiles.add(statTile("Revenue", statRevenue));
        tiles.add(statTile("Average order", statAverage));

        summary.setFont(DenseList.font(Font.PLAIN, 12));
        summary.setForeground(DenseList.MUTED);
        summary.setBorder(new EmptyBorder(10, 0, 0, 0));

        JPanel overview = new JPanel(new BorderLayout());
        overview.setBackground(DenseList.SURFACE);
        overview.setBorder(new EmptyBorder(16, 20, 16, 20));
        overview.add(tiles, BorderLayout.CENTER);
        overview.add(summary, BorderLayout.SOUTH);

        JPanel top = new JPanel(new BorderLayout());
        top.add(DenseList.toolbar(new JComponent[]{DenseList.caption("Date"), dateField, btnToday}, btnRun),
                BorderLayout.NORTH);
        top.add(overview, BorderLayout.SOUTH);

        add(top, BorderLayout.NORTH);
        add(DenseList.styledTable(new JTable(model), column -> false), BorderLayout.CENTER);

        runReport();
    }

    private static JLabel statValue() {
        JLabel value = new JLabel("-");
        value.setFont(DenseList.font(Font.BOLD, 26));
        value.setForeground(DenseList.TEXT);
        return value;
    }

    private static JPanel statTile(String label, JLabel value) {
        JLabel name = new JLabel(label);
        name.setFont(DenseList.font(Font.PLAIN, 12));
        name.setForeground(DenseList.SUBTLE);
        JPanel tile = new JPanel(new BorderLayout(0, 4));
        tile.setBackground(DenseList.SECTION_BG);
        tile.setBorder(new EmptyBorder(12, 16, 14, 16));
        tile.add(name, BorderLayout.NORTH);
        tile.add(value, BorderLayout.CENTER);
        return tile;
    }

    private void runReport() {
        LocalDate day = dateField.getDate();

        model.setRowCount(0);
        int totalOrders = 0;
        int totalItems = 0;
        long totalCents = 0;

        try (PreparedStatement pstmt = dbConnection.prepareStatement(HOURLY_SQL)) {
            pstmt.setTimestamp(1, Timestamp.valueOf(day.atStartOfDay()));
            pstmt.setTimestamp(2, Timestamp.valueOf(day.plusDays(1).atStartOfDay()));
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    int orders = rs.getInt("orders");
                    int items = rs.getInt("items_sold");
                    long cents = rs.getLong("revenue_cents");
                    model.addRow(new Object[]{
                            hourLabel(rs.getInt("hour")), orders, items, dollars(cents), dollars((double) cents / orders)
                    });
                    totalOrders += orders;
                    totalItems += items;
                    totalCents += cents;
                }
            }
        } catch (SQLException e) {
            System.err.println("Error running X-report: " + e.getMessage());
            Alerts.error(this, "Couldn't run the X-Report", e.getMessage());
            return;
        }

        // The tiles carry the day's totals, so the table only lists hours.
        statOrders.setText(String.format("%,d", totalOrders));
        statDrinks.setText(String.format("%,d", totalItems));
        statRevenue.setText(dollars(totalCents));
        statAverage.setText(totalOrders == 0 ? "-" : dollars((double) totalCents / totalOrders));

        String generated = LocalDateTime.now().format(GENERATED_FORMAT);
        summary.setText(totalOrders == 0
                ? "No sales recorded for " + day + ". Generated " + generated
                : "X-Report for " + day + ". Generated " + generated);
    }

    private static String hourLabel(int hour) {
        return String.format("%s - %s", formatHour(hour), formatHour((hour + 1) % 24));
    }

    private static String formatHour(int hour) {
        int h = hour % 12 == 0 ? 12 : hour % 12;
        return h + (hour < 12 ? " AM" : " PM");
    }

    private static String dollars(double cents) {
        return String.format("$%,.2f", cents / 100.0);
    }
}

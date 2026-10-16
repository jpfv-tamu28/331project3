import javax.swing.*;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.awt.event.MouseEvent;
import java.math.BigDecimal;
import java.sql.*;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

// Inventory used over a date range: each sold item's quantity times its recipe amounts, summed per ingredient.
public class ProductUsage extends JPanel {

    private static final String ALL_UNITS = "All units";

    private static final String USAGE_SQL =
            "SELECT i.ingredient_name, i.unit, SUM(oi.quantity * r.quantity_required) AS amount_used "
            + "FROM order_items oi "
            + "JOIN orders o ON o.order_id = oi.order_id "
            + "JOIN recipes r ON r.menu_item_id = oi.menu_item_id "
            + "JOIN inventory i ON i.inventory_id = r.inventory_id "
            + "WHERE o.created_at >= ? AND o.created_at < ? "
            + "GROUP BY i.ingredient_name, i.unit "
            + "ORDER BY amount_used DESC";

    private record Usage(String ingredient, String unit, BigDecimal amount) {}

    private final Connection dbConnection;
    private final DefaultTableModel model = Manager.readOnlyModel("Ingredient", "Unit", "Amount Used");
    private final DatePicker fromField = new DatePicker(LocalDate.now().minusDays(DatePicker.DEFAULT_RANGE_DAYS), null);
    private final DatePicker toField = new DatePicker(LocalDate.now(), null);
    // Units are mixed (g, ml, each), so the chart shows one unit at a time to keep bars comparable.
    private final DenseList.ChipBar unitChoice = new DenseList.ChipBar(List.of(ALL_UNITS), unit -> showResults());
    private final BarChart chart = new BarChart();
    private List<Usage> results = new ArrayList<>();

    public ProductUsage(Connection dbConnection) {
        this.dbConnection = dbConnection;
        setLayout(new BorderLayout());
        setBackground(DenseList.SURFACE);

        JButton btnRun = Manager.primaryButton("Run");
        btnRun.addActionListener(e -> runReport());

        JTable table = new JTable(model);
        table.setAutoCreateRowSorter(true);

        JScrollPane chartScroll = new JScrollPane(chart);
        chartScroll.setBorder(null);
        chartScroll.getVerticalScrollBar().setUnitIncrement(16);
        JScrollPane tableScroll = DenseList.styledTable(table, column -> false);
        tableScroll.setBorder(BorderFactory.createMatteBorder(0, 1, 0, 0, DenseList.LINE));

        JSplitPane split = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, chartScroll, tableScroll);
        split.setResizeWeight(0.65);
        split.setBorder(null);
        split.setDividerSize(4);
        split.setBackground(DenseList.SURFACE);

        JPanel top = new JPanel(new BorderLayout());
        top.add(DenseList.toolbar(new JComponent[]{unitChoice}), BorderLayout.NORTH);
        top.add(DatePicker.rangeToolbar(fromField, toField, this::runReport, btnRun), BorderLayout.SOUTH);
        add(top, BorderLayout.NORTH);
        add(split, BorderLayout.CENTER);
    }

    private void runReport() {
        LocalDate from = fromField.getDate();
        LocalDate to = toField.getDate();
        if (to.isBefore(from)) {
            Alerts.warning(this, "Check the dates", "The To date must be on or after the From date.");
            return;
        }

        List<Usage> rows = new ArrayList<>();
        try (PreparedStatement pstmt = dbConnection.prepareStatement(USAGE_SQL)) {
            pstmt.setTimestamp(1, Timestamp.valueOf(from.atStartOfDay()));
            pstmt.setTimestamp(2, Timestamp.valueOf(to.plusDays(1).atStartOfDay()));
            try (ResultSet rs = pstmt.executeQuery()) {
                while (rs.next()) {
                    rows.add(new Usage(rs.getString("ingredient_name"), rs.getString("unit"),
                            rs.getBigDecimal("amount_used")));
                }
            }
        } catch (SQLException e) {
            System.err.println("Error running product usage: " + e.getMessage());
            Alerts.error(this, "Couldn't load product usage", e.getMessage());
            return;
        }
        results = rows;

        List<String> units = new ArrayList<>();
        units.add(ALL_UNITS);
        rows.stream().map(Usage::unit).distinct().sorted().forEach(units::add);
        unitChoice.setNames(units);
        showResults();
    }

    private void showResults() {
        String unit = unitChoice.selected();
        List<Usage> shown = results.stream()
                .filter(u -> unit == null || ALL_UNITS.equals(unit) || u.unit().equals(unit))
                .toList();

        model.setRowCount(0);
        for (Usage u : shown) {
            model.addRow(new Object[]{u.ingredient(), u.unit(), u.amount()});
        }
        chart.setData(shown, ALL_UNITS.equals(unit) ? null : unit);
    }

    // Horizontal bars, longest first: thin bars with a rounded tip, the value at the tip, details on hover.
    private static class BarChart extends JPanel {
        private static final int BAR_HEIGHT = 18;
        private static final int ROW_HEIGHT = 30;
        private static final int TOP = 52;
        private static final int PADDING = 20;
        private static final int VALUE_WIDTH = 110;
        private static final int MAX_LABEL_WIDTH = 220;
        // Tea brown, deepened from the UI accent so it reads as a color rather than gray.
        private static final Color BAR_COLOR = new Color(0x9A5B2B);

        private List<Usage> data = List.of();
        private String unit;
        private int labelWidth;

        BarChart() {
            setBackground(DenseList.SURFACE);
            setToolTipText("");
        }

        void setData(List<Usage> data, String unit) {
            this.data = data;
            this.unit = unit;
            FontMetrics fm = getFontMetrics(DenseList.font(Font.PLAIN, 13));
            labelWidth = Math.min(MAX_LABEL_WIDTH,
                    data.stream().mapToInt(u -> fm.stringWidth(u.ingredient())).max().orElse(0) + 16);
            setPreferredSize(new Dimension(400, TOP + PADDING + data.size() * ROW_HEIGHT));
            revalidate();
            repaint();
        }

        private static String amount(Usage u) {
            return DenseList.quantity(u.amount()) + " " + u.unit();
        }

        @Override
        public String getToolTipText(MouseEvent e) {
            int index = (e.getY() - TOP) / ROW_HEIGHT;
            if (e.getY() < TOP || index >= data.size()) return null;
            Usage u = data.get(index);
            return u.ingredient() + ": " + amount(u);
        }

        @Override
        protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            Graphics2D g2 = (Graphics2D) g;
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);

            g2.setFont(DenseList.font(Font.BOLD, 14));
            g2.setColor(DenseList.TEXT);
            g2.drawString("Amount used per ingredient" + (unit != null ? " (" + unit + ")" : ""), PADDING, 30);

            g2.setFont(DenseList.font(Font.PLAIN, 13));
            if (data.isEmpty()) {
                g2.setColor(DenseList.MUTED);
                g2.drawString("Pick a date range and click Run.", PADDING, TOP + 14);
                return;
            }

            double max = data.stream().mapToDouble(u -> u.amount().doubleValue()).max().orElse(1);
            int baseline = PADDING + labelWidth;
            int barSpace = Math.max(50, getWidth() - baseline - VALUE_WIDTH - PADDING);
            FontMetrics fm = g2.getFontMetrics();

            g2.setColor(DenseList.LINE);
            g2.drawLine(baseline, TOP - 4, baseline, TOP + data.size() * ROW_HEIGHT - (ROW_HEIGHT - BAR_HEIGHT));

            int y = TOP;
            for (Usage u : data) {
                int barWidth = Math.max(2, (int) Math.round(u.amount().doubleValue() / max * barSpace));
                int textY = y + (BAR_HEIGHT + fm.getAscent() - fm.getDescent()) / 2;

                g2.setColor(DenseList.TEXT);
                g2.drawString(clip(u.ingredient(), fm, labelWidth - 16), PADDING, textY);

                // Rounded at the tip, square where the bar meets the baseline.
                g2.setColor(BAR_COLOR);
                g2.fillRoundRect(baseline + 1, y, barWidth, BAR_HEIGHT, 8, 8);
                g2.fillRect(baseline + 1, y, Math.min(barWidth, 4), BAR_HEIGHT);

                g2.setColor(DenseList.SUBTLE);
                g2.drawString(amount(u), baseline + barWidth + 8, textY);

                y += ROW_HEIGHT;
            }
        }

        private static String clip(String text, FontMetrics fm, int width) {
            if (fm.stringWidth(text) <= width) return text;
            while (text.length() > 1 && fm.stringWidth(text + "\u2026") > width) {
                text = text.substring(0, text.length() - 1);
            }
            return text + "\u2026";
        }
    }
}

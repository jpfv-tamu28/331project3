import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Supplier;

// Date field that opens a month calendar, so dates are picked instead of typed.
class DatePicker extends Cashier.FlatButton {

    static final int DEFAULT_RANGE_DAYS = 30;

    private static final DateTimeFormatter LABEL = DateTimeFormatter.ofPattern("MMM d, yyyy");
    private static final Color OUTLINE_HOVER = new Color(0xCFC9C1);

    private Consumer<LocalDate> onChange;
    private final JPopupMenu popup = new JPopupMenu();
    private LocalDate date;
    private YearMonth shownMonth;

    /** onChange runs after the user picks a day; it may be null. */
    DatePicker(LocalDate initial, Consumer<LocalDate> onChange) {
        super(null, DenseList.SURFACE, DenseList.ROW_HOVER, DenseList.ROW_PRESSED, 10);
        this.onChange = onChange;
        outline = DenseList.LINE;
        hoverOutline = OUTLINE_HOVER;
        setIcon(new CalendarIcon());
        setIconTextGap(8);
        setHorizontalAlignment(LEFT);
        setFont(DenseList.font(Font.PLAIN, 13));
        setForeground(DenseList.TEXT);
        setBorder(new EmptyBorder(8, 12, 8, 12));
        // Fixed width so the toolbar doesn't shift when "Oct 2" becomes "Oct 12".
        setPreferredSize(new Dimension(146, 36));

        popup.setBackground(DenseList.SURFACE);
        popup.setBorder(BorderFactory.createLineBorder(DenseList.LINE));

        setDate(initial);
        addActionListener(e -> openCalendar());
    }

    /**
     * Second toolbar row for range reports: quick ranges, the two pickers, and the run button.
     * A quick range fills both pickers and calls onPreset; picking a custom date clears the highlight.
     */
    static JPanel rangeToolbar(DatePicker from, DatePicker to, Runnable onPreset, JButton run) {
        Map<String, Supplier<LocalDate>> starts = new LinkedHashMap<>();
        starts.put("Last 30 days", () -> LocalDate.now().minusDays(DEFAULT_RANGE_DAYS));
        starts.put("This month", () -> LocalDate.now().withDayOfMonth(1));
        starts.put("This quarter", () -> {
            LocalDate today = LocalDate.now();
            return today.withMonth((today.getMonthValue() - 1) / 3 * 3 + 1).withDayOfMonth(1);
        });
        starts.put("This year", () -> LocalDate.now().withDayOfYear(1));

        DenseList.ChipBar presets = new DenseList.ChipBar(new ArrayList<>(starts.keySet()), name -> {
            from.setDate(starts.get(name).get());
            to.setDate(LocalDate.now());
            onPreset.run();
        });
        from.onChange = day -> presets.select(null);
        to.onChange = day -> presets.select(null);

        return DenseList.toolbar(new JComponent[]{presets, DenseList.caption("From"), from,
                DenseList.caption("to"), to}, run);
    }

    LocalDate getDate() {
        return date;
    }

    void setDate(LocalDate date) {
        this.date = date;
        setText(LABEL.format(date));
    }

    private void openCalendar() {
        shownMonth = YearMonth.from(date);
        renderCalendar();
        popup.show(this, 0, getHeight() + 4);
    }

    private void pick(LocalDate day) {
        setDate(day);
        popup.setVisible(false);
        if (onChange != null) {
            onChange.accept(day);
        }
    }

    private void renderCalendar() {
        JLabel title = new JLabel(shownMonth.getMonth().getDisplayName(TextStyle.FULL, Locale.US)
                + " " + shownMonth.getYear(), SwingConstants.CENTER);
        title.setFont(DenseList.font(Font.BOLD, 13));
        title.setForeground(DenseList.TEXT);

        JButton prev = navButton("‹", "Previous month");
        prev.addActionListener(e -> showMonth(shownMonth.minusMonths(1)));
        JButton next = navButton("›", "Next month");
        next.addActionListener(e -> showMonth(shownMonth.plusMonths(1)));

        JPanel header = new JPanel(new BorderLayout());
        header.setOpaque(false);
        header.add(prev, BorderLayout.WEST);
        header.add(title, BorderLayout.CENTER);
        header.add(next, BorderLayout.EAST);

        JPanel grid = new JPanel(new GridLayout(0, 7, 2, 2));
        grid.setOpaque(false);
        // Weeks start on Sunday.
        DayOfWeek[] week = {DayOfWeek.SUNDAY, DayOfWeek.MONDAY, DayOfWeek.TUESDAY, DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY, DayOfWeek.FRIDAY, DayOfWeek.SATURDAY};
        for (DayOfWeek day : week) {
            JLabel name = new JLabel(day.getDisplayName(TextStyle.SHORT, Locale.US).substring(0, 2),
                    SwingConstants.CENTER);
            name.setFont(DenseList.font(Font.PLAIN, 11));
            name.setForeground(DenseList.MUTED);
            grid.add(name);
        }
        int leadingBlanks = shownMonth.atDay(1).getDayOfWeek().getValue() % 7;
        for (int i = 0; i < leadingBlanks; i++) {
            grid.add(new JLabel());
        }
        LocalDate today = LocalDate.now();
        for (int d = 1; d <= shownMonth.lengthOfMonth(); d++) {
            grid.add(dayButton(shownMonth.atDay(d), today));
        }

        Cashier.FlatButton btnToday = new Cashier.FlatButton("Today", null, DenseList.CHIP, DenseList.LINE, 8);
        btnToday.setFont(DenseList.font(Font.BOLD, 12));
        btnToday.setForeground(DenseList.TEXT);
        btnToday.setBorder(new EmptyBorder(5, 10, 5, 10));
        btnToday.addActionListener(e -> pick(today));
        JPanel footer = new JPanel(new FlowLayout(FlowLayout.RIGHT, 0, 0));
        footer.setOpaque(false);
        footer.add(btnToday);

        JPanel panel = new JPanel(new BorderLayout(0, 8));
        panel.setBackground(DenseList.SURFACE);
        panel.setBorder(new EmptyBorder(10, 10, 10, 10));
        panel.add(header, BorderLayout.NORTH);
        panel.add(grid, BorderLayout.CENTER);
        panel.add(footer, BorderLayout.SOUTH);

        popup.removeAll();
        popup.add(panel);
        popup.pack();
    }

    private void showMonth(YearMonth month) {
        shownMonth = month;
        renderCalendar();
        popup.revalidate();
        popup.repaint();
    }

    private JButton dayButton(LocalDate day, LocalDate today) {
        boolean selected = day.equals(date);
        Cashier.FlatButton btn = selected
                ? new Cashier.FlatButton(String.valueOf(day.getDayOfMonth()), DenseList.TEXT, DenseList.TEXT, DenseList.TEXT, 8)
                : new Cashier.FlatButton(String.valueOf(day.getDayOfMonth()), null, DenseList.CHIP, DenseList.LINE, 8);
        if (day.equals(today) && !selected) {
            btn.outline = OUTLINE_HOVER;
        }
        btn.setFont(DenseList.font(day.equals(today) ? Font.BOLD : Font.PLAIN, 12));
        btn.setForeground(selected ? Color.WHITE : DenseList.TEXT);
        btn.setBorder(new EmptyBorder(0, 0, 0, 0));
        btn.setPreferredSize(new Dimension(32, 30));
        btn.addActionListener(e -> pick(day));
        return btn;
    }

    private static JButton navButton(String glyph, String tooltip) {
        Cashier.FlatButton btn = new Cashier.FlatButton(glyph, null, DenseList.CHIP, DenseList.LINE, 8);
        btn.setFont(DenseList.font(Font.PLAIN, 18));
        btn.setForeground(DenseList.SUBTLE);
        btn.setBorder(new EmptyBorder(0, 10, 2, 10));
        btn.setToolTipText(tooltip);
        return btn;
    }

    // Small outlined calendar drawn in code, since the default fonts lack a calendar glyph.
    private static class CalendarIcon implements Icon {
        @Override
        public void paintIcon(Component c, Graphics g, int x, int y) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(DenseList.SUBTLE);
            g2.setStroke(new BasicStroke(1.3f));
            g2.drawRoundRect(x, y + 2, 13, 12, 3, 3);
            g2.drawLine(x, y + 6, x + 13, y + 6);
            g2.drawLine(x + 4, y, x + 4, y + 3);
            g2.drawLine(x + 9, y, x + 9, y + 3);
            g2.dispose();
        }

        @Override
        public int getIconWidth() {
            return 14;
        }

        @Override
        public int getIconHeight() {
            return 15;
        }
    }
}

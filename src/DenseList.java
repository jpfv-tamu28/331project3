import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.table.DefaultTableCellRenderer;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.IntConsumer;
import java.util.function.IntFunction;
import java.util.function.IntPredicate;

// Searchable list of rows grouped under section headers ("Dense list" design).
// The table model stays the source of truth, so callers keep working with model rows.
class DenseList extends JPanel {

    static final Color SURFACE = Color.WHITE;
    static final Color SECTION_BG = new Color(0xFAF9F7);
    static final Color ROW_HOVER = new Color(0xFAF9F7);
    static final Color ROW_PRESSED = new Color(0xF2EFEB);
    static final Color ROW_LINE = new Color(0xF4F2EF);
    static final Color LINE = new Color(0xE9E6E1);
    static final Color CHIP = new Color(0xF4F2EF);
    static final Color TEXT = new Color(0x1F1D1B);
    static final Color SUBTLE = new Color(0x6B655E);
    static final Color MUTED = new Color(0x8A847C);

    record Badge(String text, Color fg, Color bg) {
        static Badge muted(String text) {
            return new Badge(text, SUBTLE, CHIP);
        }

        static Badge alert(String text) {
            return new Badge(text, new Color(0xA8302A), new Color(0xFBE4E1));
        }
    }

    // value and detail are right-aligned; detail and badge may be null.
    record Row(String title, String subtitle, String value, String detail, Badge badge) {}

    private final DefaultTableModel model;
    private final Map<String, IntPredicate> filters;
    private final List<String> pinnedGroups;
    private final IntFunction<String> groupOf;
    private final IntFunction<Row> rowOf;
    private final IntConsumer onOpen;
    private final String noun;

    private final JTextField search;
    private final ChipBar filterBar;
    private final JPanel list = new JPanel();
    private boolean rebuildQueued;

    /**
     * @param filters      label → which model rows it keeps; the first entry is selected initially
     * @param pinnedGroups sections listed first, in this order; others follow in order of appearance
     * @param noun         singular used in section counts, e.g. "item"
     */
    DenseList(DefaultTableModel model, String searchHint, Map<String, IntPredicate> filters,
              List<String> pinnedGroups, IntFunction<String> groupOf, IntFunction<Row> rowOf,
              IntConsumer onOpen, String noun, JButton... actions) {
        super(new BorderLayout());
        this.model = model;
        this.filters = filters;
        this.pinnedGroups = pinnedGroups;
        this.groupOf = groupOf;
        this.rowOf = rowOf;
        this.onOpen = onOpen;
        this.noun = noun;
        setBackground(SURFACE);

        search = new Cashier.RoundTextField(searchHint);
        search.setFont(font(Font.PLAIN, 13));
        search.setPreferredSize(new Dimension(260, 36));
        search.setMaximumSize(new Dimension(260, 36));
        search.getDocument().addDocumentListener(new javax.swing.event.DocumentListener() {
            @Override public void insertUpdate(javax.swing.event.DocumentEvent e) { rebuild(); }
            @Override public void removeUpdate(javax.swing.event.DocumentEvent e) { rebuild(); }
            @Override public void changedUpdate(javax.swing.event.DocumentEvent e) { rebuild(); }
        });

        filterBar = new ChipBar(new ArrayList<>(filters.keySet()), name -> rebuild());
        add(toolbar(new JComponent[]{search, filterBar}, actions), BorderLayout.NORTH);

        list.setLayout(new BoxLayout(list, BoxLayout.Y_AXIS));
        list.setBackground(SURFACE);
        JPanel listHolder = new JPanel(new BorderLayout());
        listHolder.setBackground(SURFACE);
        listHolder.add(list, BorderLayout.NORTH);
        JScrollPane scroll = new JScrollPane(listHolder,
                JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED, JScrollPane.HORIZONTAL_SCROLLBAR_NEVER);
        scroll.setBorder(null);
        scroll.getVerticalScrollBar().setUnitIncrement(16);
        add(scroll, BorderLayout.CENTER);

        // Loading fires one event per row, so collapse them into a single rebuild.
        model.addTableModelListener(e -> {
            if (!rebuildQueued) {
                rebuildQueued = true;
                SwingUtilities.invokeLater(() -> {
                    rebuildQueued = false;
                    rebuild();
                });
            }
        });
        rebuild();
    }

    static Font font(int style, int size) {
        return new Font("SansSerif", style, size);
    }

    /** Escapes user text for an HTML label so it always renders as plain text. */
    static String html(String text) {
        return text == null ? "" : text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\n", "<br>");
    }

    /** Uppercase section title on the left with a muted note on the right (the note may be null). */
    static JPanel sectionBar(String title, String note) {
        JPanel header = new JPanel(new BorderLayout());
        header.setBackground(SECTION_BG);
        header.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 0, 1, 0, LINE),
                new EmptyBorder(8, 20, 8, 20)));
        JLabel name = new JLabel(title.toUpperCase());
        name.setFont(font(Font.BOLD, 11));
        name.setForeground(SUBTLE);
        header.add(name, BorderLayout.WEST);
        if (note != null) {
            JLabel right = new JLabel(note);
            right.setFont(font(Font.PLAIN, 12));
            right.setForeground(MUTED);
            header.add(right, BorderLayout.EAST);
        }
        return header;
    }

    // Top bar shared by the manager tabs: controls on the left, actions pinned right.
    static JPanel toolbar(JComponent[] left, JComponent... right) {
        JPanel top = new JPanel();
        top.setLayout(new BoxLayout(top, BoxLayout.X_AXIS));
        top.setBackground(SURFACE);
        top.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 0, 1, 0, LINE),
                new EmptyBorder(12, 20, 12, 20)));
        addSpaced(top, left, 12);
        top.add(Box.createHorizontalGlue());
        addSpaced(top, right, 8);
        return top;
    }

    private static void addSpaced(JPanel panel, JComponent[] parts, int gap) {
        for (int i = 0; i < parts.length; i++) {
            if (i > 0) {
                panel.add(Box.createRigidArea(new Dimension(gap, 0)));
            }
            parts[i].setMaximumSize(parts[i].getPreferredSize());
            panel.add(parts[i]);
        }
    }

    static JLabel caption(String text) {
        JLabel label = new JLabel(text);
        label.setFont(font(Font.PLAIN, 13));
        label.setForeground(SUBTLE);
        return label;
    }

    // Row of single-select filter buttons; the first name starts selected.
    static class ChipBar extends JPanel {
        private final Consumer<String> onPick;
        private List<String> names;
        private String selected;

        ChipBar(List<String> names, Consumer<String> onPick) {
            super(new FlowLayout(FlowLayout.LEFT, 4, 0));
            this.onPick = onPick;
            setOpaque(false);
            setNames(names);
        }

        String selected() {
            return selected;
        }

        // null clears the highlight, e.g. after a custom date range is picked.
        void select(String name) {
            selected = name;
            render();
        }

        // Keeps the current pick when it is still offered.
        void setNames(List<String> names) {
            this.names = names;
            if (selected == null || !names.contains(selected)) {
                selected = names.isEmpty() ? null : names.get(0);
            }
            render();
        }

        private void render() {
            removeAll();
            for (String name : names) {
                boolean active = name.equals(selected);
                Cashier.FlatButton btn = active
                        ? new Cashier.FlatButton(name, TEXT, TEXT, TEXT, 8)
                        : new Cashier.FlatButton(name, null, CHIP, LINE, 8);
                btn.setFont(font(Font.PLAIN, 13));
                btn.setForeground(active ? Color.WHITE : SUBTLE);
                btn.setBorder(new EmptyBorder(6, 10, 6, 10));
                btn.addActionListener(e -> {
                    selected = name;
                    render();
                    onPick.accept(name);
                });
                add(btn);
            }
            setMaximumSize(getPreferredSize());
            revalidate();
            repaint();
        }
    }

    // Equal-width buttons where exactly one option is picked, e.g. Small / Medium / Large.
    static class Segmented extends JPanel {
        private final String[] options;
        private String selected;
        private Consumer<String> onPick = option -> { };

        Segmented(String[] options, String initial) {
            super(new GridLayout(1, options.length, 4, 0));
            this.options = options;
            this.selected = initial;
            setOpaque(false);
            render();
        }

        String selected() {
            return selected;
        }

        /** Runs when the user taps an option (not when select() is called from code). */
        void onPick(Consumer<String> onPick) {
            this.onPick = onPick;
        }

        // null shows no option as picked.
        void select(String option) {
            selected = option;
            render();
        }

        private void render() {
            removeAll();
            for (String option : options) {
                boolean active = option.equals(selected);
                Cashier.FlatButton btn = active
                        ? new Cashier.FlatButton(option, TEXT, TEXT, TEXT, 8)
                        : new Cashier.FlatButton(option, CHIP, LINE, new Color(0xCFC9C1), 8);
                btn.setFont(font(active ? Font.BOLD : Font.PLAIN, 13));
                btn.setForeground(active ? Color.WHITE : TEXT);
                btn.setBorder(new EmptyBorder(8, 10, 8, 10));
                btn.addActionListener(e -> {
                    select(option);
                    onPick.accept(option);
                });
                add(btn);
            }
            revalidate();
            repaint();
        }
    }

    /** Hairline rows, a quiet header, and right-aligned numbers; money columns (model indexes) get $ formatting. */
    static JScrollPane styledTable(JTable table, IntPredicate isMoneyColumn) {
        return styledTable(table, isMoneyColumn, column -> false);
    }

    /** Same as above; ID columns (model indexes) show as "#1042" rather than "1,042". */
    static JScrollPane styledTable(JTable table, IntPredicate isMoneyColumn, IntPredicate isIdColumn) {
        table.setRowHeight(34);
        table.setShowVerticalLines(false);
        table.setGridColor(ROW_LINE);
        table.setIntercellSpacing(new Dimension(0, 1));
        table.setFont(font(Font.PLAIN, 13));
        table.setForeground(TEXT);
        table.setBackground(SURFACE);
        table.setSelectionBackground(ROW_PRESSED);
        table.setSelectionForeground(TEXT);
        table.setFillsViewportHeight(true);
        table.getTableHeader().setReorderingAllowed(false);

        DefaultTableCellRenderer header = new DefaultTableCellRenderer() {
            @Override
            public Component getTableCellRendererComponent(JTable t, Object value, boolean selected,
                                                           boolean focus, int row, int column) {
                super.getTableCellRendererComponent(t, value == null ? "" : value.toString().toUpperCase(),
                        false, false, row, column);
                // The base renderer resets these on every call, so they're applied here.
                setFont(font(Font.BOLD, 11));
                setForeground(SUBTLE);
                setBackground(SECTION_BG);
                setBorder(BorderFactory.createCompoundBorder(
                        BorderFactory.createMatteBorder(0, 0, 1, 0, LINE), new EmptyBorder(9, 16, 9, 16)));
                setHorizontalAlignment(isNumericColumn(t, column) ? RIGHT : LEFT);
                return this;
            }
        };
        table.getTableHeader().setDefaultRenderer(header);

        table.setDefaultRenderer(Object.class, new DefaultTableCellRenderer() {
            @Override
            public Component getTableCellRendererComponent(JTable t, Object value, boolean selected,
                                                           boolean focus, int row, int column) {
                Object shown = value;
                if (value instanceof Number n) {
                    int modelColumn = t.convertColumnIndexToModel(column);
                    shown = isMoneyColumn.test(modelColumn) ? String.format("$%,.2f", n.doubleValue())
                            : isIdColumn.test(modelColumn) ? "#" + n
                            : quantity(n);
                }
                super.getTableCellRendererComponent(t, shown, selected, false, row, column);
                setBorder(new EmptyBorder(0, 16, 0, 16));
                setHorizontalAlignment(isNumericColumn(t, column) ? RIGHT : LEFT);
                return this;
            }
        });
        table.setDefaultRenderer(Number.class, table.getDefaultRenderer(Object.class));

        JScrollPane scroll = new JScrollPane(table);
        scroll.setColumnHeaderView(table.getTableHeader());
        scroll.setBorder(null);
        scroll.getViewport().setBackground(SURFACE);
        return scroll;
    }

    // 152400 -> "152,400", 12.50 -> "12.5"
    static String quantity(Number n) {
        return new java.text.DecimalFormat("#,##0.###").format(n);
    }

    // A column is numeric when its first value is a number or a formatted amount like "$4.50".
    private static boolean isNumericColumn(JTable table, int column) {
        if (table.getRowCount() == 0) return false;
        Object first = table.getValueAt(0, column);
        return first instanceof Number || (first instanceof String s && s.startsWith("$"));
    }

    private void rebuild() {
        String query = search.getText().trim().toLowerCase();
        IntPredicate keep = filters.get(filterBar.selected());
        Map<String, List<Integer>> groups = new LinkedHashMap<>();
        for (String pinned : pinnedGroups) {
            groups.put(pinned, new ArrayList<>());
        }
        for (int r = 0; r < model.getRowCount(); r++) {
            if (!keep.test(r)) continue;
            Row row = rowOf.apply(r);
            String group = groupOf.apply(r);
            String haystack = (row.title() + " " + row.subtitle() + " " + group).toLowerCase();
            if (haystack.contains(query)) {
                groups.computeIfAbsent(group, g -> new ArrayList<>()).add(r);
            }
        }

        list.removeAll();
        groups.forEach((group, rows) -> {
            if (rows.isEmpty()) return;
            list.add(sectionHeader(group, rows.size()));
            for (int r : rows) {
                list.add(rowButton(r));
            }
        });
        if (list.getComponentCount() == 0) {
            JLabel none = new JLabel("Nothing matches");
            none.setFont(font(Font.PLAIN, 13));
            none.setForeground(MUTED);
            none.setAlignmentX(Component.LEFT_ALIGNMENT);
            none.setBorder(new EmptyBorder(40, 20, 0, 0));
            list.add(none);
        }
        list.revalidate();
        list.repaint();
    }

    private JComponent sectionHeader(String group, int count) {
        JPanel header = sectionBar(group, count + " " + noun + (count == 1 ? "" : "s"));
        header.setMaximumSize(new Dimension(Integer.MAX_VALUE, header.getPreferredSize().height));
        header.setAlignmentX(Component.LEFT_ALIGNMENT);
        return header;
    }

    private JComponent rowButton(int modelRow) {
        Row row = rowOf.apply(modelRow);

        Cashier.FlatButton btn = new Cashier.FlatButton(null, SURFACE, ROW_HOVER, ROW_PRESSED, 0);
        btn.setLayout(new BorderLayout(16, 0));
        btn.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 0, 1, 0, ROW_LINE),
                new EmptyBorder(10, 20, 10, 20)));
        btn.addActionListener(e -> onOpen.accept(modelRow));

        JLabel text = new JLabel("<html><b>" + html(row.title()) + "</b><br>"
                + "<font color='#8a847c'>" + html(row.subtitle()) + "</font></html>");
        text.setFont(font(Font.PLAIN, 13));
        text.setForeground(TEXT);

        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 12, 0));
        right.setOpaque(false);
        if (row.badge() != null) {
            right.add(new Pill(row.badge()));
        }
        String value = "<html><div align='right'><b>" + html(row.value()) + "</b>"
                + (row.detail() != null ? "<br><font color='#8a847c'>" + html(row.detail()) + "</font>" : "")
                + "</div></html>";
        JLabel valueLabel = new JLabel(value);
        valueLabel.setFont(font(Font.PLAIN, 13));
        valueLabel.setForeground(TEXT);
        right.add(valueLabel);
        right.add(new EditChip(btn));

        btn.add(text, BorderLayout.CENTER);
        btn.add(right, BorderLayout.EAST);
        btn.setMaximumSize(new Dimension(Integer.MAX_VALUE, btn.getPreferredSize().height));
        btn.setAlignmentX(Component.LEFT_ALIGNMENT);
        return btn;
    }

    private static class Pill extends JLabel {
        private final Color fill;

        Pill(Badge badge) {
            super(badge.text());
            this.fill = badge.bg();
            setFont(font(Font.BOLD, 11));
            setForeground(badge.fg());
            setBorder(new EmptyBorder(3, 8, 3, 8));
        }

        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(fill);
            g2.fillRoundRect(0, 0, getWidth(), getHeight(), getHeight(), getHeight());
            g2.dispose();
            super.paintComponent(g);
        }
    }

    // "Edit" hint that turns dark while its row is hovered, like the + in the prototype.
    private static class EditChip extends JLabel {
        private final AbstractButton row;

        EditChip(AbstractButton row) {
            super("Edit");
            this.row = row;
            setFont(font(Font.BOLD, 12));
            setBorder(new EmptyBorder(5, 10, 5, 10));
            setForeground(TEXT);
            row.getModel().addChangeListener(e -> {
                setForeground(row.getModel().isRollover() ? Color.WHITE : TEXT);
                repaint();
            });
        }

        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(row.getModel().isRollover() ? TEXT : CHIP);
            g2.fillRoundRect(0, 0, getWidth(), getHeight(), 8, 8);
            g2.dispose();
            super.paintComponent(g);
        }
    }
}

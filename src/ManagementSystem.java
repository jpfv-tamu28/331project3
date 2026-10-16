import javax.swing.*;
import javax.swing.border.*;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.geom.Path2D;
import java.awt.geom.Rectangle2D;
import java.util.function.Consumer;
import java.util.function.Function;
 
/**
 * Boba Bops Management System: Dashboard, Trend, Employee, Inventory (+ Cashier placeholder).
 */
public class ManagementSystem extends JFrame {
 
    // ---------- palette & fonts ----------
    static final Color BG = new Color(204, 204, 204);
    static final Color DARK = new Color(40, 40, 40);
    static final Color GRAY_TXT = new Color(120, 120, 120);
    static final Color GRID = new Color(225, 225, 225);
    static final Color GREEN = new Color(0, 170, 30);
    static final Color RED = new Color(220, 0, 0);
    static final Color OLIVE = new Color(140, 140, 0);
    static final Color OK = new Color(20, 110, 20);
 
    static Font f(int style, int size) {
        return new Font("SansSerif", style, size);
    }
 
    // ---------- sample data ----------
    static final String[] RANGES = {"48 hours", "1 week", "1 month", "3 months", "6 months",
            "1 year", "3 years", "6 years", "9 years", "max"};
    static final String[] X_LABELS = {"Time 1", "24", "25", "26", "27", "28", "29", "Time 2"};
    static final double[] PROFIT = {22000, 22000, 23500, 27500, 26200, 29500, 32500, 32000, 36500, 33500, 39500, 37500, 46500};
    static final double[] EXPENSE = {48000, 48000, 47000, 44000, 42000, 43000, 40000, 38000, 36000, 36500, 33000, 31000, 34500, 29000, 30500, 21500};
    static final String[] ITEM_LABELS = {"Tea", "Boba", "Chai", "Match", "Labub", "Choc", "Lmon", "Item", "Item", "Item", "Item", "Item"};
    static final double[] ITEM_SALES = {47000, 52500, 47000, 45000, 57000, 77000, 58000, 66000, 53500, 48000, 45000, 24000};
 
    // name, sold, change, remaining
    static final String[][] REFILLS = {
            {"Black tea", "4321", "+84%", "0"},
            {"Lemonade", "4033", "-8%", "8"},
            {"Chai", "3128", "+2%", "18"},
            {"Boba", "2104", "+33%", "119"},
            {"Matcha", "2003", "+30%", "400"},
            {"Labubu", "1894", "+15%", "412"},
            {"Dubai Chocolate", "405", "-12%", "556"}
    };
    // name, days of stock, rate, remaining
    static final String[][] STOCK = {
            {"Black tea", "0", "-5/hr", "0"},
            {"Lemonade", "<1", "-9/hr", "24"},
            {"Chai", "1", "-5/hr", "8"},
            {"Boba", "3d", "-5/hr", "119"},
            {"Matcha", "1w", "-5/hr", "400"},
            {"Labubu", "2w", "-5/hr", "412"},
            {"Dubai Chocolate", "6w", "-5/hr", "556"},
            {"Wintermelon flavoring", ">1yr", "-5/hr", "556"},
            {"Plastic cups", ">1yr", "-5/hr", "556"},
            {"Paper lids", ">1yr", "-5/hr", "556"},
            {"Plastic straws", ">1yr", "-5/hr", "556"},
            {"Sugar", ">1yr", "-5/hr", "556"},
            {"Honey", ">1yr", "-5/hr", "556"},
            {"Popping boba", ">1yr", "-5/hr", "556"}
    };
    static final String[][] TASKS = {
            {"FIG-123", "Chris", "Project 1", "High", "Dec 5"},
            {"FIG-122", "Juan", "Acme GTM", "Low", "Dec 5"},
            {"FIG-121", "Rowan", "Acme GTM", "High", "Dec 5"},
            {"FIG-120", "Pablo", "Website launch", "Low", "Dec 5"},
            {"FIG-119", "Cayden", "Design backlog", "Medium", "Dec 5"},
            {"FIG-118", "Flores", "Bug fixes", "Medium", "Dec 5"},
            {"FIG-117", "Villa", "Bug fixes", "Medium", "Dec 5"},
            {"FIG-116", "Real", "Bug fixes", "Low", "Dec 5"}
    };
    static final String[] SHOP_ITEMS = {"Black tea", "Lemonade", "Chai", "Boba", "Matcha", "Labubu",
            "Dubai Chocolate", "Wintermelon flavoring", "Plastic cups", "Paper lids", "Plastic straws",
            "Sugar", "Honey", "Popping boba"};
    static final double[] SHOP_UNIT = {5, 6, 94.0 / 22, 118.0 / 48, 8, 7, 12, 6, 0.5, 0.3, 0.2, 2, 4, 5};
    static final int[] SHOP_PRESET = {10, 15, 22, 48, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
 
    // ---------- frame ----------
    private final CardLayout cards = new CardLayout();
    private final JPanel cardPanel = new JPanel(cards);
    private final JLabel titleLabel = new JLabel();
 
    public ManagementSystem() {
        super("Boba Bops Management System");
        setDefaultCloseOperation(EXIT_ON_CLOSE);
        setLayout(new BorderLayout());
        getContentPane().setBackground(BG);
 
        JPanel north = new JPanel(new BorderLayout());
        north.setBackground(BG);
        north.add(buildHeader(), BorderLayout.NORTH);
        north.add(buildNav(), BorderLayout.CENTER);
        add(north, BorderLayout.NORTH);
 
        cardPanel.setBackground(BG);
        cardPanel.add(scroller(dashboardView()), "dashboard");
        cardPanel.add(scroller(trendView()), "trends");
        cardPanel.add(scroller(employeeView()), "employees");
        cardPanel.add(scroller(inventoryView()), "inventory");
        cardPanel.add(scroller(cashierView()), "cashier");
        add(cardPanel, BorderLayout.CENTER);
 
        showView("dashboard");
        setSize(1280, 880);
        setMinimumSize(new Dimension(900, 600));
        setLocationRelativeTo(null);
    }
 
    private void showView(String key) {
        String suffix;
        switch (key) {
            case "trends": suffix = "TREND VIEW"; break;
            case "employees": suffix = "EMPLOYEE VIEW"; break;
            case "inventory": suffix = "INVENTORY VIEW"; break;
            case "cashier": suffix = "CASHIER VIEW"; break;
            default: suffix = "DASHBOARD AND QUICK ACTIONS";
        }
        titleLabel.setText("BOBA BOPS MANAGEMENT SYSTEM - " + suffix);
        cards.show(cardPanel, key);
    }
 
    // ---------- header & nav ----------
    private JComponent buildHeader() {
        JPanel h = new JPanel(new BorderLayout());
        h.setBackground(Color.WHITE);
        h.setBorder(new EmptyBorder(14, 28, 14, 28));
 
        titleLabel.setFont(f(Font.BOLD, 16));
        h.add(titleLabel, BorderLayout.WEST);
 
        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 12, 0));
        right.setOpaque(false);
 
        RButton dash = new RButton("Dashboard", DARK, Color.WHITE);
        dash.addActionListener(e -> showView("dashboard"));
        RButton logout = new RButton("Log out", DARK, Color.WHITE);
        logout.addActionListener(e -> {
            dispose();
            new Auth().setVisible(true);
        });
        RButton more = new RButton("\u2022\u2022\u2022", new Color(235, 235, 235), Color.BLACK);
        RButton share = new RButton("Share", Color.BLACK, Color.WHITE);
        share.addActionListener(e -> JOptionPane.showMessageDialog(this, "Sharing is not implemented yet."));
 
        right.add(dash);
        right.add(logout);
        right.add(more);
        right.add(share);
        right.add(new Avatar("Manager", 32));
        JLabel chevron = new JLabel("\u25BE");
        chevron.setForeground(GRAY_TXT);
        right.add(chevron);
        h.add(right, BorderLayout.EAST);
        return h;
    }
 
    private JComponent buildNav() {
        JPanel nav = new JPanel(new BorderLayout());
        nav.setOpaque(false);
        nav.setBorder(new EmptyBorder(8, 28, 8, 28));
 
        JPanel btns = new JPanel(new GridLayout(1, 4, 14, 0));
        btns.setOpaque(false);
        String[][] items = {{"View Trends", "trends"}, {"View Employees", "employees"},
                {"View inventory", "inventory"}, {"Cashier View", "cashier"}};
        for (String[] it : items) {
            RButton b = new RButton(it[0], DARK, Color.WHITE);
            b.setPreferredSize(new Dimension(150, 64));
            b.addActionListener(e -> showView(it[1]));
            btns.add(b);
        }
        nav.add(btns, BorderLayout.WEST);
 
        Field search = new Field("Search...", 22);
        search.setPreferredSize(new Dimension(300, 38));
        JPanel sw = new JPanel(new GridBagLayout());
        sw.setOpaque(false);
        sw.add(search);
        nav.add(sw, BorderLayout.EAST);
        return nav;
    }
 
    // ---------- views ----------
    private JPanel dashboardView() {
        JPanel v = vbox();
        v.add(statRow());
        v.add(gap(10));
        v.add(trendSelector(new String[]{"Week", "2 months", "Year"}));
        v.add(gap(10));
 
        Card sales = new Card("Sales over time");
        sales.add(new LineChart(PROFIT, X_LABELS, 20000, 50000, 25000, 5000, ManagementSystem::dollars), BorderLayout.CENTER);
        Card emps = new Card("Employees"); // See employees and their current tasks.
        emps.add(employeeList(), BorderLayout.CENTER);
        v.add(split(sales, 0.6, emps, 0.4));
        v.add(gap(16));
 
        Card inv = new Card("Inventory");
        JPanel body = vbox();
        body.add(row(new JComponent[]{lbl("Item", GRAY_TXT), lbl("Sold", GRAY_TXT), lbl("Sold %", GRAY_TXT),
                        lbl("Remaining", GRAY_TXT), lbl("")},
                new int[]{0, 70, 70, 90, 120}, A_REFILL, 34, true));
        for (String[] r : REFILLS) {
            body.add(refillRow(r));
        }
        inv.add(body, BorderLayout.CENTER);
 
        Card bars = new Card("Sales of each item");
        bars.add(new BarChart(ITEM_LABELS, ITEM_SALES, 20000, 80000, 30000, 10000, ManagementSystem::dollars), BorderLayout.CENTER);
        v.add(split(inv, 0.5, bars, 0.5));
        return v;
    }
 
    private JPanel trendView() {
        JPanel v = vbox();
        v.add(statRow());
        v.add(gap(10));
        v.add(trendSelector(RANGES));
        v.add(gap(12));
 
        JPanel grid = new JPanel(new GridLayout(2, 2, 16, 16));
        grid.setOpaque(false);
 
        Card profits = new Card("Profits over time");
        profits.add(new LineChart(PROFIT, X_LABELS, 20000, 50000, 25000, 5000, ManagementSystem::dollars), BorderLayout.CENTER);
        Card customers = new Card("Customers over time");
        customers.add(new LineChart(PROFIT, X_LABELS, 20000, 50000, 25000, 5000, ManagementSystem::plain), BorderLayout.CENTER);
        Card expenses = new Card("Expenses over time");
        expenses.add(new LineChart(EXPENSE, X_LABELS, 20000, 50000, 25000, 5000, ManagementSystem::dollars), BorderLayout.CENTER);
        Card items = new Card("Sales of each item");
        items.add(new BarChart(ITEM_LABELS, ITEM_SALES, 20000, 80000, 30000, 10000, ManagementSystem::plain), BorderLayout.CENTER);
 
        grid.add(profits);
        grid.add(customers);
        grid.add(expenses);
        grid.add(items);
        v.add(grid);
        return v;
    }
 
    private JPanel employeeView() {
        JPanel v = vbox();
        v.add(new TasksCard());
        v.add(gap(8));
        v.add(leftWrap(segmented(RANGES, 0, null)));
        v.add(gap(8));
 
        Card c = new Card("Time spent on each task");
        c.add(new BarChart(new String[]{"Orders", "Food prep", "Mixing", "Cleaning", "Idle", "Misc."},
                new double[]{3.9, 4.7, 3.9, 3.6, 2.1, 5.4}, 0, 6, 1, 1,
                d -> String.format("%.0fhr", d)), BorderLayout.CENTER);
        v.add(c);
        return v;
    }
 
    private JPanel inventoryView() {
        JPanel left = vbox();
        left.add(refillsCard());
        left.add(gap(16));
        left.add(inventoryCard());
 
        JPanel right = vbox();
        right.add(pastOrdersCard());
        right.add(gap(16));
        right.add(shopCard());
 
        JPanel cols = new JPanel(new GridLayout(1, 2, 16, 0)); // order list
        cols.setOpaque(false);
        cols.add(top(left));
        cols.add(top(right));
        return cols;
    }
 
    private JPanel cashierView() {
        Card c = new Card("Cashier view");
        JLabel l = new JLabel("No design was provided for the cashier screen yet.");
        l.setForeground(GRAY_TXT);
        l.setBorder(new EmptyBorder(60, 0, 60, 0));
        l.setHorizontalAlignment(SwingConstants.CENTER);
        c.add(l, BorderLayout.CENTER);
        JPanel v = vbox();
        v.add(c);
        return v;
    }
 
    // ---------- inventory cards ----------
    private JComponent refillsCard() {
        Card c = new Card("Recommended refills");
        JPanel body = vbox();
        body.add(row(new JComponent[]{lbl("Item", GRAY_TXT), lbl("Sold", GRAY_TXT), lbl("Sold %", GRAY_TXT),
                        lbl("Remaining", GRAY_TXT), lbl("")},
                new int[]{0, 70, 70, 90, 120}, A_REFILL, 34, true));
        for (int i = 0; i < 3; i++) {
            body.add(refillRow(REFILLS[i]));
        }
        JLabel more = lbl("2 more...", GRAY_TXT);
        more.setBorder(new EmptyBorder(10, 0, 4, 0));
        body.add(leftWrap(more));
        c.add(body, BorderLayout.CENTER);
        return c;
    }
 
    private JComponent refillRow(String[] r) {
        RButton order = new RButton("Order 50", DARK, Color.WHITE);
        order.addActionListener(e -> orderDialog((Component) e.getSource(), r[0]));
        return row(new JComponent[]{lbl(r[0]), lbl(r[1]), lbl(r[2]), colored(r[3]), order},
                new int[]{0, 70, 70, 90, 120}, A_REFILL, 38, true);
    }
 
    private JComponent inventoryCard() {
        Card c = new Card("Inventory");
        JPanel body = vbox();
        body.add(row(new JComponent[]{lbl("Item", GRAY_TXT), lbl("Approx. days remaining of stock:", GRAY_TXT),
                        lbl("Rate", GRAY_TXT), lbl("Remaining", GRAY_TXT)},
                new int[]{0, 232, 64, 84}, A_STOCK, 34, true));
        for (String[] s : STOCK) {
            JLabel days = lbl(s[1]);
            if (s[1].equals("0")) days.setForeground(RED);
            body.add(row(new JComponent[]{lbl(s[0]), days, lbl(s[2]), colored(s[3])},
                    new int[]{0, 232, 64, 84}, A_STOCK, 38, true));
        }
        c.add(body, BorderLayout.CENTER);
        return c;
    }
 
    private JComponent pastOrdersCard() {
        Card c = new Card("Past orders:");
        JPanel body = vbox();
        body.add(row(new JComponent[]{lbl("Item", GRAY_TXT), lbl(""), lbl("Cost:", GRAY_TXT)},
                new int[]{0, 130, 64}, A_PAST, 34, true));
        String[][] past = {{"9/20/26", "$50"}, {"8/30/26", "$90"}, {"8/20/26", "$94"}};
        for (String[] p : past) {
            RButton again = new RButton("Place Order", GREEN, Color.WHITE);
            again.addActionListener(e -> {
                int ok = JOptionPane.showConfirmDialog((Component) e.getSource(),
                        "Re-order the items from " + p[0] + " for " + p[1] + "?", "Place Order",
                        JOptionPane.OK_CANCEL_OPTION);
                if (ok == JOptionPane.OK_OPTION) {
                    JOptionPane.showMessageDialog((Component) e.getSource(), "Order placed (" + p[1] + ").");
                }
            });
            body.add(row(new JComponent[]{lbl(p[0]), again, lbl(p[1])},
                    new int[]{0, 130, 64}, A_PAST, 38, true));
        }
        c.add(body, BorderLayout.CENTER);
        return c;
    }
 
    private JComponent shopCard() {
        Card c = new Card("Shop");
        JPanel body = vbox();
        int n = SHOP_ITEMS.length;
        Field[] fields = new Field[n];
        JLabel[] costs = new JLabel[n];
        JLabel total = lbl("$0");
        total.setFont(f(Font.PLAIN, 13));
 
        Runnable recalc = () -> {
            double sum = 0;
            for (int i = 0; i < n; i++) {
                double cost = parseInt(fields[i].getText()) * SHOP_UNIT[i];
                costs[i].setText(money(cost));
                sum += cost;
            }
            total.setText(money(sum));
        };
        DocumentListener dl = new DocumentListener() {
            public void insertUpdate(DocumentEvent e) { recalc.run(); }
            public void removeUpdate(DocumentEvent e) { recalc.run(); }
            public void changedUpdate(DocumentEvent e) { recalc.run(); }
        };
 
        body.add(row(new JComponent[]{lbl("Item", GRAY_TXT), lbl("Order count:", GRAY_TXT), lbl("Cost:", GRAY_TXT)},
                new int[]{0, 100, 70}, new int[]{GridBagConstraints.WEST, GridBagConstraints.CENTER, GridBagConstraints.EAST},
                34, true));
        for (int i = 0; i < n; i++) {
            fields[i] = new Field("Amount", 4);
            fields[i].setHorizontalAlignment(JTextField.CENTER);
            fields[i].setPreferredSize(new Dimension(70, 28));
            if (SHOP_PRESET[i] > 0) fields[i].setText(String.valueOf(SHOP_PRESET[i]));
            fields[i].getDocument().addDocumentListener(dl);
            costs[i] = lbl("$0");
            body.add(row(new JComponent[]{lbl(SHOP_ITEMS[i]), fields[i], costs[i]},
                    new int[]{0, 100, 70}, new int[]{GridBagConstraints.WEST, GridBagConstraints.CENTER, GridBagConstraints.EAST},
                    38, true));
        }
 
        RButton place = new RButton("Place Order", GREEN, Color.WHITE);
        place.addActionListener(e -> {
            if (total.getText().equals("$0")) {
                JOptionPane.showMessageDialog(place, "Enter an amount for at least one item.",
                        "Nothing to order", JOptionPane.WARNING_MESSAGE);
                return;
            }
            int ok = JOptionPane.showConfirmDialog(place, "Place this order for " + total.getText() + "?",
                    "Place Order", JOptionPane.OK_CANCEL_OPTION);
            if (ok == JOptionPane.OK_OPTION) {
                for (Field fl : fields) fl.setText("");
                JOptionPane.showMessageDialog(place, "Order placed.");
            }
        });
        body.add(row(new JComponent[]{lbl("Total"), place, total},
                new int[]{0, 100, 70}, new int[]{GridBagConstraints.WEST, GridBagConstraints.CENTER, GridBagConstraints.EAST},
                44, false));
        recalc.run();
        c.add(body, BorderLayout.CENTER);
        return c;
    }
 
    private void orderDialog(Component parent, String item) {
        int ok = JOptionPane.showConfirmDialog(parent, "Order 50 units of " + item + "?", "Order 50",
                JOptionPane.OK_CANCEL_OPTION);
        if (ok == JOptionPane.OK_OPTION) {
            JOptionPane.showMessageDialog(parent, "Ordered 50 x " + item + ".");
        }
    }
 
    // ---------- shared view pieces ----------
    private JComponent statRow() {
        JPanel p = new JPanel(new GridLayout(1, 3, 16, 0));
        p.setOpaque(false);
        p.add(statCard("Profits", "$45,678.90", "+20% month over month"));
        p.add(statCard("Expenses", "$2,405", "+33% month over month"));
        p.add(statCard("Customers", "10,353", "-8% month over month"));
        return p;
    }
 
    private JComponent statCard(String title, String value, String sub) {
        Card c = new Card(null);
        JPanel inner = new JPanel();
        inner.setOpaque(false);
        inner.setLayout(new BoxLayout(inner, BoxLayout.Y_AXIS));
        JLabel t = new JLabel(title);
        t.setFont(f(Font.BOLD, 13));
        JLabel v = new JLabel(value);
        v.setFont(f(Font.BOLD, 32));
        JLabel s = new JLabel(sub);
        s.setForeground(GRAY_TXT);
        for (JLabel l : new JLabel[]{t, v, s}) l.setAlignmentX(Component.LEFT_ALIGNMENT);
        inner.add(t);
        inner.add(Box.createVerticalStrut(8));
        inner.add(v);
        inner.add(Box.createVerticalStrut(8));
        inner.add(s);
        c.add(inner, BorderLayout.CENTER);
        return c;
    }
 
    private JComponent trendSelector(String[] opts) {
        JPanel p = new JPanel();
        p.setOpaque(false);
        p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
        JLabel l = new JLabel("View past trends:");
        l.setFont(f(Font.BOLD, 12));
        l.setBorder(new EmptyBorder(0, 4, 3, 0));
        l.setAlignmentX(Component.LEFT_ALIGNMENT);
        JComponent seg = leftWrap(segmented(opts, 0, null));
        seg.setAlignmentX(Component.LEFT_ALIGNMENT);
        p.add(l);
        p.add(seg);
        return leftWrap(p);
    }
 
    private JComponent employeeList() {
        String[] names = {"Helena", "Oscar", "Daniel", "Daniel Jay Park", "Mark Rojas"};
        JPanel p = vbox();
        for (String n : names) {
            JPanel r = new JPanel(new BorderLayout(12, 0));
            r.setOpaque(false);
            r.setBorder(new EmptyBorder(6, 0, 6, 0));
            r.add(new Avatar(n, 38), BorderLayout.WEST);
            JPanel t = new JPanel();
            t.setOpaque(false);
            t.setLayout(new BoxLayout(t, BoxLayout.Y_AXIS));
            JLabel name = new JLabel(n);
            JLabel mail = new JLabel("email@example.com");
            mail.setForeground(new Color(70, 70, 70));
            t.add(name);
            t.add(mail);
            r.add(t, BorderLayout.CENTER);
            p.add(r);
        }
        return p;
    }
 
    // ---------- tasks card (employee view) ----------
    static class TasksCard extends Card {
        private final JPanel list = new JPanel();
        private final Field search = new Field("Search tasks...", 24);
        private String priority = "All";
 
        TasksCard() {
            super("Current tasks");
            JPanel body = new JPanel(new BorderLayout(0, 12));
            body.setOpaque(false);
 
            JPanel toolbar = new JPanel(new BorderLayout());
            toolbar.setOpaque(false);
            JPanel leftTools = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
            leftTools.setOpaque(false);
            search.setPreferredSize(new Dimension(300, 34));
            RButton filter = new RButton("Filter", new Color(245, 245, 245), Color.BLACK);
            filter.setPreferredSize(new Dimension(80, 34));
            JPopupMenu menu = new JPopupMenu();
            for (String p : new String[]{"All", "High", "Medium", "Low"}) {
                JMenuItem mi = new JMenuItem(p);
                mi.addActionListener(e -> {
                    priority = p;
                    filter.setText(p.equals("All") ? "Filter" : p);
                    refresh();
                });
                menu.add(mi);
            }
            filter.addActionListener(e -> menu.show(filter, 0, filter.getHeight()));
            leftTools.add(search);
            leftTools.add(filter);
            toolbar.add(leftTools, BorderLayout.WEST);
            toolbar.add(segmented(new String[]{"List", "Grid", "Calendar"}, 0, null), BorderLayout.EAST);
            body.add(toolbar, BorderLayout.NORTH);
 
            list.setLayout(new BoxLayout(list, BoxLayout.Y_AXIS));
            list.setOpaque(false);
            JScrollPane sp = new JScrollPane(list);
            sp.setBorder(null);
            sp.setOpaque(false);
            sp.getViewport().setOpaque(false);
            sp.getVerticalScrollBar().setUnitIncrement(16);
            sp.setPreferredSize(new Dimension(100, 400));
            body.add(sp, BorderLayout.CENTER);
            add(body, BorderLayout.CENTER);
 
            search.getDocument().addDocumentListener(new DocumentListener() {
                public void insertUpdate(DocumentEvent e) { refresh(); }
                public void removeUpdate(DocumentEvent e) { refresh(); }
                public void changedUpdate(DocumentEvent e) { refresh(); }
            });
            refresh();
        }
 
        private static final int[] W = {90, 0, 150, 100, 80, 44, 30};
        private static final int[] A = {GridBagConstraints.WEST, GridBagConstraints.WEST, GridBagConstraints.WEST,
                GridBagConstraints.WEST, GridBagConstraints.WEST, GridBagConstraints.CENTER, GridBagConstraints.CENTER};
 
        private void refresh() {
            list.removeAll();
            JLabel[] heads = {lbl("ID"), lbl("Employee"), lbl("Task"), lbl("Priority"), lbl("Date"), lbl(""), lbl("")};
            list.add(row(heads, W, A, 38, true));
            String q = search.getText().trim().toLowerCase();
            for (String[] r : TASKS) {
                boolean textOk = q.isEmpty() || String.join(" ", r).toLowerCase().contains(q);
                boolean prioOk = priority.equals("All") || r[3].equals(priority);
                if (!textOk || !prioOk) continue;
                JLabel dots = lbl("\u2022\u2022\u2022", GRAY_TXT);
                list.add(row(new JComponent[]{lbl(r[0], GRAY_TXT), lbl(r[1]), new Pill(r[2]), new Pill(r[3]),
                        lbl(r[4], GRAY_TXT), new Avatar(r[1], 24), dots}, W, A, 44, true));
            }
            list.add(Box.createVerticalGlue());
            list.revalidate();
            list.repaint();
        }
    }
 
    // ---------- layout helpers ----------
    static JPanel vbox() {
        JPanel p = new JPanel();
        p.setOpaque(false);
        p.setLayout(new BoxLayout(p, BoxLayout.Y_AXIS));
        return p;
    }
 
    static Component gap(int h) {
        return Box.createVerticalStrut(h);
    }
 
    static JPanel leftWrap(JComponent c) {
        JPanel p = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        p.setOpaque(false);
        p.add(c);
        return p;
    }
 
    static JPanel top(JComponent c) {
        JPanel p = new JPanel(new BorderLayout());
        p.setOpaque(false);
        p.add(c, BorderLayout.NORTH);
        return p;
    }
 
    /** Two side-by-side components sharing the row by weight. */
    static JPanel split(JComponent a, double wa, JComponent b, double wb) {
        a.setPreferredSize(new Dimension(10, a.getPreferredSize().height));
        b.setPreferredSize(new Dimension(10, b.getPreferredSize().height));
        JPanel p = new JPanel(new GridBagLayout());
        p.setOpaque(false);
        GridBagConstraints c = new GridBagConstraints();
        c.fill = GridBagConstraints.BOTH;
        c.weighty = 1;
        c.gridx = 0;
        c.weightx = wa;
        c.insets = new Insets(0, 0, 0, 8);
        p.add(a, c);
        c.gridx = 1;
        c.weightx = wb;
        c.insets = new Insets(0, 8, 0, 0);
        p.add(b, c);
        return p;
    }
 
    /** One table row. A width of 0 means "flexible column". */
    static JPanel row(JComponent[] cs, int[] ws, int[] anchors, int h, boolean line) {
        JPanel r = new JPanel(new GridBagLayout());
        r.setOpaque(false);
        if (line) r.setBorder(new MatteBorder(0, 0, 1, 0, GRID));
        for (int i = 0; i < cs.length; i++) {
            JPanel cell = new JPanel(new GridBagLayout());
            cell.setOpaque(false);
            cell.add(cs[i], new GridBagConstraints(0, 0, 1, 1, 1, 1, anchors[i], GridBagConstraints.NONE,
                    new Insets(0, 6, 0, 6), 0, 0));
            Dimension cd = new Dimension(ws[i] == 0 ? 60 : ws[i], h);
            cell.setPreferredSize(cd);
            if (ws[i] != 0) {
                cell.setMinimumSize(cd);
                cell.setMaximumSize(cd);
            }
            GridBagConstraints c = new GridBagConstraints();
            c.gridx = i;
            c.weightx = ws[i] == 0 ? 1 : 0;
            c.fill = GridBagConstraints.BOTH;
            r.add(cell, c);
        }
        r.setMaximumSize(new Dimension(Integer.MAX_VALUE, h));
        return r;
    }
 
    static final int[] A_REFILL = {GridBagConstraints.WEST, GridBagConstraints.CENTER, GridBagConstraints.CENTER,
            GridBagConstraints.CENTER, GridBagConstraints.CENTER};
    static final int[] A_STOCK = {GridBagConstraints.WEST, GridBagConstraints.EAST, GridBagConstraints.EAST,
            GridBagConstraints.EAST};
    static final int[] A_PAST = {GridBagConstraints.WEST, GridBagConstraints.CENTER, GridBagConstraints.EAST};
 
    static JLabel lbl(String t) {
        return lbl(t, Color.BLACK);
    }
 
    static JLabel lbl(String t, Color c) {
        JLabel l = new JLabel(t);
        l.setFont(f(Font.PLAIN, 13));
        l.setForeground(c);
        return l;
    }
 
    static JLabel colored(String remaining) {
        int r = parseInt(remaining);
        return lbl(remaining, r == 0 ? RED : r < 50 ? OLIVE : OK);
    }
 
    static int parseInt(String s) {
        try {
            return Math.max(0, Integer.parseInt(s.trim()));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
 
    static String money(double d) {
        return String.format("$%,.0f", d);
    }
 
    static String dollars(Double d) {
        return String.format("$%,.0f", d);
    }
 
    static String plain(Double d) {
        return String.format("%,.0f", d);
    }
 
    static JComponent scroller(JPanel view) {
        ScrollPanel sp = new ScrollPanel(new BorderLayout());
        sp.setBackground(BG);
        sp.setBorder(new EmptyBorder(8, 28, 28, 28));
        sp.add(view, BorderLayout.NORTH);
        JScrollPane scroll = new JScrollPane(sp);
        scroll.setBorder(null);
        scroll.getVerticalScrollBar().setUnitIncrement(16);
        return scroll;
    }
 
    static JComponent segmented(String[] opts, int sel, Consumer<String> onSelect) {
        RoundPanel p = new RoundPanel(new Color(242, 242, 242), 10);
        p.setLayout(new FlowLayout(FlowLayout.LEFT, 2, 2));
        ButtonGroup g = new ButtonGroup();
        for (int i = 0; i < opts.length; i++) {
            SegButton b = new SegButton(opts[i]);
            b.setSelected(i == sel);
            g.add(b);
            p.add(b);
            String o = opts[i];
            b.addActionListener(e -> {
                if (onSelect != null) onSelect.accept(o);
            });
        }
        return p;
    }
 
    // ---------- custom components ----------
    static class ScrollPanel extends JPanel implements Scrollable {
        ScrollPanel(LayoutManager lm) { super(lm); }
        public Dimension getPreferredScrollableViewportSize() { return getPreferredSize(); }
        public int getScrollableUnitIncrement(Rectangle r, int o, int d) { return 16; }
        public int getScrollableBlockIncrement(Rectangle r, int o, int d) { return 100; }
        public boolean getScrollableTracksViewportWidth() { return true; }
        public boolean getScrollableTracksViewportHeight() { return false; }
    }
 
    static class Card extends JPanel {
        Card(String title) {
            setLayout(new BorderLayout(0, 10));
            setOpaque(false);
            setBorder(new EmptyBorder(16, 18, 16, 18));
            if (title != null) {
                JLabel t = new JLabel(title);
                t.setFont(f(Font.BOLD, 13));
                add(t, BorderLayout.NORTH);
            }
        }
 
        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(Color.WHITE);
            g2.fillRoundRect(0, 0, getWidth() - 1, getHeight() - 1, 10, 10);
            g2.setColor(new Color(225, 225, 225));
            g2.drawRoundRect(0, 0, getWidth() - 1, getHeight() - 1, 10, 10);
            g2.dispose();
            super.paintComponent(g);
        }
    }
 
    static class RoundPanel extends JPanel {
        private final Color fill;
        private final int arc;
 
        RoundPanel(Color fill, int arc) {
            this.fill = fill;
            this.arc = arc;
            setOpaque(false);
        }
 
        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(fill);
            g2.fillRoundRect(0, 0, getWidth(), getHeight(), arc, arc);
            g2.dispose();
            super.paintComponent(g);
        }
    }
 
    static class RButton extends JButton {
        private final Color bg;
        private boolean hover;
 
        RButton(String text, Color bg, Color fg) {
            super(text);
            this.bg = bg;
            setForeground(fg);
            setFont(f(Font.PLAIN, 13));
            setContentAreaFilled(false);
            setBorderPainted(false);
            setFocusPainted(false);
            setOpaque(false);
            setMargin(new Insets(6, 14, 6, 14));
            setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            addMouseListener(new MouseAdapter() {
                @Override public void mouseEntered(MouseEvent e) { hover = true; repaint(); }
                @Override public void mouseExited(MouseEvent e) { hover = false; repaint(); }
            });
        }
 
        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(hover ? bg.brighter() : bg);
            g2.fillRoundRect(0, 0, getWidth(), getHeight(), 8, 8);
            g2.dispose();
            super.paintComponent(g);
        }
    }
 
    static class SegButton extends JToggleButton {
        SegButton(String t) {
            super(t);
            setFont(f(Font.PLAIN, 13));
            setForeground(Color.BLACK);
            setContentAreaFilled(false);
            setFocusPainted(false);
            setBorder(new EmptyBorder(5, 11, 5, 11));
            setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        }
 
        @Override
        protected void paintComponent(Graphics g) {
            if (isSelected()) {
                Graphics2D g2 = (Graphics2D) g.create();
                g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                g2.setColor(Color.WHITE);
                g2.fillRoundRect(0, 0, getWidth() - 1, getHeight() - 1, 8, 8);
                g2.setColor(new Color(225, 225, 225));
                g2.drawRoundRect(0, 0, getWidth() - 1, getHeight() - 1, 8, 8);
                g2.dispose();
            }
            super.paintComponent(g);
        }
    }
 
    static class Pill extends JLabel {
        Pill(String t) {
            super(t, SwingConstants.CENTER);
            setFont(f(Font.BOLD, 11));
            setBorder(new EmptyBorder(3, 9, 3, 9));
        }
 
        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(Color.WHITE);
            g2.fillRoundRect(0, 0, getWidth() - 1, getHeight() - 1, 10, 10);
            g2.setColor(new Color(215, 215, 215));
            g2.drawRoundRect(0, 0, getWidth() - 1, getHeight() - 1, 10, 10);
            g2.dispose();
            super.paintComponent(g);
        }
    }
 
    static class Avatar extends JComponent {
        private static final Color[] PALETTE = {new Color(90, 70, 50), new Color(50, 70, 90), new Color(110, 90, 130),
                new Color(60, 110, 90), new Color(130, 80, 80), new Color(80, 80, 80)};
        private final String initials;
        private final Color color;
        private final int size;
 
        Avatar(String name, int size) {
            this.size = size;
            StringBuilder sb = new StringBuilder();
            for (String part : name.trim().split("\\s+")) {
                if (!part.isEmpty() && sb.length() < 2) sb.append(Character.toUpperCase(part.charAt(0)));
            }
            this.initials = sb.toString();
            this.color = PALETTE[Math.abs(name.hashCode()) % PALETTE.length];
            Dimension d = new Dimension(size, size);
            setPreferredSize(d);
            setMinimumSize(d);
            setMaximumSize(d);
        }
 
        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(color);
            g2.fillOval(0, 0, size - 1, size - 1);
            g2.setColor(Color.WHITE);
            g2.setFont(f(Font.BOLD, Math.max(9, size / 3)));
            FontMetrics fm = g2.getFontMetrics();
            g2.drawString(initials, (size - fm.stringWidth(initials)) / 2, (size - fm.getHeight()) / 2 + fm.getAscent());
            g2.dispose();
        }
    }
 
    /** Text field with a grey hint that shows while empty and unfocused. */
    static class Field extends JTextField {
        private final String hint;
 
        Field(String hint, int cols) {
            super(cols);
            this.hint = hint;
            setFont(f(Font.PLAIN, 13));
            setBorder(new CompoundBorder(new LineBorder(new Color(215, 215, 215), 1, true), new EmptyBorder(4, 10, 4, 10)));
        }
 
        @Override
        protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            if (getText().isEmpty() && !isFocusOwner()) {
                Graphics2D g2 = (Graphics2D) g.create();
                g2.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
                g2.setColor(GRAY_TXT);
                g2.setFont(getFont());
                FontMetrics fm = g2.getFontMetrics();
                int x = getHorizontalAlignment() == CENTER ? (getWidth() - fm.stringWidth(hint)) / 2 : getInsets().left;
                g2.drawString(hint, x, (getHeight() - fm.getHeight()) / 2 + fm.getAscent());
                g2.dispose();
            }
        }
    }
 
    // ---------- charts ----------
    static final int PAD_L = 56, PAD_R = 22, PAD_T = 10, PAD_B = 26;
 
    static void drawGrid(Graphics2D g2, int w, int h, double yMin, double yMax, double gridStart, double step,
                         Function<Double, String> fmt) {
        g2.setFont(f(Font.PLAIN, 10));
        g2.setColor(GRID);
        g2.drawLine(PAD_L, PAD_T + h, PAD_L + w, PAD_T + h);
        for (double v = gridStart; v <= yMax + 1e-9; v += step) {
            int y = PAD_T + (int) Math.round((yMax - v) / (yMax - yMin) * h);
            g2.setColor(GRID);
            g2.drawLine(PAD_L, y, PAD_L + w, y);
            g2.setColor(GRAY_TXT);
            g2.drawString(fmt.apply(v), 0, y + 4);
        }
    }
 
    static void drawCentered(Graphics2D g2, String s, int cx, int y, int minX, int maxX) {
        int sw = g2.getFontMetrics().stringWidth(s);
        int x = Math.max(minX, Math.min(cx - sw / 2, maxX - sw));
        g2.drawString(s, x, y);
    }
 
    static class LineChart extends JPanel {
        private final double[] data;
        private final String[] xLabels;
        private final double yMin, yMax, gridStart, step;
        private final Function<Double, String> fmt;
 
        LineChart(double[] data, String[] xLabels, double yMin, double yMax, double gridStart, double step,
                  Function<Double, String> fmt) {
            this.data = data;
            this.xLabels = xLabels;
            this.yMin = yMin;
            this.yMax = yMax;
            this.gridStart = gridStart;
            this.step = step;
            this.fmt = fmt;
            setOpaque(false);
            setPreferredSize(new Dimension(380, 270));
        }
 
        @Override
        protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            int w = getWidth() - PAD_L - PAD_R;
            int h = getHeight() - PAD_T - PAD_B;
            drawGrid(g2, w, h, yMin, yMax, gridStart, step, fmt);
 
            g2.setColor(GRAY_TXT);
            for (int i = 0; i < xLabels.length; i++) {
                int cx = PAD_L + (int) Math.round(i * w / (double) (xLabels.length - 1));
                drawCentered(g2, xLabels[i], cx, PAD_T + h + 17, 0, getWidth());
            }
 
            Path2D path = new Path2D.Double();
            double lx = 0, ly = 0;
            for (int i = 0; i < data.length; i++) {
                lx = PAD_L + i * w / (double) (data.length - 1);
                ly = PAD_T + (yMax - data[i]) / (yMax - yMin) * h;
                if (i == 0) path.moveTo(lx, ly);
                else path.lineTo(lx, ly);
            }
            g2.setColor(Color.BLACK);
            g2.setStroke(new BasicStroke(2.5f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
            g2.draw(path);
 
            g2.setStroke(new BasicStroke(1f));
            g2.setColor(new Color(0, 0, 0, 25));
            g2.fillOval((int) lx - 12, (int) ly - 12, 24, 24);
            g2.setColor(Color.BLACK);
            g2.fillOval((int) lx - 4, (int) ly - 4, 8, 8);
            g2.dispose();
        }
    }
 
    static class BarChart extends JPanel {
        private final String[] labels;
        private final double[] vals;
        private final double yMin, yMax, gridStart, step;
        private final Function<Double, String> fmt;
 
        BarChart(String[] labels, double[] vals, double yMin, double yMax, double gridStart, double step,
                 Function<Double, String> fmt) {
            this.labels = labels;
            this.vals = vals;
            this.yMin = yMin;
            this.yMax = yMax;
            this.gridStart = gridStart;
            this.step = step;
            this.fmt = fmt;
            setOpaque(false);
            setPreferredSize(new Dimension(380, 270));
        }
 
        @Override
        protected void paintComponent(Graphics g) {
            super.paintComponent(g);
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            int w = getWidth() - PAD_L - PAD_R;
            int h = getHeight() - PAD_T - PAD_B;
            drawGrid(g2, w, h, yMin, yMax, gridStart, step, fmt);
 
            int n = vals.length;
            double slot = w / (double) n;
            double bw = slot * 0.62;
            for (int i = 0; i < n; i++) {
                double x = PAD_L + slot * i + (slot - bw) / 2;
                double bh = (vals[i] - yMin) / (yMax - yMin) * h;
                g2.setColor(Color.BLACK);
                g2.fill(new Rectangle2D.Double(x, PAD_T + h - bh, bw, bh));
                g2.setColor(GRAY_TXT);
                drawCentered(g2, labels[i], (int) (PAD_L + slot * i + slot / 2), PAD_T + h + 17, 0, getWidth());
            }
            g2.dispose();
        }
    }
 
    // ---------- entry point ----------
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> new ManagementSystem().setVisible(true));
    }
}

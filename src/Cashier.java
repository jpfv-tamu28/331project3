import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.event.DocumentEvent;
import javax.swing.event.DocumentListener;
import javax.swing.table.DefaultTableModel;
import java.awt.*;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.sql.*;
import java.text.DecimalFormat;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class Cashier extends JPanel {

    // --- State Variables ---
    private final Connection dbConnection;
    private List<MenuItem> fullMenuList = new ArrayList<>();
    private List<MenuItem> toppingsList = new ArrayList<>();
    private List<OrderItem> currentOrderItems = new ArrayList<>();
    private double currentDiscountRate = 0.0;
    private final int currentEmployeeId;
    private final String currentEmployeeName;

    // --- UI Components ---
    private JPanel menuGridPanel;
    private JPanel categoryPanel;
    private JPanel orderListPanel;
    private JTextField searchField;
    private JLabel lblSubtotalVal, lblTaxVal, lblDiscountVal, lblTotalVal, lblAmountDueVal;
    private JTextField txtDiscountCode;
    private JRadioButton rbCard, rbCash, rbGiftCard;

    private String selectedCategory = "All";

    private static final String EXTRA_SWEET = "200%";
    private static final int MAX_TOPPING_COUNT = 5;

    private static final DecimalFormat CURRENCY = new DecimalFormat("$#,##0.00");

    // "Quiet" palette: warm neutrals with a single tea-brown accent.
    private static final Color BG = new Color(0xFAF9F7);
    private static final Color NAV_BG = new Color(0xF6F5F3);
    private static final Color SURFACE = Color.WHITE;
    private static final Color HOVER = new Color(0xF1EFEC);
    private static final Color LINE = new Color(0xE9E6E1);
    private static final Color LINE_STRONG = new Color(0xCFC9C1);
    private static final Color TEXT = new Color(0x1F1D1B);
    private static final Color SUBTLE = new Color(0x5C5751);
    private static final Color MUTED = new Color(0x8A847C);
    private static final Color ACCENT = new Color(0x8B5E3C);

    public Cashier(Connection dbConnection, int employeeId, String employeeName) {
        this.dbConnection = dbConnection;
        this.currentEmployeeId = employeeId;
        this.currentEmployeeName = employeeName;

        loadMenuDataFromDB();
        initUI();
    }

    private void initUI() {
        setLayout(new BorderLayout());
        add(createLeftNavPanel(), BorderLayout.WEST);
        add(createCenterPanel(), BorderLayout.CENTER);
        add(createRightPanel(), BorderLayout.EAST);
        refreshOrderReceiptPanel();
    }

    private static Font font(int style, int size) {
        return new Font("SansSerif", style, size);
    }

    private JPanel createLeftNavPanel() {
        JPanel nav = new JPanel();
        nav.setLayout(new BoxLayout(nav, BoxLayout.Y_AXIS));
        nav.setPreferredSize(new Dimension(180, 0));
        nav.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 0, 0, 1, LINE),
                new EmptyBorder(20, 12, 20, 12)
        ));
        nav.setBackground(NAV_BG);

        JLabel brand = new JLabel("Boba Bops");
        brand.setFont(font(Font.BOLD, 16));
        brand.setForeground(TEXT);
        brand.setBorder(new EmptyBorder(0, 10, 18, 0));
        brand.setAlignmentX(Component.LEFT_ALIGNMENT);

        JButton btnNewOrder = createNavButton("New Order", true);
        JButton btnPending = createNavButton("Pending Orders", false);
        JButton btnHistory = createNavButton("Order History", false);
        JButton btnSettings = createNavButton("Settings", false);

        btnHistory.addActionListener(e -> openOrderHistoryDialog());
        btnNewOrder.addActionListener(e -> {
            if (!currentOrderItems.isEmpty()) {
                if (Alerts.confirm(this, "Start a new order?",
                        "The items in the current order will be cleared.", "Clear Order")) {
                    currentOrderItems.clear();
                    currentDiscountRate = 0.0;
                    refreshOrderReceiptPanel();
                }
            }
        });
        btnPending.addActionListener(e -> {
            Alerts.info(this, "Pending Orders", "All completed orders are recorded. See Order History for status.");
        });
        btnSettings.addActionListener(e -> {
            Alerts.info(this, "Settings", "Boba Bops POS System v1.0\nCashier: " + currentEmployeeName + " (#" + currentEmployeeId + ")");
        });

        nav.add(brand);
        nav.add(btnNewOrder);
        nav.add(Box.createRigidArea(new Dimension(0, 4)));
        nav.add(btnPending);
        nav.add(Box.createRigidArea(new Dimension(0, 4)));
        nav.add(btnHistory);
        nav.add(Box.createRigidArea(new Dimension(0, 4)));
        nav.add(btnSettings);

        return nav;
    }

    private JButton createNavButton(String text, boolean active) {
        FlatButton btn = active
                ? new FlatButton(text, SURFACE, SURFACE, HOVER, 8)
                : new FlatButton(text, null, HOVER, LINE, 8);
        if (active) {
            btn.outline = LINE;
        }
        btn.setFont(font(active ? Font.BOLD : Font.PLAIN, 13));
        btn.setForeground(active ? TEXT : SUBTLE);
        btn.setHorizontalAlignment(SwingConstants.LEFT);
        btn.setBorder(new EmptyBorder(0, 10, 0, 10));
        btn.setMaximumSize(new Dimension(Integer.MAX_VALUE, 38));
        btn.setAlignmentX(Component.LEFT_ALIGNMENT);
        return btn;
    }

    private JPanel createCenterPanel() {
        JPanel center = new JPanel(new BorderLayout());
        center.setBorder(new EmptyBorder(20, 24, 0, 24));
        center.setBackground(BG);

        searchField = new RoundTextField("Search drinks");
        searchField.setFont(font(Font.PLAIN, 14));
        searchField.setPreferredSize(new Dimension(0, 40));
        searchField.setMaximumSize(new Dimension(Integer.MAX_VALUE, 40));
        searchField.setAlignmentX(Component.LEFT_ALIGNMENT);
        searchField.getDocument().addDocumentListener(new DocumentListener() {
            @Override public void insertUpdate(DocumentEvent e) { applyFilters(); }
            @Override public void removeUpdate(DocumentEvent e) { applyFilters(); }
            @Override public void changedUpdate(DocumentEvent e) { applyFilters(); }
        });

        categoryPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        categoryPanel.setOpaque(false);
        categoryPanel.setBorder(BorderFactory.createMatteBorder(0, 0, 1, 0, LINE));
        categoryPanel.setAlignmentX(Component.LEFT_ALIGNMENT);
        renderCategoryButtons();

        JPanel topHeader = new JPanel();
        topHeader.setLayout(new BoxLayout(topHeader, BoxLayout.Y_AXIS));
        topHeader.setOpaque(false);
        topHeader.add(searchField);
        topHeader.add(Box.createRigidArea(new Dimension(0, 10)));
        topHeader.add(categoryPanel);
        center.add(topHeader, BorderLayout.NORTH);

        menuGridPanel = new JPanel(new GridLayout(0, 4, 14, 14));
        menuGridPanel.setOpaque(false);

        // Pinned to the top so a short filtered list keeps normal-sized cards instead of stretching to fill.
        JPanel gridHolder = new JPanel(new BorderLayout());
        gridHolder.setBackground(BG);
        gridHolder.setBorder(new EmptyBorder(18, 0, 24, 0));
        gridHolder.add(menuGridPanel, BorderLayout.NORTH);

        JScrollPane scrollGrid = new JScrollPane(gridHolder,
                JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED, JScrollPane.HORIZONTAL_SCROLLBAR_NEVER);
        scrollGrid.setBorder(null);
        scrollGrid.getViewport().setBackground(BG);
        scrollGrid.getVerticalScrollBar().setUnitIncrement(12);
        center.add(scrollGrid, BorderLayout.CENTER);

        applyFilters();

        return center;
    }

    // Categories come from the menu itself so manager-added ones (e.g. Seasonal) get a tab too.
    private void renderCategoryButtons() {
        categoryPanel.removeAll();
        Set<String> categories = new LinkedHashSet<>();
        categories.add("All");
        for (MenuItem item : fullMenuList) {
            if (!"topping".equalsIgnoreCase(item.itemType)) {
                categories.add(item.category);
            }
        }
        for (String cat : categories) {
            boolean selected = cat.equals(selectedCategory);
            JButton tab = new JButton(cat);
            tab.setContentAreaFilled(false);
            tab.setFocusPainted(false);
            tab.setRolloverEnabled(true);
            tab.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            tab.setFont(font(selected ? Font.BOLD : Font.PLAIN, 13));
            tab.setForeground(selected ? TEXT : MUTED);
            tab.setBorder(BorderFactory.createCompoundBorder(
                    new EmptyBorder(0, 0, 0, 22),
                    BorderFactory.createCompoundBorder(
                            BorderFactory.createMatteBorder(0, 0, 2, 0, selected ? ACCENT : BG),
                            new EmptyBorder(10, 0, 10, 0))));
            if (!selected) {
                tab.getModel().addChangeListener(e -> tab.setForeground(tab.getModel().isRollover() ? TEXT : MUTED));
            }
            tab.addActionListener(e -> {
                selectedCategory = cat;
                renderCategoryButtons();
                applyFilters();
            });
            categoryPanel.add(tab);
        }
        categoryPanel.revalidate();
        categoryPanel.repaint();
    }

    // Reloads the menu so items added or edited in the manager view show up without logging out.
    public void refreshMenu() {
        fullMenuList.clear();
        toppingsList.clear();
        loadMenuDataFromDB();
        selectedCategory = "All";
        renderCategoryButtons();
        searchField.setText("");
        applyFilters();
    }

    private void renderMenuGrid(List<MenuItem> itemsToDisplay) {
        menuGridPanel.removeAll();

        for (MenuItem item : itemsToDisplay) {
            // Skip toppings in the main drink grid
            if ("topping".equalsIgnoreCase(item.itemType)) continue;

            FlatButton card = new FlatButton(null, SURFACE, SURFACE, HOVER, 12);
            card.outline = LINE;
            card.hoverOutline = LINE_STRONG;
            card.setLayout(new BorderLayout());
            card.setBorder(new EmptyBorder(14, 16, 14, 16));
            card.setPreferredSize(new Dimension(120, 104));
            card.addActionListener(e -> openCustomizationDialog(item));

            // In CENTER the label gets the card's full height, so long names wrap onto a second line.
            JLabel lblName = new JLabel("<html><b>" + DenseList.html(item.name) + "</b><br>"
                    + "<font size='2' color='#8a847c'>" + DenseList.html(item.category) + "</font></html>");
            lblName.setFont(font(Font.PLAIN, 14));
            lblName.setForeground(TEXT);
            lblName.setVerticalAlignment(SwingConstants.TOP);

            JLabel lblPrice = new JLabel(CURRENCY.format(item.priceCents / 100.0));
            lblPrice.setFont(font(Font.BOLD, 14));
            lblPrice.setForeground(ACCENT);

            card.add(lblName, BorderLayout.CENTER);
            card.add(lblPrice, BorderLayout.SOUTH);
            menuGridPanel.add(card);
        }

        if (menuGridPanel.getComponentCount() == 0) {
            JLabel none = new JLabel("No drinks found");
            none.setForeground(MUTED);
            menuGridPanel.add(none);
        }

        menuGridPanel.revalidate();
        menuGridPanel.repaint();
    }

    private JPanel createRightPanel() {
        JPanel right = new JPanel(new BorderLayout());
        right.setPreferredSize(new Dimension(340, 0));
        right.setBorder(BorderFactory.createMatteBorder(0, 1, 0, 0, LINE));
        right.setBackground(SURFACE);

        JPanel header = new JPanel(new GridLayout(2, 1, 0, 3));
        header.setOpaque(false);
        header.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 0, 1, 0, LINE),
                new EmptyBorder(18, 20, 14, 20)));
        JLabel lblTitle = new JLabel("Current Order");
        lblTitle.setFont(font(Font.BOLD, 16));
        lblTitle.setForeground(TEXT);
        JLabel lblUser = new JLabel("Cashier: " + currentEmployeeName + " (#" + currentEmployeeId + ")");
        lblUser.setFont(font(Font.PLAIN, 12));
        lblUser.setForeground(MUTED);
        header.add(lblTitle);
        header.add(lblUser);
        right.add(header, BorderLayout.NORTH);

        orderListPanel = new JPanel();
        orderListPanel.setLayout(new BoxLayout(orderListPanel, BoxLayout.Y_AXIS));
        orderListPanel.setBackground(SURFACE);
        orderListPanel.setBorder(new EmptyBorder(4, 12, 4, 12));

        JScrollPane scrollOrder = new JScrollPane(orderListPanel,
                JScrollPane.VERTICAL_SCROLLBAR_AS_NEEDED, JScrollPane.HORIZONTAL_SCROLLBAR_NEVER);
        scrollOrder.setBorder(BorderFactory.createEmptyBorder());

        JPanel bottomContainer = new JPanel();
        bottomContainer.setLayout(new BoxLayout(bottomContainer, BoxLayout.Y_AXIS));
        bottomContainer.setOpaque(false);
        bottomContainer.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(1, 0, 0, 0, LINE),
                new EmptyBorder(14, 20, 20, 20)));

        JPanel totalsPanel = new JPanel(new GridLayout(4, 2, 0, 6));
        totalsPanel.setOpaque(false);
        lblSubtotalVal = addTotalRow(totalsPanel, "Subtotal", "$0.00");
        lblTaxVal = addTotalRow(totalsPanel, "Taxes (8.25%)", "$0.00");
        lblDiscountVal = addTotalRow(totalsPanel, "Discounts", "-$0.00");
        lblTotalVal = addTotalRow(totalsPanel, "Total", "$0.00");
        for (Component c : new Component[]{totalsPanel.getComponent(6), lblTotalVal}) {
            c.setFont(font(Font.BOLD, 18));
            c.setForeground(TEXT);
        }

        JPanel radioGroupPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        radioGroupPanel.setOpaque(false);
        rbCard = new JRadioButton("Card", true);
        rbCash = new JRadioButton("Cash");
        rbGiftCard = new JRadioButton("GiftCard");
        ButtonGroup bgPayment = new ButtonGroup();
        for (JRadioButton rb : new JRadioButton[]{rbCard, rbCash, rbGiftCard}) {
            rb.setOpaque(false);
            rb.setFocusPainted(false);
            rb.setFont(font(Font.PLAIN, 13));
            rb.setForeground(TEXT);
            rb.setBorder(new EmptyBorder(0, 0, 0, 14));
            bgPayment.add(rb);
            radioGroupPanel.add(rb);
        }

        JPanel discountRow = new JPanel(new BorderLayout(8, 0));
        discountRow.setOpaque(false);
        JLabel lblDiscount = new JLabel("Discount code");
        lblDiscount.setFont(font(Font.PLAIN, 13));
        lblDiscount.setForeground(SUBTLE);
        txtDiscountCode = new RoundTextField(null);
        txtDiscountCode.setColumns(7);
        txtDiscountCode.setFont(font(Font.PLAIN, 13));
        FlatButton btnApply = new FlatButton("Apply", HOVER, LINE, LINE_STRONG, 8);
        btnApply.setFont(font(Font.BOLD, 13));
        btnApply.setForeground(TEXT);
        btnApply.setBorder(new EmptyBorder(6, 14, 6, 14));
        btnApply.addActionListener(e -> applyDiscountCode());
        JPanel discountInput = new JPanel(new BorderLayout(6, 0));
        discountInput.setOpaque(false);
        discountInput.add(txtDiscountCode, BorderLayout.CENTER);
        discountInput.add(btnApply, BorderLayout.EAST);
        discountRow.add(lblDiscount, BorderLayout.WEST);
        discountRow.add(discountInput, BorderLayout.EAST);

        JPanel dueRow = new JPanel(new BorderLayout());
        dueRow.setOpaque(false);
        JLabel lblDue = new JLabel("Amount due");
        lblDue.setFont(font(Font.PLAIN, 13));
        lblDue.setForeground(SUBTLE);
        lblAmountDueVal = new JLabel("$0.00", SwingConstants.RIGHT);
        lblAmountDueVal.setFont(font(Font.BOLD, 13));
        lblAmountDueVal.setForeground(TEXT);
        dueRow.add(lblDue, BorderLayout.WEST);
        dueRow.add(lblAmountDueVal, BorderLayout.EAST);

        FlatButton btnFinish = new FlatButton("Finish Payment", TEXT, new Color(0x3A3632), Color.BLACK, 10);
        btnFinish.setFont(font(Font.BOLD, 15));
        btnFinish.setForeground(Color.WHITE);
        btnFinish.setBorder(new EmptyBorder(14, 0, 14, 0));
        btnFinish.addActionListener(e -> processFinishPayment());

        for (JComponent c : new JComponent[]{totalsPanel, radioGroupPanel, discountRow, dueRow, btnFinish}) {
            c.setAlignmentX(Component.LEFT_ALIGNMENT);
        }
        btnFinish.setMaximumSize(new Dimension(Integer.MAX_VALUE, 48));
        for (JComponent c : new JComponent[]{radioGroupPanel, discountRow, dueRow}) {
            c.setMaximumSize(new Dimension(Integer.MAX_VALUE, c.getPreferredSize().height));
        }

        bottomContainer.add(totalsPanel);
        bottomContainer.add(Box.createRigidArea(new Dimension(0, 16)));
        bottomContainer.add(radioGroupPanel);
        bottomContainer.add(Box.createRigidArea(new Dimension(0, 10)));
        bottomContainer.add(discountRow);
        bottomContainer.add(Box.createRigidArea(new Dimension(0, 12)));
        bottomContainer.add(dueRow);
        bottomContainer.add(Box.createRigidArea(new Dimension(0, 12)));
        bottomContainer.add(btnFinish);

        right.add(scrollOrder, BorderLayout.CENTER);
        right.add(bottomContainer, BorderLayout.SOUTH);

        return right;
    }

    private JLabel addTotalRow(JPanel panel, String label, String value) {
        JLabel lbl = new JLabel(label);
        lbl.setFont(font(Font.PLAIN, 13));
        lbl.setForeground(SUBTLE);
        JLabel val = new JLabel(value, SwingConstants.RIGHT);
        val.setFont(font(Font.PLAIN, 13));
        val.setForeground(SUBTLE);
        panel.add(lbl);
        panel.add(val);
        return val;
    }

    private void openCustomizationDialog(MenuItem item) {
        openCustomizationDialog(item, -1);
    }

    // editIndex is the order line being changed, or -1 to add a new line.
    private void openCustomizationDialog(MenuItem item, int editIndex) {
        OrderItem existing = editIndex >= 0 ? currentOrderItems.get(editIndex) : null;
        String[] sizes = {"Small", "Medium", "Large"};
        String initialSize = "Medium";
        if (existing != null) {
            for (String option : sizes) {
                if (option.startsWith(existing.size)) {
                    initialSize = option;
                }
            }
        }
        DenseList.Segmented size = new DenseList.Segmented(sizes, initialSize);
        DenseList.Segmented ice = new DenseList.Segmented(new String[]{"0%", "50%", "100%"},
                existing != null ? existing.iceLevel : "100%");
        DenseList.Segmented sugar = new DenseList.Segmented(new String[]{"0%", "50%", "100%"},
                existing != null ? existing.sugarLevel : "100%");

        // 200% is a rare request, so it sits as a quiet link under the regular sugar levels.
        boolean[] extraSweet = {existing != null && EXTRA_SWEET.equals(existing.sugarLevel)};
        FlatButton btnExtraSweet = new FlatButton(null, null, HOVER, LINE, 6);
        btnExtraSweet.setFont(font(Font.PLAIN, 12));
        btnExtraSweet.setBorder(new EmptyBorder(4, 6, 4, 6));
        Runnable showExtraSweet = () -> {
            btnExtraSweet.setText(extraSweet[0] ? "\u2713 Extra sweet (200%)" : "+ Extra sweet (200%)");
            btnExtraSweet.setForeground(extraSweet[0] ? TEXT : MUTED);
            btnExtraSweet.setFont(font(extraSweet[0] ? Font.BOLD : Font.PLAIN, 12));
        };
        btnExtraSweet.addActionListener(e -> {
            extraSweet[0] = !extraSweet[0];
            sugar.select(extraSweet[0] ? null : "100%");
            showExtraSweet.run();
        });
        sugar.onPick(option -> {
            extraSweet[0] = false;
            showExtraSweet.run();
        });
        showExtraSweet.run();
        JPanel extraRow = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        extraRow.setOpaque(false);
        extraRow.add(btnExtraSweet);
        JPanel sugarControls = new JPanel(new BorderLayout(0, 4));
        sugarControls.setOpaque(false);
        sugarControls.add(sugar, BorderLayout.CENTER);
        sugarControls.add(extraRow, BorderLayout.SOUTH);

        JLabel lblTotal = new JLabel();
        lblTotal.setFont(font(Font.BOLD, 15));
        lblTotal.setForeground(TEXT);
        // Each add-on keeps its own count, so a drink can take e.g. two scoops of boba.
        Map<MenuItem, Integer> toppingCounts = new LinkedHashMap<>();
        int[] qty = {existing != null ? existing.quantity : 1};
        Runnable updateTotal = () -> {
            int cents = item.priceCents;
            for (Map.Entry<MenuItem, Integer> t : toppingCounts.entrySet()) {
                cents += t.getKey().priceCents * t.getValue();
            }
            lblTotal.setText(CURRENCY.format(cents * qty[0] / 100.0));
        };

        JPanel addOns = new JPanel(new GridLayout(0, 1, 0, 0));
        addOns.setOpaque(false);
        for (MenuItem topping : toppingsList) {
            // Matched by ID; an add-on removed from the menu since then simply starts at zero.
            int start = existing == null ? 0
                    : (int) existing.selectedToppings.stream().filter(t -> t.id == topping.id).count();
            toppingCounts.put(topping, start);

            JLabel lblName = new JLabel(topping.name);
            lblName.setForeground(TEXT);
            JLabel lblPrice = new JLabel("+" + CURRENCY.format(topping.priceCents / 100.0));
            lblPrice.setFont(font(Font.PLAIN, 12));
            lblPrice.setForeground(MUTED);
            JLabel lblCount = new JLabel("", SwingConstants.CENTER);
            lblCount.setPreferredSize(new Dimension(26, 26));
            Runnable showCount = () -> {
                int n = toppingCounts.get(topping);
                lblCount.setText(String.valueOf(n));
                lblCount.setFont(font(n > 0 ? Font.BOLD : Font.PLAIN, 13));
                lblCount.setForeground(n > 0 ? TEXT : MUTED);
                lblName.setFont(font(n > 0 ? Font.BOLD : Font.PLAIN, 13));
            };
            JButton btnLess = stepperButton("\u2212", 28, 26);
            JButton btnMore = stepperButton("+", 28, 26);
            btnLess.addActionListener(e -> {
                toppingCounts.put(topping, Math.max(0, toppingCounts.get(topping) - 1));
                showCount.run();
                updateTotal.run();
            });
            btnMore.addActionListener(e -> {
                toppingCounts.put(topping, Math.min(MAX_TOPPING_COUNT, toppingCounts.get(topping) + 1));
                showCount.run();
                updateTotal.run();
            });
            showCount.run();

            JPanel label = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 0));
            label.setOpaque(false);
            label.add(lblName);
            label.add(lblPrice);
            JPanel counter = new JPanel(new FlowLayout(FlowLayout.RIGHT, 2, 0));
            counter.setOpaque(false);
            counter.add(btnLess);
            counter.add(lblCount);
            counter.add(btnMore);

            JPanel row = new JPanel(new BorderLayout());
            row.setOpaque(false);
            row.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createMatteBorder(0, 0, 1, 0, LINE), new EmptyBorder(5, 0, 5, 0)));
            row.add(label, BorderLayout.CENTER);
            row.add(counter, BorderLayout.EAST);
            addOns.add(row);
        }

        JLabel lblQty = new JLabel(String.valueOf(qty[0]), SwingConstants.CENTER);
        lblQty.setFont(font(Font.BOLD, 15));
        lblQty.setForeground(TEXT);
        lblQty.setPreferredSize(new Dimension(36, 32));
        JButton btnMinus = stepperButton("\u2212");
        JButton btnPlus = stepperButton("+");
        btnMinus.addActionListener(e -> {
            qty[0] = Math.max(1, qty[0] - 1);
            lblQty.setText(String.valueOf(qty[0]));
            updateTotal.run();
        });
        btnPlus.addActionListener(e -> {
            qty[0] = Math.min(99, qty[0] + 1);
            lblQty.setText(String.valueOf(qty[0]));
            updateTotal.run();
        });
        JPanel stepper = new JPanel(new FlowLayout(FlowLayout.LEFT, 4, 0));
        stepper.setOpaque(false);
        stepper.add(btnMinus);
        stepper.add(lblQty);
        stepper.add(btnPlus);

        JPanel qtyRow = new JPanel(new BorderLayout());
        qtyRow.setOpaque(false);
        qtyRow.add(stepper, BorderLayout.WEST);
        qtyRow.add(lblTotal, BorderLayout.EAST);

        JLabel lblBase = new JLabel(item.category + " \u00b7 " + CURRENCY.format(item.priceCents / 100.0));
        lblBase.setFont(font(Font.PLAIN, 13));
        lblBase.setForeground(MUTED);

        JPanel form = new JPanel();
        form.setLayout(new BoxLayout(form, BoxLayout.Y_AXIS));
        form.add(lblBase);
        form.add(Box.createRigidArea(new Dimension(0, 14)));
        addOption(form, "Size", size);
        addOption(form, "Ice Level", ice);
        addOption(form, "Sugar Level", sugarControls);
        if (!toppingsList.isEmpty()) {
            addOption(form, "Add-Ons", addOns);
        }
        addOption(form, "Quantity", qtyRow);
        for (Component c : form.getComponents()) {
            ((JComponent) c).setAlignmentX(Component.LEFT_ALIGNMENT);
        }
        // Wide enough for the longest add-on, "Tapioca Pearls (Boba) +$0.75", in two columns.
        form.setPreferredSize(new Dimension(440, form.getPreferredSize().height));
        updateTotal.run();

        if (!Alerts.form(this, item.name, form, existing != null ? "Save Changes" : "Add to Order")) {
            return;
        }
        String sizeCode = size.selected().substring(0, 1);
        List<MenuItem> chosenToppings = new ArrayList<>();
        toppingCounts.forEach((topping, n) -> {
            for (int i = 0; i < n; i++) {
                chosenToppings.add(topping);
            }
        });
        OrderItem line = new OrderItem(item, sizeCode, ice.selected(),
                extraSweet[0] ? EXTRA_SWEET : sugar.selected(), chosenToppings, qty[0]);
        if (existing != null) {
            currentOrderItems.set(editIndex, line);
        } else {
            currentOrderItems.add(line);
        }
        refreshOrderReceiptPanel();
    }

    private static void addOption(JPanel form, String label, JComponent control) {
        form.add(sectionLabel(label));
        form.add(Box.createRigidArea(new Dimension(0, 6)));
        form.add(control);
        form.add(Box.createRigidArea(new Dimension(0, 14)));
    }

    private static JButton stepperButton(String glyph) {
        return stepperButton(glyph, 34, 32);
    }

    private static JButton stepperButton(String glyph, int width, int height) {
        FlatButton btn = new FlatButton(glyph, HOVER, LINE, LINE_STRONG, 8);
        btn.setFont(font(Font.PLAIN, height > 28 ? 16 : 14));
        btn.setForeground(TEXT);
        btn.setBorder(new EmptyBorder(0, 0, 0, 0));
        btn.setPreferredSize(new Dimension(width, height));
        return btn;
    }

    private static JLabel sectionLabel(String text) {
        JLabel lbl = new JLabel(text);
        lbl.setFont(font(Font.BOLD, 12));
        lbl.setForeground(SUBTLE);
        return lbl;
    }

    // ==========================================
    // ORDER HISTORY DIALOG
    // ==========================================
    private void openOrderHistoryDialog() {
        JDialog dialog = new JDialog(SwingUtilities.getWindowAncestor(this), "Order History", Dialog.ModalityType.APPLICATION_MODAL);
        dialog.setSize(900, 600);
        dialog.setLocationRelativeTo(this);
        dialog.getContentPane().setBackground(SURFACE);
        dialog.setLayout(new BorderLayout());

        JLabel lblTitle = new JLabel("Order History");
        lblTitle.setFont(font(Font.BOLD, 20));
        lblTitle.setForeground(TEXT);
        JButton btnRefresh = Manager.secondaryButton("Refresh");
        JPanel headerPanel = new JPanel(new BorderLayout());
        headerPanel.setBackground(SURFACE);
        headerPanel.setBorder(new EmptyBorder(16, 20, 14, 20));
        headerPanel.add(lblTitle, BorderLayout.WEST);
        headerPanel.add(btnRefresh, BorderLayout.EAST);

        DefaultTableModel ordersModel = new DefaultTableModel(
                new String[]{"Order ID", "Date / Time", "Cashier", "Status", "Total"}, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }

            // Lets the row sorter compare IDs and totals as numbers instead of text.
            @Override
            public Class<?> getColumnClass(int column) {
                return column == 0 ? Integer.class : column == 4 ? Double.class : String.class;
            }
        };
        JTable ordersTable = new JTable(ordersModel);
        ordersTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        ordersTable.setAutoCreateRowSorter(true);

        DefaultTableModel itemsModel = new DefaultTableModel(
                new String[]{"Item / Customization", "Qty", "Unit Price", "Total"}, 0) {
            @Override
            public boolean isCellEditable(int row, int column) {
                return false;
            }
        };
        JTable itemsTable = new JTable(itemsModel);
        JPanel itemsBar = DenseList.sectionBar("Items in selected order", "Select an order above");
        JLabel itemsNote = (JLabel) itemsBar.getComponent(1);

        Runnable loadOrders = () -> {
            ordersModel.setRowCount(0);
            itemsModel.setRowCount(0);
            if (dbConnection == null) {
                Alerts.warning(dialog, "No database connection", "Order history needs a database connection.");
                return;
            }
            String sql = "SELECT o.order_id, o.created_at, COALESCE(e.name, 'Employee #' || o.employee_id) AS cashier_name, o.status, o.total_cents " +
                         "FROM orders o " +
                         "LEFT JOIN employees e ON o.employee_id = e.employee_id " +
                         "ORDER BY o.created_at DESC LIMIT 100";
            try (Statement stmt = dbConnection.createStatement(); ResultSet rs = stmt.executeQuery(sql)) {
                while (rs.next()) {
                    int orderId = rs.getInt("order_id");
                    Timestamp ts = rs.getTimestamp("created_at");
                    String dateStr = ts != null ? ts.toLocalDateTime().withNano(0).toString().replace('T', ' ') : "N/A";
                    String cashierName = rs.getString("cashier_name");
                    String status = rs.getString("status");
                    int totalCents = rs.getInt("total_cents");
                    ordersModel.addRow(new Object[]{
                            orderId,
                            dateStr,
                            cashierName,
                            status == null || status.isEmpty() ? "" : Character.toUpperCase(status.charAt(0)) + status.substring(1),
                            totalCents / 100.0
                    });
                }
            } catch (SQLException ex) {
                ex.printStackTrace();
                Alerts.error(dialog, "Couldn't load orders", ex.getMessage());
            }
        };

        ordersTable.getSelectionModel().addListSelectionListener(e -> {
            if (e.getValueIsAdjusting()) return;
            int selectedRow = ordersTable.getSelectedRow();
            itemsModel.setRowCount(0);
            itemsNote.setText("Select an order above");
            if (selectedRow == -1 || dbConnection == null) return;
            int modelRow = ordersTable.convertRowIndexToModel(selectedRow);
            int orderId = (Integer) ordersModel.getValueAt(modelRow, 0);
            itemsNote.setText("Order #" + orderId);
            String sql = "SELECT item_name_snapshot, quantity, unit_price_cents FROM order_items WHERE order_id = ? ORDER BY order_item_id";
            try (PreparedStatement pstmt = dbConnection.prepareStatement(sql)) {
                pstmt.setInt(1, orderId);
                try (ResultSet rs = pstmt.executeQuery()) {
                    while (rs.next()) {
                        String itemName = rs.getString("item_name_snapshot");
                        int qty = rs.getInt("quantity");
                        int unitCents = rs.getInt("unit_price_cents");
                        itemsModel.addRow(new Object[]{
                                itemName,
                                qty,
                                unitCents / 100.0,
                                (unitCents * qty) / 100.0
                        });
                    }
                }
            } catch (SQLException ex) {
                ex.printStackTrace();
            }
        });

        btnRefresh.addActionListener(e -> loadOrders.run());

        JPanel topOrdersPanel = new JPanel(new BorderLayout());
        topOrdersPanel.add(DenseList.sectionBar("Orders", "Last 100 \u00b7 select one to see its items"), BorderLayout.NORTH);
        topOrdersPanel.add(DenseList.styledTable(ordersTable, column -> column == 4, column -> column == 0), BorderLayout.CENTER);

        JPanel bottomItemsPanel = new JPanel(new BorderLayout());
        bottomItemsPanel.add(itemsBar, BorderLayout.NORTH);
        bottomItemsPanel.add(DenseList.styledTable(itemsTable, column -> column >= 2), BorderLayout.CENTER);

        JSplitPane splitPane = new JSplitPane(JSplitPane.VERTICAL_SPLIT, topOrdersPanel, bottomItemsPanel);
        splitPane.setResizeWeight(0.55);
        splitPane.setBorder(BorderFactory.createMatteBorder(1, 0, 1, 0, LINE));
        splitPane.setDividerSize(6);

        JButton btnClose = Manager.secondaryButton("Close");
        btnClose.addActionListener(e -> dialog.dispose());
        JPanel footerPanel = new JPanel(new FlowLayout(FlowLayout.RIGHT, 0, 0));
        footerPanel.setBackground(SURFACE);
        footerPanel.setBorder(new EmptyBorder(12, 20, 12, 20));
        footerPanel.add(btnClose);

        dialog.add(headerPanel, BorderLayout.NORTH);
        dialog.add(splitPane, BorderLayout.CENTER);
        dialog.add(footerPanel, BorderLayout.SOUTH);

        loadOrders.run();
        dialog.setVisible(true);
    }

    private void refreshOrderReceiptPanel() {
        orderListPanel.removeAll();

        double subtotal = 0.0;

        if (currentOrderItems.isEmpty()) {
            JLabel empty = new JLabel("Tap a drink to add it");
            empty.setFont(font(Font.PLAIN, 13));
            empty.setForeground(MUTED);
            empty.setBorder(new EmptyBorder(40, 0, 0, 0));
            empty.setAlignmentX(Component.CENTER_ALIGNMENT);
            orderListPanel.add(empty);
        }

        for (int i = 0; i < currentOrderItems.size(); i++) {
            OrderItem item = currentOrderItems.get(i);
            subtotal += item.getTotalPrice();

            JPanel row = new JPanel(new BorderLayout(8, 0));
            row.setOpaque(false);
            row.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createMatteBorder(0, 0, i < currentOrderItems.size() - 1 ? 1 : 0, 0, LINE),
                    new EmptyBorder(10, 8, 10, 4)));

            // A fixed HTML width makes long topping lists wrap instead of widening the panel.
            JLabel lblInfo = new JLabel("<html><div style='width:150px'><b>" + DenseList.html(item.menuItem.name) + " (" + item.size + ")"
                    + (item.quantity > 1 ? " \u00d7" + item.quantity : "") + "</b><br>"
                    + "<font color='#8a847c'>" + DenseList.html(item.getCustomizationSummary()) + "</font></div></html>");
            lblInfo.setFont(font(Font.PLAIN, 12));
            lblInfo.setForeground(TEXT);

            JPanel rightActions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 2, 0));
            rightActions.setOpaque(false);

            JLabel lblPrice = new JLabel(CURRENCY.format(item.getTotalPrice()));
            lblPrice.setFont(font(Font.PLAIN, 13));
            lblPrice.setForeground(TEXT);
            lblPrice.setBorder(new EmptyBorder(0, 0, 0, 4));
            JButton btnEdit = createRowIconButton("\u270F");
            JButton btnDelete = createRowIconButton("\u2715");

            final int index = i;
            btnDelete.addActionListener(e -> {
                currentOrderItems.remove(index);
                refreshOrderReceiptPanel();
            });
            btnEdit.setToolTipText("Edit this drink");
            btnEdit.addActionListener(e -> openCustomizationDialog(item.menuItem, index));
            // Tapping anywhere on the line edits it too; the buttons handle their own clicks.
            row.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
            row.addMouseListener(new java.awt.event.MouseAdapter() {
                @Override
                public void mouseClicked(java.awt.event.MouseEvent e) {
                    openCustomizationDialog(item.menuItem, index);
                }
            });

            rightActions.add(lblPrice);
            rightActions.add(btnEdit);
            rightActions.add(btnDelete);

            row.add(lblInfo, BorderLayout.CENTER);
            row.add(rightActions, BorderLayout.EAST);
            row.setAlignmentX(Component.CENTER_ALIGNMENT);
            row.setMaximumSize(new Dimension(Integer.MAX_VALUE, row.getPreferredSize().height));

            orderListPanel.add(row);
        }

        double tax = subtotal * 0.0825; // 8.25% sales tax
        double discount = subtotal * currentDiscountRate;
        double total = Math.max(0.0, subtotal + tax - discount);

        lblSubtotalVal.setText(CURRENCY.format(subtotal));
        lblTaxVal.setText(CURRENCY.format(tax));
        lblDiscountVal.setText("-" + CURRENCY.format(discount));
        lblTotalVal.setText(CURRENCY.format(total));
        lblAmountDueVal.setText(CURRENCY.format(total));

        orderListPanel.revalidate();
        orderListPanel.repaint();
    }

    private JButton createRowIconButton(String glyph) {
        FlatButton btn = new FlatButton(glyph, null, HOVER, LINE, 6);
        btn.setFont(font(Font.PLAIN, 12));
        btn.setForeground(MUTED);
        btn.setBorder(new EmptyBorder(4, 6, 4, 6));
        return btn;
    }

    private void applyDiscountCode() {
        String code = txtDiscountCode.getText().trim();
        if ("ILOVEMYVETS".equalsIgnoreCase(code)) {
            currentDiscountRate = 0.10;
            Alerts.success(this, "Discount applied", "Veteran discount: 10% off this order.");
        } else {
            currentDiscountRate = 0.0;
            if (!code.isEmpty()) {
                Alerts.error(this, "Invalid code", "\"" + code + "\" is not a valid discount code.");
            }
        }
        refreshOrderReceiptPanel();
    }

    private void processFinishPayment() {
        if (currentOrderItems.isEmpty()) {
            Alerts.warning(this, "Order is empty", "Add at least one drink before finishing payment.");
            return;
        }

        if (dbConnection == null) {
            Alerts.success(this, "Order completed", "Offline mode: the order was not saved to the database.");
            currentOrderItems.clear();
            currentDiscountRate = 0.0;
            refreshOrderReceiptPanel();
            return;
        }

        try {
            dbConnection.setAutoCommit(false); // Begin Transaction

            // 1. Get next order_id
            int newOrderId = 1;
            try (Statement stmt = dbConnection.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT COALESCE(MAX(order_id), 0) + 1 FROM orders")) {
                if (rs.next()) newOrderId = rs.getInt(1);
            }

            // Calculate totals in cents
            double subtotal = 0.0;
            for (OrderItem oi : currentOrderItems) subtotal += oi.getTotalPrice();
            double tax = subtotal * 0.0825;
            double totalDollars = Math.max(0, subtotal + tax - subtotal * currentDiscountRate);
            int totalCents = (int) Math.round(totalDollars * 100);

            // 2. Insert into orders table
            String insertOrderSql = "INSERT INTO orders (order_id, employee_id, status, created_at, total_cents) VALUES (?, ?, ?, ?, ?)";
            try (PreparedStatement pstmt = dbConnection.prepareStatement(insertOrderSql)) {
                pstmt.setInt(1, newOrderId);
                pstmt.setInt(2, currentEmployeeId);
                pstmt.setString(3, "closed");
                pstmt.setTimestamp(4, Timestamp.valueOf(LocalDateTime.now()));
                pstmt.setInt(5, totalCents);
                pstmt.executeUpdate();
            }

            // 3. Insert into order_items table
            String insertOrderItemSql = "INSERT INTO order_items (order_id, menu_item_id, parent_order_item_id, item_name_snapshot, quantity, unit_price_cents) VALUES (?, ?, ?, ?, ?, ?) RETURNING order_item_id";
            
            for (OrderItem oi : currentOrderItems) {
                int parentItemId;
                try (PreparedStatement pstmt = dbConnection.prepareStatement(insertOrderItemSql)) {
                    pstmt.setInt(1, newOrderId);
                    pstmt.setInt(2, oi.menuItem.id);
                    pstmt.setNull(3, Types.INTEGER); // NULL for parent drink
                    pstmt.setString(4, oi.menuItem.name + " (" + oi.size + ", " + oi.iceLevel + " ice, " + oi.sugarLevel + " sugar)");
                    pstmt.setInt(5, oi.quantity);
                    pstmt.setInt(6, oi.menuItem.priceCents);
                    
                    ResultSet rsKey = pstmt.executeQuery();
                    rsKey.next();
                    parentItemId = rsKey.getInt(1);
                }

                // One row per topping, with repeats folded into its quantity (2 scoops on 3 drinks = 6).
                for (Map.Entry<MenuItem, Integer> entry : oi.toppingCounts()) {
                    MenuItem topping = entry.getKey();
                    try (PreparedStatement pstmtTop = dbConnection.prepareStatement(insertOrderItemSql)) {
                        pstmtTop.setInt(1, newOrderId);
                        pstmtTop.setInt(2, topping.id);
                        pstmtTop.setInt(3, parentItemId);
                        pstmtTop.setString(4, topping.name);
                        pstmtTop.setInt(5, entry.getValue() * oi.quantity);
                        pstmtTop.setInt(6, topping.priceCents);
                        pstmtTop.executeQuery();
                    }
                }
            }

            dbConnection.commit(); // Commit Transaction
            dbConnection.setAutoCommit(true);

            Alerts.success(this, "Order #" + newOrderId + " recorded", "The order was saved successfully.");

            // Reset order state
            currentOrderItems.clear();
            currentDiscountRate = 0.0;
            refreshOrderReceiptPanel();

        } catch (SQLException e) {
            try { dbConnection.rollback(); } catch (SQLException ex) { ex.printStackTrace(); }
            e.printStackTrace();
            Alerts.error(this, "Couldn't save the order", e.getMessage());
        } finally {
            // The connection is shared with the manager view, so auto-commit must be restored even on failure.
            try { dbConnection.setAutoCommit(true); } catch (SQLException ex) { ex.printStackTrace(); }
        }
    }

    private void loadMenuDataFromDB() {
        if (dbConnection != null) {
            try (Statement stmt = dbConnection.createStatement();
                 ResultSet rs = stmt.executeQuery("SELECT menu_item_id, name, category, item_type, price_cents FROM menu_items WHERE is_available = TRUE ORDER BY name")) {
                while (rs.next()) {
                    MenuItem m = new MenuItem(
                            rs.getInt("menu_item_id"),
                            rs.getString("name"),
                            rs.getString("category"),
                            rs.getString("item_type"),
                            rs.getInt("price_cents")
                    );
                    fullMenuList.add(m);
                    if ("topping".equalsIgnoreCase(m.itemType)) {
                        toppingsList.add(m);
                    }
                }
                return;
            } catch (SQLException e) {
                System.err.println("Failed to fetch menu items from DB: " + e.getMessage());
            }
        }

        // Fallback Mock Data if DB isn't initialized yet
        fullMenuList.add(new MenuItem(1, "Classic Milk Tea", "Milk Tea", "drink", 500));
        fullMenuList.add(new MenuItem(2, "Taro Milk Tea", "Milk Tea", "drink", 550));
        fullMenuList.add(new MenuItem(3, "Matcha Milk Tea", "Milk Tea", "drink", 600));
        fullMenuList.add(new MenuItem(4, "Thai Tea", "Milk Tea", "drink", 550));
        fullMenuList.add(new MenuItem(5, "Brown Sugar Boba Milk", "Specialty", "drink", 650));
        fullMenuList.add(new MenuItem(6, "Jasmine Green Tea", "Fruit/Clear Tea", "drink", 450));
        fullMenuList.add(new MenuItem(7, "Mango Green Tea", "Fruit/Clear Tea", "drink", 500));
        fullMenuList.add(new MenuItem(8, "Strawberry Slush", "Slush", "drink", 600));
        
        MenuItem boba = new MenuItem(13, "Tapioca Pearls (Boba)", "Topping", "topping", 75);
        MenuItem jelly = new MenuItem(14, "Lychee Jelly", "Topping", "topping", 75);
        toppingsList.add(boba);
        toppingsList.add(jelly);
        fullMenuList.add(boba);
        fullMenuList.add(jelly);
    }

    // Search and the category tab narrow the grid together.
    private void applyFilters() {
        String query = searchField.getText().trim().toLowerCase();
        List<MenuItem> filtered = new ArrayList<>();
        for (MenuItem item : fullMenuList) {
            boolean inCategory = "All".equals(selectedCategory) || selectedCategory.equalsIgnoreCase(item.category);
            boolean matches = item.name.toLowerCase().contains(query) || item.category.toLowerCase().contains(query);
            if (inCategory && matches) {
                filtered.add(item);
            }
        }
        renderMenuGrid(filtered);
    }

    // Stock Swing buttons ignore rounded corners and hover fills, so this paints its own background.
    static class FlatButton extends JButton {
        private final Color fill, hoverFill, pressedFill;
        private final int arc;
        Color outline, hoverOutline;

        FlatButton(String text, Color fill, Color hoverFill, Color pressedFill, int arc) {
            super(text);
            this.fill = fill;
            this.hoverFill = hoverFill;
            this.pressedFill = pressedFill;
            this.arc = arc;
            setContentAreaFilled(false);
            setFocusPainted(false);
            setOpaque(false);
            setRolloverEnabled(true);
            setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        }

        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            ButtonModel model = getModel();
            Color bg = model.isPressed() ? pressedFill : model.isRollover() ? hoverFill : fill;
            if (bg != null) {
                g2.setColor(bg);
                g2.fillRoundRect(0, 0, getWidth() - 1, getHeight() - 1, arc, arc);
            }
            Color line = model.isRollover() && hoverOutline != null ? hoverOutline : outline;
            if (line != null) {
                g2.setColor(line);
                g2.drawRoundRect(0, 0, getWidth() - 1, getHeight() - 1, arc, arc);
            }
            g2.dispose();
            super.paintComponent(g);
        }
    }

    // Rounded text field with an accent outline on focus and optional placeholder text.
    static class RoundTextField extends JTextField {
        private final String placeholder;

        RoundTextField(String placeholder) {
            this.placeholder = placeholder;
            setOpaque(false);
            setForeground(TEXT);
            setCaretColor(TEXT);
            setBorder(new EmptyBorder(6, 12, 6, 12));
            addFocusListener(new FocusAdapter() {
                @Override public void focusGained(FocusEvent e) { repaint(); }
                @Override public void focusLost(FocusEvent e) { repaint(); }
            });
        }

        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(SURFACE);
            g2.fillRoundRect(0, 0, getWidth() - 1, getHeight() - 1, 10, 10);
            g2.setColor(hasFocus() ? ACCENT : LINE);
            g2.drawRoundRect(0, 0, getWidth() - 1, getHeight() - 1, 10, 10);
            if (placeholder != null && getText().isEmpty()) {
                g2.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
                g2.setColor(MUTED);
                g2.setFont(getFont());
                FontMetrics fm = g2.getFontMetrics();
                g2.drawString(placeholder, getInsets().left, (getHeight() + fm.getAscent() - fm.getDescent()) / 2);
            }
            g2.dispose();
            super.paintComponent(g);
        }
    }

    static class MenuItem {
        int id;
        String name;
        String category;
        String itemType;
        int priceCents;

        public MenuItem(int id, String name, String category, String itemType, int priceCents) {
            this.id = id;
            this.name = name;
            this.category = category;
            this.itemType = itemType;
            this.priceCents = priceCents;
        }

        @Override
        public String toString() {
            return name + " (+$" + String.format("%.2f", priceCents / 100.0) + ")";
        }
    }

    static class OrderItem {
        MenuItem menuItem;
        String size;
        String iceLevel;
        String sugarLevel;
        List<MenuItem> selectedToppings;
        int quantity;

        public OrderItem(MenuItem menuItem, String size, String iceLevel, String sugarLevel, List<MenuItem> selectedToppings, int quantity) {
            this.menuItem = menuItem;
            this.size = size;
            this.iceLevel = iceLevel;
            this.sugarLevel = sugarLevel;
            this.selectedToppings = selectedToppings;
            this.quantity = quantity;
        }

        public double getTotalPrice() {
            double basePrice = menuItem.priceCents / 100.0;
            for (MenuItem t : selectedToppings) {
                basePrice += t.priceCents / 100.0;
            }
            return basePrice * quantity;
        }

        // selectedToppings holds one entry per scoop; this groups repeats, in the order first added.
        List<Map.Entry<MenuItem, Integer>> toppingCounts() {
            Map<Integer, Map.Entry<MenuItem, Integer>> byId = new LinkedHashMap<>();
            for (MenuItem t : selectedToppings) {
                byId.merge(t.id, Map.entry(t, 1), (a, b) -> Map.entry(a.getKey(), a.getValue() + 1));
            }
            return new ArrayList<>(byId.values());
        }

        public String getCustomizationSummary() {
            StringBuilder sb = new StringBuilder();
            sb.append("Ice: ").append(iceLevel).append(", Sug: ").append(sugarLevel);
            List<Map.Entry<MenuItem, Integer>> counts = toppingCounts();
            for (int i = 0; i < counts.size(); i++) {
                sb.append(i == 0 ? " + " : ", ").append(counts.get(i).getKey().name);
                if (counts.get(i).getValue() > 1) {
                    sb.append(" \u00d7").append(counts.get(i).getValue());
                }
            }
            return sb.toString();
        }
    }
}
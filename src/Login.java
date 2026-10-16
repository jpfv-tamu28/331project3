import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.text.AbstractDocument;
import javax.swing.text.AttributeSet;
import javax.swing.text.BadLocationException;
import javax.swing.text.DocumentFilter;
import java.awt.*;
import java.sql.*;

public class Login extends JFrame {

    static final int PIN_LENGTH = 6;

    private Connection dbConnection;
    private final JPasswordField pinField = new JPasswordField(PIN_LENGTH);
    private final JLabel lblError = new JLabel(" ", SwingConstants.CENTER);

    public Login() {
        setTitle("Boba Bops - Login");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setSize(360, 560);
        setResizable(false);
        setLocationRelativeTo(null);

        // Runs on every exit path, including EXIT_ON_CLOSE from the main window.
        Runtime.getRuntime().addShutdownHook(new Thread(this::closeConnection));

        initUI();
    }

    private void closeConnection() {
        try {
            if (dbConnection != null && !dbConnection.isClosed()) {
                dbConnection.close();
                System.out.println("[INFO] Database connection closed.");
            }
        } catch (SQLException e) {
            System.err.println("[ERROR] Failed to close database connection: " + e.getMessage());
        }
    }

    private void initUI() {
        JPanel root = new JPanel(new BorderLayout(0, 24));
        root.setBackground(DenseList.SECTION_BG);
        root.setBorder(new EmptyBorder(36, 36, 32, 36));

        JLabel title = new JLabel("Boba Bops", SwingConstants.CENTER);
        title.setFont(DenseList.font(Font.BOLD, 26));
        title.setForeground(DenseList.TEXT);
        JLabel subtitle = new JLabel("Enter your 6-digit PIN", SwingConstants.CENTER);
        subtitle.setFont(DenseList.font(Font.PLAIN, 13));
        subtitle.setForeground(DenseList.SUBTLE);

        // The password field still takes keyboard input; the dots are what people see.
        ((AbstractDocument) pinField.getDocument()).setDocumentFilter(new PinFilter());
        pinField.addActionListener(e -> attemptLogin());
        pinField.setPreferredSize(new Dimension(0, 0));
        pinField.setBorder(null);
        pinField.setOpaque(false);
        PinDots dots = new PinDots();
        pinField.getDocument().addDocumentListener(new javax.swing.event.DocumentListener() {
            @Override public void insertUpdate(javax.swing.event.DocumentEvent e) { typed(); }
            @Override public void removeUpdate(javax.swing.event.DocumentEvent e) { typed(); }
            @Override public void changedUpdate(javax.swing.event.DocumentEvent e) { typed(); }

            private void typed() {
                dots.repaint();
                if (pinField.getPassword().length > 0) {
                    lblError.setText(" ");
                }
            }
        });

        lblError.setFont(DenseList.font(Font.PLAIN, 12));
        lblError.setForeground(new Color(0xB3261E));

        JPanel header = new JPanel(new GridLayout(0, 1, 0, 8));
        header.setOpaque(false);
        header.add(title);
        header.add(subtitle);
        JPanel dotsRow = new JPanel(new FlowLayout(FlowLayout.CENTER, 0, 8));
        dotsRow.setOpaque(false);
        dotsRow.add(dots);
        header.add(dotsRow);
        header.add(lblError);

        JPanel keypad = new JPanel(new GridLayout(4, 3, 10, 10));
        keypad.setOpaque(false);
        for (int i = 1; i <= 9; i++) {
            keypad.add(keypadButton(String.valueOf(i), e -> appendDigit(e.getActionCommand())));
        }
        Cashier.FlatButton btnClear = new Cashier.FlatButton("Clear", null, DenseList.CHIP, DenseList.LINE, 14);
        btnClear.setFont(DenseList.font(Font.PLAIN, 14));
        btnClear.setForeground(DenseList.SUBTLE);
        btnClear.setBorder(new EmptyBorder(0, 0, 0, 0));
        btnClear.addActionListener(e -> {
            pinField.setText("");
            pinField.requestFocusInWindow();
        });
        Cashier.FlatButton btnEnter = new Cashier.FlatButton("Enter", DenseList.TEXT, new Color(0x3A3632), Color.BLACK, 14);
        btnEnter.setFont(DenseList.font(Font.BOLD, 15));
        btnEnter.setForeground(Color.WHITE);
        btnEnter.setBorder(new EmptyBorder(0, 0, 0, 0));
        btnEnter.addActionListener(e -> attemptLogin());
        keypad.add(btnClear);
        keypad.add(keypadButton("0", e -> appendDigit("0")));
        keypad.add(btnEnter);

        root.add(header, BorderLayout.NORTH);
        root.add(keypad, BorderLayout.CENTER);
        root.add(pinField, BorderLayout.SOUTH);
        setContentPane(root);

        // Keeps typing working without a click, including when the window comes back after logout.
        addWindowFocusListener(new java.awt.event.WindowAdapter() {
            @Override
            public void windowGainedFocus(java.awt.event.WindowEvent e) {
                pinField.requestFocusInWindow();
            }
        });
    }

    private JButton keypadButton(String text, java.awt.event.ActionListener action) {
        Cashier.FlatButton btn = new Cashier.FlatButton(text, DenseList.SURFACE, DenseList.ROW_HOVER, DenseList.CHIP, 14);
        btn.outline = DenseList.LINE;
        btn.hoverOutline = new Color(0xCFC9C1);
        btn.setFont(DenseList.font(Font.PLAIN, 20));
        btn.setForeground(DenseList.TEXT);
        // Without a border of our own, the macOS look paints its button bezel over the flat style.
        btn.setBorder(new EmptyBorder(0, 0, 0, 0));
        btn.addActionListener(action);
        return btn;
    }

    // One dot per PIN digit: filled once typed, outlined while empty.
    private class PinDots extends JComponent {
        private static final int SIZE = 14;
        private static final int GAP = 14;

        PinDots() {
            setPreferredSize(new Dimension(PIN_LENGTH * SIZE + (PIN_LENGTH - 1) * GAP + 2, SIZE + 2));
        }

        @Override
        protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            int typed = pinField.getPassword().length;
            for (int i = 0; i < PIN_LENGTH; i++) {
                int x = 1 + i * (SIZE + GAP);
                if (i < typed) {
                    g2.setColor(DenseList.TEXT);
                    g2.fillOval(x, 1, SIZE, SIZE);
                } else {
                    g2.setColor(new Color(0xCFC9C1));
                    g2.setStroke(new BasicStroke(1.5f));
                    g2.drawOval(x, 1, SIZE, SIZE);
                }
            }
            g2.dispose();
        }
    }

    private void appendDigit(String digit) {
        if (pinField.getPassword().length < PIN_LENGTH) {
            pinField.setText(new String(pinField.getPassword()) + digit);
        }
        pinField.requestFocusInWindow();
    }

    private void attemptLogin() {
        String pin = new String(pinField.getPassword());
        if (pin.length() != PIN_LENGTH) {
            lblError.setText("PIN must be 6 digits.");
            return;
        }

        try {
            if (dbConnection == null || dbConnection.isClosed()) {
                dbConnection = Database.connect();
            }

            String sql = "SELECT employee_id, name, role FROM employees WHERE pin = ? AND is_active";
            try (PreparedStatement stmt = dbConnection.prepareStatement(sql)) {
                stmt.setString(1, pin);
                try (ResultSet rs = stmt.executeQuery()) {
                    if (!rs.next()) {
                        lblError.setText("Invalid PIN.");
                        pinField.setText("");
                        return;
                    }
                    int id = rs.getInt("employee_id");
                    String name = rs.getString("name");
                    String role = rs.getString("role");
                    System.out.println("[INFO] " + name + " (" + role + ") logged in.");
                    openMainWindow(id, name, role);
                }
            }
        } catch (SQLException e) {
            System.err.println("[ERROR] Login failed: " + e.getMessage());
            lblError.setText("Could not reach the database.");
            Alerts.error(this, "Couldn't reach the database",
                    "Could not connect to the PostgreSQL database.\nCheck DB_PASSWORD and your network/VPN.");
        }
    }

    private void openMainWindow(int employeeId, String name, String role) {
        boolean isManager = "Manager".equalsIgnoreCase(role);

        JFrame frame = new JFrame("Boba Bops - " + name);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setSize(1280, 800);
        frame.setLocationRelativeTo(null);

        JPanel topBar = new JPanel(new BorderLayout());
        topBar.setBackground(DenseList.SECTION_BG);
        topBar.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createMatteBorder(0, 0, 1, 0, DenseList.LINE),
                new EmptyBorder(8, 16, 8, 16)));
        JLabel signedIn = DenseList.caption("<html>Signed in as <b>" + name + "</b> \u00b7 " + role + "</html>");
        topBar.add(signedIn, BorderLayout.WEST);

        Cashier cashier = new Cashier(dbConnection, employeeId, name);
        Manager manager = new Manager(dbConnection);

        CardLayout cardLayout = new CardLayout();
        JPanel contentCards = new JPanel(cardLayout);
        contentCards.add(cashier, "CASHIER");
        contentCards.add(manager, "MANAGER");

        JButton btnSwitch = Manager.secondaryButton(isManager ? "Switch to Cashier View" : "Switch to Manager View");
        final boolean[] showingCashier = { !isManager };

        if (isManager) {
            cardLayout.show(contentCards, "MANAGER");
            manager.refreshAll();
        } else {
            cardLayout.show(contentCards, "CASHIER");
        }

        btnSwitch.addActionListener(e -> {
            if (showingCashier[0]) {
                // Switching to Manager view requires a valid manager PIN every time.
                if (!promptManagerPin(frame)) return;
                cardLayout.show(contentCards, "MANAGER");
                manager.refreshAll();
                btnSwitch.setText("Switch to Cashier View");
                showingCashier[0] = false;
            } else {
                cashier.refreshMenu();
                cardLayout.show(contentCards, "CASHIER");
                btnSwitch.setText("Switch to Manager View");
                showingCashier[0] = true;
            }
        });

        JButton btnLogout = Manager.secondaryButton("Log Out");
        btnLogout.addActionListener(e -> {
            System.out.println("[INFO] " + name + " logged out.");
            frame.dispose();
            closeConnection();
            pinField.setText("");
            lblError.setText(" ");
            setVisible(true);
        });

        JPanel rightActions = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0));
        rightActions.setOpaque(false);
        rightActions.add(btnSwitch);
        rightActions.add(btnLogout);
        topBar.add(rightActions, BorderLayout.EAST);

        frame.add(topBar, BorderLayout.NORTH);
        frame.add(contentCards, BorderLayout.CENTER);

        setVisible(false);
        frame.setVisible(true);
    }

    // Asks for a PIN and returns true only if it belongs to an active Manager.
    private boolean promptManagerPin(Component parent) {
        while (true) {
            JPasswordField field = new JPasswordField(PIN_LENGTH);
            ((AbstractDocument) field.getDocument()).setDocumentFilter(new PinFilter());
            field.setFont(new Font("SansSerif", Font.BOLD, 20));
            field.setHorizontalAlignment(JTextField.CENTER);

            JPanel panel = new JPanel(new BorderLayout(0, 8));
            panel.add(new JLabel("Enter a manager PIN to open the Manager view."), BorderLayout.NORTH);
            panel.add(field, BorderLayout.CENTER);

            // Enter in the PIN field presses Unlock, since the field has no action listener of its own.
            if (!Alerts.form(parent, "Manager Authorization", panel, "Unlock")) {
                return false;
            }

            String pin = new String(field.getPassword());
            if (pin.length() != PIN_LENGTH) {
                Alerts.warning(parent, "Invalid PIN", "PIN must be 6 digits.");
                continue;
            }

            String sql = "SELECT name FROM employees WHERE pin = ? AND is_active AND role ILIKE 'Manager'";
            try {
                if (dbConnection == null || dbConnection.isClosed()) {
                    dbConnection = Database.connect();
                }
                try (PreparedStatement stmt = dbConnection.prepareStatement(sql)) {
                    stmt.setString(1, pin);
                    try (ResultSet rs = stmt.executeQuery()) {
                        if (rs.next()) {
                            System.out.println("[INFO] Manager view authorized by " + rs.getString("name") + ".");
                            return true;
                        }
                    }
                }
            } catch (SQLException ex) {
                System.err.println("[ERROR] Manager PIN check failed: " + ex.getMessage());
                Alerts.error(parent, "Couldn't reach the database", "The PIN could not be checked. Try again in a moment.");
                return false;
            }

            Alerts.error(parent, "Access denied", "That PIN does not belong to an active manager.");
        }
    }

    // Only lets digits into the PIN field, up to PIN_LENGTH characters.
    private static class PinFilter extends DocumentFilter {
        @Override
        public void insertString(FilterBypass fb, int offset, String text, AttributeSet attr)
                throws BadLocationException {
            replace(fb, offset, 0, text, attr);
        }

        @Override
        public void replace(FilterBypass fb, int offset, int length, String text, AttributeSet attrs)
                throws BadLocationException {
            if (text == null) text = "";
            String digits = text.replaceAll("\\D", "");
            int room = PIN_LENGTH - (fb.getDocument().getLength() - length);
            if (digits.length() > room) digits = digits.substring(0, Math.max(0, room));
            super.replace(fb, offset, length, digits, attrs);
        }
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> new Login().setVisible(true));
    }
}

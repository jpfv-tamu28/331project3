import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.awt.event.FocusAdapter;
import java.awt.event.FocusEvent;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;

public class Auth extends JFrame {

    private static final String PLACEHOLDER = "1234ABC";
    private final JTextField idField = new JTextField(20);

    public Auth() {
        super("Boba Bops Enterprises");
        setDefaultCloseOperation(EXIT_ON_CLOSE);

        JPanel root = new JPanel();
        root.setLayout(new BoxLayout(root, BoxLayout.Y_AXIS));
        root.setBorder(new EmptyBorder(30, 50, 30, 50));
        root.setBackground(Color.WHITE);

        // Title
        JLabel title = new JLabel("BOBA BOPS ENTERPRISES");
        title.setFont(new Font("SansSerif", Font.BOLD, 24));
        title.setAlignmentX(CENTER_ALIGNMENT);

        // Subtitle
        JLabel subtitle = new JLabel("Log in as manager:");
        subtitle.setFont(new Font("SansSerif", Font.PLAIN, 16));
        subtitle.setAlignmentX(CENTER_ALIGNMENT);

        // Field label
        JLabel idLabel = new JLabel("Enter your employee ID");
        idLabel.setFont(new Font("SansSerif", Font.PLAIN, 13));
        idLabel.setAlignmentX(CENTER_ALIGNMENT);

        // ID field with placeholder behavior
        idField.setFont(new Font("SansSerif", Font.PLAIN, 14));
        idField.setHorizontalAlignment(JTextField.CENTER);
        idField.setMaximumSize(new Dimension(260, 32));
        idField.setAlignmentX(CENTER_ALIGNMENT);
        idField.setText(PLACEHOLDER);
        idField.setForeground(Color.GRAY);
        idField.addFocusListener(new FocusAdapter() {
            @Override public void focusGained(FocusEvent e) {
                if (idField.getText().equals(PLACEHOLDER)) {
                    idField.setText("");
                    idField.setForeground(Color.BLACK);
                }
            }
            @Override public void focusLost(FocusEvent e) {
                if (idField.getText().trim().isEmpty()) {
                    idField.setText(PLACEHOLDER);
                    idField.setForeground(Color.GRAY);
                }
            }
        });

        // Access button
        JButton accessButton = new JButton("Access management system");
        accessButton.setFont(new Font("SansSerif", Font.BOLD, 14));
        accessButton.setAlignmentX(CENTER_ALIGNMENT);
        accessButton.addActionListener(e -> handleLogin());
        getRootPane().setDefaultButton(accessButton);

        // Footer: terms / privacy
        JPanel footer = new JPanel(new FlowLayout(FlowLayout.CENTER, 3, 0));
        footer.setBackground(Color.WHITE);
        footer.add(small("By gaining access, you agree to our"));
        footer.add(link("Terms of Service"));
        footer.add(small("and"));
        footer.add(link("Privacy Policy"));
        footer.setAlignmentX(CENTER_ALIGNMENT);

        root.add(title);
        root.add(Box.createVerticalStrut(20));
        root.add(subtitle);
        root.add(Box.createVerticalStrut(20));
        root.add(idLabel);
        root.add(Box.createVerticalStrut(6));
        root.add(idField);
        root.add(Box.createVerticalStrut(20));
        root.add(accessButton);
        root.add(Box.createVerticalStrut(25));
        root.add(footer);

        setContentPane(root);
        pack();
        setMinimumSize(new Dimension(520, getHeight()));
        setLocationRelativeTo(null);
    }

    private void handleLogin() {
        String id = idField.getText().trim();
        if (id.isEmpty() || id.equals(PLACEHOLDER)) {
            Alerts.warning(this, "Missing ID", "Please enter your employee ID.");
            return;
        }
        // TODO: replace with real authentication
        new ManagementSystem().setVisible(true);
        dispose();
    }

    private JLabel small(String text) {
        JLabel l = new JLabel(text);
        l.setFont(new Font("SansSerif", Font.PLAIN, 11));
        l.setForeground(Color.DARK_GRAY);
        return l;
    }

    private JLabel link(String text) {
        JLabel l = new JLabel("<html><u>" + text + "</u></html>");
        l.setFont(new Font("SansSerif", Font.PLAIN, 11));
        l.setForeground(new Color(0, 90, 200));
        l.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        l.addMouseListener(new MouseAdapter() {
            @Override public void mouseClicked(MouseEvent e) {
                Alerts.info(Auth.this, text, "This feature is a placeholder.");
            }
        });
        return l;
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> new Auth().setVisible(true));
    }
}

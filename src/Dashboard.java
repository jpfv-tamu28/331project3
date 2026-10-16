import javax.swing.*;
import java.awt.*;

public class Dashboard extends JFrame {

    static class CardPanel extends JPanel {
        CardPanel(LayoutManager lm) {
            super(lm);
            setOpaque(false);
            setBorder(BorderFactory.createEmptyBorder(16, 18, 16, 18));
        }
        @Override protected void paintComponent(Graphics g) {
            Graphics2D g2 = (Graphics2D) g.create();
            g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2.setColor(Color.WHITE);
            g2.fillRoundRect(0, 0, getWidth(), getHeight(), 12, 12);
            g2.dispose();
            super.paintComponent(g);
        }
    }

    static CardPanel statCard(String title, String value, String delta) {
        CardPanel c = new CardPanel(new GridLayout(3, 1));
        JLabel v = new JLabel(value);
        v.setFont(v.getFont().deriveFont(Font.BOLD, 32f));
        c.add(new JLabel(title));
        c.add(v);
        c.add(new JLabel(delta));
        return c;
    }

    public Dashboard() {
        super("Boba Bops Management System");
        setDefaultCloseOperation(EXIT_ON_CLOSE);
        setLayout(new BorderLayout());

        // Top bar
        JPanel top = new JPanel(new BorderLayout());
        top.add(new JLabel("BOBA BOPS MANAGEMENT SYSTEM - DASHBOARD AND QUICK ACTIONS"), BorderLayout.WEST);
        JPanel topBtns = new JPanel(new FlowLayout(FlowLayout.RIGHT));
        topBtns.add(new JButton("Dashboard"));
        topBtns.add(new JButton("Log out"));
        top.add(topBtns, BorderLayout.EAST);
        add(top, BorderLayout.NORTH);

        // Body
        JPanel body = new JPanel(new GridBagLayout());
        body.setBackground(new Color(0xCCCCCC));
        body.setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));
        GridBagConstraints gc = new GridBagConstraints();
        gc.fill = GridBagConstraints.BOTH;
        gc.insets = new Insets(6, 6, 6, 6);
        gc.weightx = 1;

        // Row 0: quick actions
        JPanel actions = new JPanel(new FlowLayout(FlowLayout.LEFT));
        actions.setOpaque(false);
        for (String s : new String[]{"View Trends", "View Employees", "View Inventory", "Cashier View"})
            actions.add(new JButton(s));
        gc.gridx = 0; gc.gridy = 0; gc.gridwidth = 2; gc.weighty = 0;
        body.add(actions, gc);

        // Row 1: stat cards
        JPanel stats = new JPanel(new GridLayout(1, 3, 12, 0));
        stats.setOpaque(false);
        stats.add(statCard("Profits", "$45,678.90", "+20% month over month"));
        stats.add(statCard("Expenses", "$2,405", "+33% month over month"));
        stats.add(statCard("Customers", "10,353", "-8% month over month"));
        gc.gridy = 1;
        body.add(stats, gc);

        // Row 2: line chart (60%) + employees (40%)
        gc.gridy = 2; gc.gridwidth = 1; gc.weighty = 1; gc.weightx = 0.6;
        body.add(new CardPanel(new BorderLayout()), gc);   // put ChartPanel here
        gc.gridx = 1; gc.weightx = 0.4;
        body.add(new CardPanel(new BorderLayout()), gc);   // employee list here

        // Row 3: inventory + bar chart
        gc.gridx = 0; gc.gridy = 3; gc.weightx = 0.5;
        body.add(new CardPanel(new BorderLayout()), gc);   // inventory rows here
        gc.gridx = 1;
        body.add(new CardPanel(new BorderLayout()), gc);   // bar chart here

        add(new JScrollPane(body), BorderLayout.CENTER);
        setSize(1150, 1050);
        setLocationRelativeTo(null);
    }

    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> new Dashboard().setVisible(true));
    }
}
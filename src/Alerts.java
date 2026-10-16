import javax.swing.*;
import javax.swing.border.EmptyBorder;
import javax.swing.text.JTextComponent;
import java.awt.*;
import java.awt.event.KeyEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;

// App-styled replacements for JOptionPane: no icons, a colored strip for the tone, flat buttons.
final class Alerts {

    private static final Color SUCCESS = new Color(0x2F7D4F);
    private static final Color WARNING = new Color(0xB7791F);
    private static final Color ERROR = new Color(0xB3261E);

    private Alerts() {
    }

    static void info(Component parent, String title, String message) {
        show(parent, title, text(message), null, "OK", null);
    }

    static void success(Component parent, String title, String message) {
        show(parent, title, text(message), SUCCESS, "OK", null);
    }

    static void warning(Component parent, String title, String message) {
        show(parent, title, text(message), WARNING, "OK", null);
    }

    static void error(Component parent, String title, String message) {
        show(parent, title, text(message), ERROR, "OK", null);
    }

    /** Returns true when the user presses confirmLabel; Cancel, Esc, and closing return false. */
    static boolean confirm(Component parent, String title, String message, String confirmLabel) {
        return show(parent, title, text(message), null, confirmLabel, "Cancel");
    }

    /** Shows form with OK/Cancel buttons and focuses its first text field; returns true on OK. */
    static boolean form(Component parent, String title, JComponent form, String okLabel) {
        clearBackgrounds(form);
        return show(parent, title, form, null, okLabel, "Cancel");
    }

    private static JComponent text(String message) {
        JLabel label = new JLabel("<html><div style='width:300px'>" + DenseList.html(message) + "</div></html>");
        label.setFont(DenseList.font(Font.PLAIN, 13));
        label.setForeground(DenseList.SUBTLE);
        return label;
    }

    // Swing panels and checkboxes paint gray by default, which shows up as boxes on the white dialog.
    private static void clearBackgrounds(Container container) {
        for (Component c : container.getComponents()) {
            if (c instanceof JPanel || c instanceof JCheckBox || c instanceof JRadioButton) {
                ((JComponent) c).setOpaque(false);
            }
            // Only labels still on the default font; ones styled on purpose keep their look.
            if (c instanceof JLabel label && label.getFont() instanceof javax.swing.plaf.UIResource) {
                label.setFont(DenseList.font(Font.PLAIN, 13));
                label.setForeground(DenseList.SUBTLE);
            }
            if (c instanceof JPanel panel) {
                clearBackgrounds(panel);
            }
        }
        if (container instanceof JPanel panel) {
            panel.setOpaque(false);
        }
    }

    private static boolean show(Component parent, String title, JComponent body, Color tone,
                                String okLabel, String cancelLabel) {
        Window owner = parent instanceof Window w ? w : parent == null ? null : SwingUtilities.getWindowAncestor(parent);
        JDialog dialog = new JDialog(owner, title, Dialog.ModalityType.APPLICATION_MODAL);
        dialog.setUndecorated(true);
        boolean[] confirmed = {false};

        JLabel heading = new JLabel(title);
        heading.setFont(DenseList.font(Font.BOLD, 15));
        heading.setForeground(DenseList.TEXT);

        JButton ok = Manager.primaryButton(okLabel);
        ok.addActionListener(e -> {
            confirmed[0] = true;
            dialog.dispose();
        });
        JPanel buttons = new JPanel(new FlowLayout(FlowLayout.RIGHT, 0, 0));
        buttons.setOpaque(false);
        if (cancelLabel != null) {
            JButton cancel = Manager.secondaryButton(cancelLabel);
            cancel.addActionListener(e -> dialog.dispose());
            buttons.add(cancel);
            buttons.add(Box.createRigidArea(new Dimension(8, 0)));
        }
        buttons.add(ok);

        JPanel content = new JPanel(new BorderLayout(0, 12));
        content.setBackground(DenseList.SURFACE);
        content.setBorder(new EmptyBorder(18, 22, 16, 22));
        content.add(heading, BorderLayout.NORTH);
        content.add(body, BorderLayout.CENTER);
        content.add(buttons, BorderLayout.SOUTH);

        JPanel root = new JPanel(new BorderLayout());
        root.setBorder(BorderFactory.createLineBorder(new Color(0xCFC9C1)));
        if (tone != null) {
            JPanel strip = new JPanel();
            strip.setBackground(tone);
            strip.setPreferredSize(new Dimension(0, 4));
            root.add(strip, BorderLayout.NORTH);
        }
        root.add(content, BorderLayout.CENTER);
        dialog.setContentPane(root);

        dialog.getRootPane().setDefaultButton(ok);
        dialog.getRootPane().registerKeyboardAction(e -> dialog.dispose(),
                KeyStroke.getKeyStroke(KeyEvent.VK_ESCAPE, 0), JComponent.WHEN_IN_FOCUSED_WINDOW);
        dialog.addWindowListener(new WindowAdapter() {
            @Override
            public void windowOpened(WindowEvent e) {
                JTextComponent field = firstTextField(body);
                (field != null ? field : ok).requestFocusInWindow();
            }
        });

        dialog.pack();
        dialog.setLocationRelativeTo(owner);
        dialog.setVisible(true);
        return confirmed[0];
    }

    private static JTextComponent firstTextField(Component c) {
        if (c instanceof JTextComponent text && text.isEditable()) return text;
        if (c instanceof Container container) {
            for (Component child : container.getComponents()) {
                JTextComponent found = firstTextField(child);
                if (found != null) return found;
            }
        }
        return null;
    }
}

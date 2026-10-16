import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

public final class Database {

    // Password comes from the DB_PASSWORD environment variable so it is never committed.
    private static final String DB_URL = "jdbc:postgresql://csce-315-db.engr.tamu.edu:5432/squad_55_db";
    private static final String DB_USER = "squad_55";
    private static final String DB_PASS = System.getenv("DB_PASSWORD");

    private Database() {
    }

    public static Connection connect() throws SQLException {
        Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASS);
        System.out.println("[INFO] Connected to PostgreSQL.");
        return conn;
    }
}

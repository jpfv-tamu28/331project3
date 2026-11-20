import { Link } from 'react-router-dom';
import { GoogleIcon, useAuth } from './components/AuthProvider';
import './Portal.css';

const VIEWS = [
  {
    to: '/kiosk',
    title: 'Customer Kiosk',
    description: 'Browse the menu, customize drinks and place your own order.',
    protected: false,
  },
  {
    to: '/cashier',
    title: 'Cashier',
    description: 'Ring up walk-in customers and take payment.',
    protected: true,
  },
  {
    to: '/manager',
    title: 'Manager',
    description: 'Menu, inventory, employees and sales reports.',
    protected: true,
  },
];

/**
 * Entry screen: Customer Kiosk opens immediately; Cashier and Manager require Google OAuth.
 */
export default function Portal() {
  const { user, loading, login, logout } = useAuth();

  return (
    <main className="portal">
      <header className="portal-header">
        <h1>Boba Bops</h1>
        <p>Choose where you'd like to go</p>
      </header>
      <nav aria-label="Choose a view">
        <ul className="portal-options">
          {VIEWS.map((view) => (
            <li key={view.to}>
              <Link to={view.to} replace className="portal-card">
                <div className="portal-card-top">
                  <span className="portal-card-title">{view.title}</span>
                  {view.protected && !user && (
                    <span className="portal-badge">Staff OAuth</span>
                  )}
                </div>
                <span className="portal-card-text">{view.description}</span>
                <span className="portal-card-cta" aria-hidden="true">
                  {view.protected && !user ? 'Sign in to open →' : 'Open →'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {!loading && (
        <footer className="portal-auth">
          {user ? (
            <div className="portal-user">
              <span className="subtle">
                Signed in as <strong>{user.name}</strong> ({user.email})
              </span>
              <button type="button" className="btn btn-secondary" onClick={logout}>
                Sign Out
              </button>
            </div>
          ) : (
            <button type="button" className="btn-google" onClick={() => login('/')}>
              <GoogleIcon />
              <span>Staff Sign in with Google</span>
            </button>
          )}
        </footer>
      )}
    </main>
  );
}

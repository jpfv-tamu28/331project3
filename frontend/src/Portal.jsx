import { Link } from 'react-router-dom';
import './Portal.css';

const VIEWS = [
  {
    to: '/kiosk',
    title: 'Customer Kiosk',
    description: 'Browse the menu, customize drinks and place your own order.',
  },
  {
    to: '/cashier',
    title: 'Cashier',
    description: 'Ring up walk-in customers and take payment.',
  },
  {
    to: '/manager',
    title: 'Manager',
    description: 'Menu, inventory, employees and sales reports.',
  },
];

/**
 * Entry screen: pick a view, no credentials needed.
 * Links use `replace` so this screen isn't left in the browser history behind the chosen view;
 * none of the views link back here either.
 */
export default function Portal() {
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
                <span className="portal-card-title">{view.title}</span>
                <span className="portal-card-text">{view.description}</span>
                <span className="portal-card-cta" aria-hidden="true">Open →</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}

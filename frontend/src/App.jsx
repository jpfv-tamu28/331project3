import { Navigate, Route, Routes } from 'react-router-dom';
import Portal from './Portal';
import Kiosk from './Kiosk';
import Cashier from './Cashier';
import Manager from './Manager';
import { RequireAuth } from './components/AuthProvider';

// Customer Kiosk is public; Cashier and Manager require Google OAuth sign-in.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Portal />} />
      <Route path="/kiosk" element={<Kiosk />} />
      <Route
        path="/cashier"
        element={(
          <RequireAuth title="Cashier">
            <Cashier />
          </RequireAuth>
        )}
      />
      <Route
        path="/manager"
        element={(
          <RequireAuth title="Manager">
            <Manager />
          </RequireAuth>
        )}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

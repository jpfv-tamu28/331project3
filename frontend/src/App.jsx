import { Navigate, Route, Routes } from 'react-router-dom';
import Portal from './Portal';
import Kiosk from './Kiosk';
import Cashier from './Cashier';
import Manager from './Manager';

// Each view fills the window on its own; none of them links to another view or back to the portal.
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Portal />} />
      <Route path="/kiosk" element={<Kiosk />} />
      <Route path="/cashier" element={<Cashier />} />
      <Route path="/manager" element={<Manager />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import Portal from './Portal';
import Kiosk from './Kiosk';
import Cashier from './Cashier';
import Manager from './Manager';
import { RequireAuth } from './components/AuthProvider';

// Customer Kiosk is public; Cashier and Manager require Google OAuth sign-in.
export default function App() {
  // Dev-only auto sign-in. `import.meta.env.DEV` is false in a production
  // build, so this block can never run outside `vite`/`npm run dev`. It also
  // still depends on the backend having DEV_AUTH_BYPASS=true set — if that's
  // off, the fetch just fails quietly and you fall back to normal sign-in.
  const [devLoginChecked, setDevLoginChecked] = useState(!import.meta.env.DEV);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    fetch('/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'you@example.com', name: 'Dev User' }),
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => console.log('[dev-login]', data))
      .catch((err) =>
        console.warn(
          '[dev-login] failed — is the backend running with DEV_AUTH_BYPASS=true?',
          err,
        ),
      )
      .finally(() => setDevLoginChecked(true));
  }, []);

  // Briefly hold off rendering protected routes until the dev-login attempt
  // has resolved, so RequireAuth doesn't race ahead and check session status
  // before the cookie is set.
  if (!devLoginChecked) {
    return null;
  }

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
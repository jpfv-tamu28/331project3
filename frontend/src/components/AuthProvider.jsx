import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Api, errorMessage, googleLoginUrl } from '../api';
import { useToast } from './ToastProvider';
import { useResource } from './useResource';

const AuthContext = createContext(null);

const AUTH_ERROR_MESSAGES = {
  not_configured: 'Google OAuth is not configured on the server yet. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env.',
  access_denied: 'Google sign-in was cancelled.',
  invalid_state: 'Your sign-in session expired or became invalid. Please try again.',
  token_exchange_failed: 'Could not verify your Google sign-in code with Google.',
  profile_fetch_failed: 'Could not load your Google account profile.',
  invalid_profile: 'Your Google account did not return an email address.',
};

export function AuthProvider({ children }) {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const session = useResource(() => Api.authMe(), []);
  const [loggedOut, setLoggedOut] = useState(false);
  const [initialError] = useState(() => {
    const code = new URLSearchParams(window.location.search).get('auth_error');
    if (!code) return null;
    return AUTH_ERROR_MESSAGES[code] || 'Sign-in failed. Please try again.';
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('auth_error');
    if (!code) return;

    const msg = AUTH_ERROR_MESSAGES[code] || 'Sign-in failed. Please try again.';
    toast.error('Sign-in failed', msg);

    params.delete('auth_error');
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ''}`, { replace: true });
  }, [location.pathname, location.search, navigate, toast]);

  const login = useCallback((returnTo = location.pathname) => {
    window.location.assign(googleLoginUrl(returnTo));
  }, [location.pathname]);

  const reload = useCallback(() => {
    setLoggedOut(false);
    session.reload();
  }, [session]);

  const logout = useCallback(async () => {
    try {
      await Api.logout();
      setLoggedOut(true);
      toast.info('Signed out', 'You have been signed out.');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error('Could not sign out', errorMessage(err));
    }
  }, [navigate, toast]);

  const user = loggedOut ? null : (session.data?.user ?? null);
  const configured = session.data ? session.data.configured !== false : true;

  const value = useMemo(() => ({
    user,
    configured,
    loading: session.loading,
    authError: initialError,
    login,
    logout,
    reload,
  }), [user, configured, session.loading, initialError, login, logout, reload]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}

/**
 * Protects a staff view (Cashier or Manager). When signed out, prompts the user
 * to sign in with Google and returns them to this route after authentication.
 */
export function RequireAuth({ title, children }) {
  const { user, configured, loading, authError, login } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <main className="auth-gate">
        <div className="auth-card" role="status" aria-live="polite">
          <p className="subtle">Checking sign-in status…</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-gate">
        <section className="auth-card" aria-labelledby="auth-gate-title">
          <p className="auth-brand">Boba Bops</p>
          <h1 id="auth-gate-title">{title ? `${title} Sign-In` : 'Staff Sign-In'}</h1>
          <p className="auth-subtitle">
            Sign in with your Google account to access the {title || 'staff'} screen.
          </p>

          {authError && (
            <div className="auth-alert" role="alert">
              {authError}
            </div>
          )}

          {!configured && !authError && (
            <div className="auth-alert" role="alert">
              Google OAuth credentials are not set yet. Add <code>GOOGLE_CLIENT_ID</code> and{' '}
              <code>GOOGLE_CLIENT_SECRET</code> to <code>backend/.env</code> to enable Google sign-in.
            </div>
          )}

          <button
            type="button"
            className="btn-google"
            onClick={() => login(location.pathname)}
          >
            <GoogleIcon />
            <span>Sign in with Google</span>
          </button>

          <div className="auth-footer">
            <Link to="/" replace className="auth-back-link">
              ← Back to Portal
            </Link>
          </div>
        </section>
      </main>
    );
  }

  return children;
}

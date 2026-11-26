import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ShieldCheck, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

export default function Login() {
  const { isAuthenticated, loginWithSession } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [devEmail, setDevEmail] = useState('ops@neemans.com');
  const googleBtnRef = useRef(null);

  const redirectPath = location.state?.from?.pathname || '/overview';

  useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  // Load Google Identity Services script if Google Client ID is configured
  useEffect(() => {
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!googleClientId) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (response.credential) {
              await handleTokenLogin(response.credential);
            }
          },
          hosted_domain: 'neemans.com',
        });
        window.google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'signin_with',
          shape: 'rectangular',
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  async function handleTokenLogin(credential) {
    setError('');
    setLoading(true);
    try {
      const data = await api.loginWithGoogle(credential);
      loginWithSession(data.access_token, data.user);
      navigate(redirectPath, { replace: true });
    } catch (err) {
      const message = err.message || 'Login failed';
      if (message.includes('403') || message.toLowerCase().includes('neemans.com')) {
        setError('Access restricted: Only authorized @neemans.com accounts can sign in.');
      } else {
        setError(`Authentication error: ${message}`);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDevLogin(e) {
    e.preventDefault();
    if (!devEmail || !devEmail.endsWith('@neemans.com')) {
      setError('Please provide a valid @neemans.com email address.');
      return;
    }
    await handleTokenLogin(`mock:${devEmail.trim()}`);
  }

  const isDev = import.meta.env.DEV || !import.meta.env.VITE_GOOGLE_CLIENT_ID;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center px-4 relative overflow-hidden select-none">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-8 relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200 p-2 flex items-center justify-center shadow-xs mb-4">
            <img
              src="/neemans-logo.png"
              alt="Neeman's"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Kadam Retail</h1>
            <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-1.5 py-0.5 rounded">
              v1.0
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Offline Retail Intelligence & Analytics Dashboard
          </p>
        </div>

        {/* Security Badge */}
        <div className="mt-5 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200/70 flex items-center gap-2.5 text-xs text-emerald-800">
          <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
          <span>Restricted to authorized <strong>@neemans.com</strong> employees.</span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-lg bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-700 animate-fade-in">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Google SSO Container */}
        <div className="mt-6 flex flex-col items-center">
          <div ref={googleBtnRef} className="w-full flex justify-center" />

          {/* Dev / Company Quick Sign-in */}
          {isDev && (
            <div className="w-full mt-4 pt-4 border-t border-slate-100">
              <form onSubmit={handleDevLogin} className="space-y-3">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                  <span>Sign in with Company Email</span>
                  <span className="text-indigo-600 font-semibold flex items-center gap-1">
                    <Sparkles size={11} /> Dev Auth
                  </span>
                </div>
                <div className="flex rounded-lg shadow-2xs border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500">
                  <input
                    type="email"
                    value={devEmail}
                    onChange={(e) => setDevEmail(e.target.value)}
                    placeholder="user@neemans.com"
                    className="flex-1 px-3 py-2 text-xs text-slate-800 outline-none"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-1 transition-colors disabled:opacity-50"
                  >
                    <span>Sign In</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center border-t border-slate-100 pt-4">
          <p className="text-[11px] text-slate-400">
            Neeman's Footwear Private Limited · Offline Retail Ops
          </p>
        </div>
      </div>
    </div>
  );
}

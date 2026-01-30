import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '../../lib/api-client.js';
import { useSettingsStore } from '../../stores/settings-store.js';
import { CloudLogo } from '../icons/CloudLogo.js';

export function SetupScreen() {
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuthStatus = useSettingsStore((s) => s.setAuthStatus);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleLogin = async () => {
    setError(null);
    setWaiting(true);

    try {
      await api.login();

      // Poll for auth completion
      pollRef.current = setInterval(async () => {
        try {
          const status = await api.getAuthStatus();
          if (status.authenticated) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setAuthStatus(status);
          }
        } catch {
          // ignore poll errors
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start login');
      setWaiting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-zinc-950">
      <div className="w-full max-w-md mx-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center mb-4">
              <CloudLogo size={24} className="text-zinc-300" />
            </div>
            <h1 className="text-xl font-semibold text-zinc-100">Welcome to CLouds Code</h1>
            <p className="text-sm text-zinc-400 mt-2 text-center">
              Sign in with your Anthropic account to get started.
            </p>
          </div>

          {waiting ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 size={24} className="animate-spin text-zinc-400" />
              <p className="text-sm text-zinc-400 text-center">
                Complete sign-in in your browser...
              </p>
              <button
                onClick={() => {
                  if (pollRef.current) clearInterval(pollRef.current);
                  pollRef.current = null;
                  setWaiting(false);
                }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <>
              <button
                onClick={handleLogin}
                className="w-full px-4 py-2.5 bg-[#da7756] hover:bg-[#c56a4c] rounded-lg text-white text-sm font-medium transition-colors"
              >
                Sign in with Claude
              </button>

              {error && (
                <p className="mt-3 text-sm text-red-400 text-center">{error}</p>
              )}
            </>
          )}

          <p className="mt-5 text-xs text-zinc-500 text-center">
            Uses the same authentication as{' '}
            <a
              href="https://claude.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300"
            >
              claude.ai
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

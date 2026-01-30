import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { api } from '../../lib/api-client.js';
import { useSettingsStore } from '../../stores/settings-store.js';

export function SettingsModal() {
  const open = useSettingsStore((s) => s.settingsModalOpen);
  const close = useSettingsStore((s) => s.closeSettingsModal);
  const authType = useSettingsStore((s) => s.authType);
  const subscriptionType = useSettingsStore((s) => s.subscriptionType);
  const setAuthStatus = useSettingsStore((s) => s.setAuthStatus);

  const [signingOut, setSigningOut] = useState(false);
  const [projectsRootDir, setProjectsRootDir] = useState('');
  const [rootDirSaving, setRootDirSaving] = useState(false);
  const [rootDirError, setRootDirError] = useState<string | null>(null);
  const [rootDirSaved, setRootDirSaved] = useState(false);

  useEffect(() => {
    if (open) {
      api.getProjectsRootDir().then(({ projectsRootDir: dir }) => {
        setProjectsRootDir(dir ?? '');
      }).catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  const authLabel =
    authType === 'oauth'
      ? 'Claude account'
      : authType === 'api_key'
        ? 'API key (environment)'
        : 'Not connected';

  const planLabel = subscriptionType
    ? subscriptionType.charAt(0).toUpperCase() + subscriptionType.slice(1)
    : null;

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);

    try {
      const result = await api.logout();
      setAuthStatus({
        authenticated: result.authenticated,
        authType: result.authType,
        subscriptionType: null,
      });
      if (!result.authenticated) close();
    } catch (err) {
      console.error('Sign out failed:', err);
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={close}>
      <div
        className="w-full max-w-md mx-4 bg-zinc-900 border border-zinc-800 rounded-xl p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-zinc-100">Settings</h2>
          <button onClick={close} className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Account status */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Account</h3>
          <div className="p-3 bg-zinc-800 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-100">{authLabel}</p>
                {planLabel && (
                  <p className="text-xs text-zinc-500 mt-0.5">Plan: {planLabel}</p>
                )}
              </div>
              {authType === 'oauth' && (
                <button
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-zinc-700 hover:bg-zinc-600 rounded-md transition-colors disabled:opacity-50"
                >
                  {signingOut ? 'Signing out...' : 'Sign out'}
                </button>
              )}
            </div>
          </div>
          {authType === 'api_key' && (
            <p className="text-xs text-zinc-500 mt-2">
              Using ANTHROPIC_API_KEY environment variable. Set via your shell profile.
            </p>
          )}
        </div>

        {/* Projects directory */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-zinc-300 mb-2">Projects Directory</h3>
          <div className="p-3 bg-zinc-800 rounded-lg">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={projectsRootDir}
                onChange={(e) => {
                  setProjectsRootDir(e.target.value);
                  setRootDirError(null);
                  setRootDirSaved(false);
                }}
                placeholder="~/Projects"
                className="flex-1 px-3 py-1.5 text-sm text-zinc-100 bg-zinc-700 border border-zinc-600 rounded-md focus:outline-none focus:border-blue-500 placeholder-zinc-500"
              />
              <button
                onClick={async () => {
                  if (!projectsRootDir.trim()) return;
                  setRootDirSaving(true);
                  setRootDirError(null);
                  setRootDirSaved(false);
                  try {
                    await api.setProjectsRootDir(projectsRootDir.trim());
                    setRootDirSaved(true);
                  } catch (err) {
                    setRootDirError(err instanceof Error ? err.message : 'Failed to save');
                  } finally {
                    setRootDirSaving(false);
                  }
                }}
                disabled={rootDirSaving || !projectsRootDir.trim()}
                className="px-3 py-1.5 text-xs text-zinc-100 bg-blue-600 hover:bg-blue-500 rounded-md transition-colors disabled:opacity-50"
              >
                {rootDirSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
            {rootDirError && (
              <p className="text-xs text-red-400 mt-1.5">{rootDirError}</p>
            )}
            {rootDirSaved && (
              <p className="text-xs text-green-400 mt-1.5">Saved successfully</p>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            Root directory where new project folders will be created.
          </p>
        </div>
      </div>
    </div>
  );
}

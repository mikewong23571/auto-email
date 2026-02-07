import { Eye, EyeOff, KeyRound, ClipboardPaste } from "lucide-react";
import { useMemo, useState } from "react";
import { clearToken, getToken, setToken } from "../api/client";
import { MessageList } from "../components/MessageList";

export const Home = () => {
  const [token, setUiToken] = useState(getToken() || "");
  const [isAuthed, setIsAuthed] = useState(!!getToken());
  const [showToken, setShowToken] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canPaste = useMemo(() => {
    return !!navigator.clipboard?.readText;
  }, []);

  const validateToken = async (candidate: string) => {
    const res = await fetch("/api/messages?limit=1&offset=0", {
      headers: {
        Authorization: `Bearer ${candidate}`,
      },
    });
    if (!res.ok) {
      throw new Error(`Invalid token (${res.status})`);
    }
  };

  const handleSaveToken = async () => {
    const trimmed = token.trim();
    setError(null);
    if (!trimmed) {
      setError("Token is required");
      return;
    }

    setIsSaving(true);
    try {
      await validateToken(trimmed);
      setToken(trimmed);
      setIsAuthed(true);
    } catch {
      setError("Token is invalid (or API is not reachable)");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasteToken = async () => {
    setError(null);
    try {
      const text = await navigator.clipboard.readText();
      setUiToken(text);
    } catch {
      setError("Clipboard permission denied");
    }
  };

  if (!isAuthed) {
    return (
      <div className="page-container page-container--centered">
        <div className="card card--auth">
          <div className="auth-header">
            <div className="auth-title">
              <h1 className="heading-card" style={{ margin: 0 }}>
                Mailbox
              </h1>
              <p className="text-body" style={{ margin: 0 }}>
                Enter API token to continue.
              </p>
            </div>
          </div>

          <form
            className="auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveToken();
            }}
          >
            <div className="input-group">
              <div className="text-label">API Token</div>
              <div className="input-with-icon input-with-actions">
                <KeyRound className="input-icon" size={18} />
                <input
                  type={showToken ? "text" : "password"}
                  value={token}
                  onChange={(e) => setUiToken(e.target.value)}
                  placeholder="Paste your token here"
                  className={`input-field ${error ? "input-field--error" : ""}`}
                />
                <div className="input-actions-right">
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => setShowToken((v) => !v)}
                    aria-label={showToken ? "Hide token" : "Show token"}
                  >
                    {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={handlePasteToken}
                    disabled={!canPaste}
                    aria-label="Paste token"
                  >
                    <ClipboardPaste size={16} />
                  </button>
                </div>
              </div>
              {error ? <div className="text-error text-xs mt-1">{error}</div> : null}
              <div className="status-hint">Token is stored in this browser session only.</div>
            </div>

            <button type="submit" disabled={isSaving} className="btn btn-primary btn-primary--full">
              {isSaving ? "Validating..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container page-container--padded">
      {/* Separated Header Area */}
      <header className="site-header">
        <div className="header-content">
          <h1 className="heading-page" style={{ marginBottom: 0 }}>
            Mailbox
          </h1>
          <button
            type="button"
            onClick={() => {
              clearToken();
              setIsAuthed(false);
            }}
            className="btn btn-ghost"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="page-content">
        <MessageList />
      </main>
    </div>
  );
};

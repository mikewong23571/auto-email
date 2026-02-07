import { useState } from "react";
import { clearToken, getToken, setToken } from "../api/client";
import { MessageList } from "../components/MessageList";

export const Home = () => {
  const [token, setUiToken] = useState(getToken() || "");
  const [isAuthed, setIsAuthed] = useState(!!getToken());

  const handleSaveToken = () => {
    setToken(token);
    setIsAuthed(true);
    window.location.reload();
  };

  if (!isAuthed) {
    return (
      <div className="page-container page-container--centered">
        <div className="card card--auth">
          <h1 className="heading-card mb-6">Login</h1>
          <input
            type="password"
            value={token}
            onChange={(e) => setUiToken(e.target.value)}
            placeholder="Enter API Token"
            className="input-field mb-4"
          />
          <button
            type="button"
            onClick={handleSaveToken}
            className="btn btn-primary btn-primary--full"
          >
            Save Token
          </button>
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

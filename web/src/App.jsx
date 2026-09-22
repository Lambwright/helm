import { useCallback, useEffect, useState } from "react";
import { getStoredToken, verify, logout as doLogout } from "./auth.js";
import { api } from "./api.js";
import Header from "./components/Header.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import UserList from "./components/UserList.jsx";
import AuditLog from "./components/AuditLog.jsx";
import Toast from "./components/Toast.jsx";

const TABS = [
  { key: "users", label: "Users" },
  { key: "audit", label: "Audit Log" },
];

export default function App() {
  const [authState, setAuthState] = useState("checking"); // checking | out | in
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("users");

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState(null);

  const [auditEntries, setAuditEntries] = useState([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState(null);

  const [toast, setToast] = useState(null); // { message, error }

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setAuthState("out");
      return;
    }
    verify(token).then((data) => {
      if (data.valid) {
        setUser(data.user);
        setAuthState("in");
      } else {
        setAuthState("out");
      }
    });
  }, []);

  const showToast = useCallback((message, error = false) => {
    setToast({ message, error });
  }, []);

  const loadUsers = useCallback(() => {
    if (authState !== "in" || user?.role !== "admin") return;
    setLoadingUsers(true);
    setUsersError(null);
    api
      .listUsers()
      .then((data) => setUsers(data.users || []))
      .catch((e) => {
        if (e.unauthorized) setAuthState("out");
        else setUsersError(e.message);
      })
      .finally(() => setLoadingUsers(false));
  }, [authState, user]);

  const loadAudit = useCallback(() => {
    if (authState !== "in" || user?.role !== "admin") return;
    setLoadingAudit(true);
    setAuditError(null);
    api
      .listAudit()
      .then((data) => setAuditEntries(data.entries || []))
      .catch((e) => {
        if (e.unauthorized) setAuthState("out");
        else setAuditError(e.message);
      })
      .finally(() => setLoadingAudit(false));
  }, [authState, user]);

  useEffect(() => {
    if (tab === "users") loadUsers();
    if (tab === "audit") loadAudit();
  }, [tab, loadUsers, loadAudit]);

  function handleLoggedIn(u) {
    setUser(u);
    setAuthState("in");
  }
  function handleLogout() {
    doLogout();
    setUser(null);
    setAuthState("out");
  }

  if (authState === "checking") {
    return (
      <div className="login-screen">
        <span className="spinner-inline">Checking session…</span>
      </div>
    );
  }
  if (authState === "out") {
    return <LoginScreen onLoggedIn={handleLoggedIn} />;
  }

  const isAdmin = user?.role === "admin";

  return (
    <>
      <Header user={user} onLogout={handleLogout} onToast={showToast} />
      <div className="container">
        {!isAdmin ? (
          <div className="card">
            <div className="card-title">Signed in</div>
            <p style={{ color: "var(--text-secondary)", fontSize: 13 }}>
              You're signed in as <strong>{user.displayName || user.username}</strong>. User management and the
              audit log need an admin account — use the "Copy token" button above if you just need a session
              token for debugging.
            </p>
          </div>
        ) : (
          <>
            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  className={`tab ${tab === t.key ? "active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === "users" && (
              <UserList
                users={users}
                currentUsername={user.username}
                loading={loadingUsers}
                error={usersError}
                onRefresh={loadUsers}
                onToast={showToast}
              />
            )}
            {tab === "audit" && (
              <AuditLog entries={auditEntries} loading={loadingAudit} error={auditError} onRefresh={loadAudit} />
            )}
          </>
        )}
      </div>
      {toast && <Toast message={toast.message} error={toast.error} onDismiss={() => setToast(null)} />}
    </>
  );
}

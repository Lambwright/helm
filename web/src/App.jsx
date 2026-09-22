import { useCallback, useEffect, useState } from "react";
import { getStoredToken, verify, logout as doLogout } from "./auth.js";
import { api } from "./api.js";
import { applyAccentPreset } from "./accentPresets.js";
import Header from "./components/Header.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import UserList from "./components/UserList.jsx";
import AuditLog from "./components/AuditLog.jsx";
import MyAccount from "./components/MyAccount.jsx";
import Toast from "./components/Toast.jsx";

const ADMIN_TABS = [
  { key: "users", label: "Users" },
  { key: "audit", label: "Audit Log" },
  { key: "account", label: "My Account" },
];
const USER_TABS = [{ key: "account", label: "My Account" }];

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
        if (data.user.themeAccent) applyAccentPreset(data.user.themeAccent);
        setAuthState("in");
        setTab(data.user.role === "admin" ? "users" : "account");
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
    if (u.themeAccent) applyAccentPreset(u.themeAccent);
    setAuthState("in");
    setTab(u.role === "admin" ? "users" : "account");
  }
  function handleLogout() {
    doLogout();
    applyAccentPreset(null);
    setUser(null);
    setAuthState("out");
  }
  function handleUserUpdated(updatedFields) {
    setUser((prev) => ({ ...prev, ...updatedFields }));
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
  const tabs = isAdmin ? ADMIN_TABS : USER_TABS;

  return (
    <>
      <Header user={user} onLogout={handleLogout} onToast={showToast} />
      <div className="container">
        <div className="tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`tab ${tab === t.key ? "active" : ""}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab === "users" && isAdmin && (
          <UserList
            users={users}
            currentUsername={user.username}
            loading={loadingUsers}
            error={usersError}
            onRefresh={loadUsers}
            onToast={showToast}
          />
        )}
        {tab === "audit" && isAdmin && (
          <AuditLog entries={auditEntries} loading={loadingAudit} error={auditError} onRefresh={loadAudit} />
        )}
        {tab === "account" && (
          <MyAccount user={user} onUserUpdated={handleUserUpdated} onToast={showToast} />
        )}
      </div>
      {toast && <Toast message={toast.message} error={toast.error} onDismiss={() => setToast(null)} />}
    </>
  );
}

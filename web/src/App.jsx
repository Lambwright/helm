import { useCallback, useEffect, useState } from "react";
import { getStoredToken, verify, logout as doLogout } from "./auth.js";
import { api } from "./api.js";
import { applyAccentPreset } from "./accentPresets.js";
import Header from "./components/Header.jsx";
import LoginScreen from "./components/LoginScreen.jsx";
import UserList from "./components/UserList.jsx";
import AuditLog from "./components/AuditLog.jsx";
import MyAccount from "./components/MyAccount.jsx";
import MatrixEditor from "./components/MatrixEditor.jsx";
import Departments from "./components/Departments.jsx";
import ToolPermissions from "./components/ToolPermissions.jsx";
import Security from "./components/Security.jsx";
import Toast from "./components/Toast.jsx";
import { SUPER_ADMIN } from "./apps.js";

// Everything except My Account is Super Admin only (Ben) — see the role matrix
// plan in auth-worker/README.md — apart from Departments, which the Admin job
// role can also edit. auth-worker enforces this; hiding tabs is UI only.
const ADMIN_TABS = [
  { key: "users", label: "Users" },
  { key: "departments", label: "Linked ids" },
  { key: "matrix", label: "Role Matrix" },
  { key: "security", label: "Security" },
  { key: "audit", label: "Audit Log" },
  { key: "account", label: "My Account" },
];
const USER_TABS = [{ key: "account", label: "My Account" }];
const DEPARTMENT_TAB = { key: "departments", label: "Linked ids" };
const SECURITY_TAB = { key: "security", label: "Security" };

export default function App() {
  const [authState, setAuthState] = useState("checking"); // checking | out | in
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState("users");
  const [matrixTab, setMatrixTab] = useState("roles"); // roles | tools

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState(null);

  const [matrix, setMatrix] = useState(null);
  const [builtinExtras, setBuiltinExtras] = useState({});

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
        if (data.user.themeAccent?.HELM) applyAccentPreset(data.user.themeAccent.HELM);
        setAuthState("in");
        setTab(data.user.jobRole === SUPER_ADMIN ? "users" : "account");
      } else {
        setAuthState("out");
      }
    });
  }, []);

  const showToast = useCallback((message, error = false) => {
    setToast({ message, error });
  }, []);

  // Users and the matrix load together: the user list and editors need the
  // matrix to show levels and previews.
  const loadUsers = useCallback(() => {
    if (authState !== "in" || user?.jobRole !== SUPER_ADMIN) return;
    setLoadingUsers(true);
    setUsersError(null);
    return Promise.all([api.listUsers(), api.getMatrix()])
      .then(([data, m]) => {
        setUsers(data.users || []);
        setMatrix(m.matrix || null);
        setBuiltinExtras(m.builtinExtras || {});
      })
      .catch((e) => {
        if (e.unauthorized) handleLogout();
        else setUsersError(e.message);
      })
      .finally(() => setLoadingUsers(false));
  }, [authState, user]);

  const loadAudit = useCallback(() => {
    if (authState !== "in" || user?.jobRole !== SUPER_ADMIN) return;
    setLoadingAudit(true);
    setAuditError(null);
    api
      .listAudit()
      .then((data) => setAuditEntries(data.entries || []))
      .catch((e) => {
        if (e.unauthorized) handleLogout();
        else setAuditError(e.message);
      })
      .finally(() => setLoadingAudit(false));
  }, [authState, user]);

  useEffect(() => {
    if (tab === "users" || tab === "matrix") loadUsers();
    if (tab === "audit") loadAudit();
  }, [tab, loadUsers, loadAudit]);

  function handleLoggedIn(u) {
    setUser(u);
    if (u.themeAccent?.HELM) applyAccentPreset(u.themeAccent.HELM);
    setAuthState("in");
    setTab(u.jobRole === SUPER_ADMIN ? "users" : "account");
  }
  // The ONLY function allowed to clear a session — the logout button and
  // every "the server just told us this token is dead" catch block (401 from
  // any api.* call) both route through here, specifically so nothing can
  // forget to reset the accent override when a session ends outside a normal
  // click on Log out. See auth-worker/README.md's themeAccent section.
  function handleLogout() {
    doLogout();
    applyAccentPreset(null);
    setUser(null);
    setAuthState("out");
  }
  function handleUserUpdated(updatedFields) {
    setUser((prev) => ({ ...prev, ...updatedFields }));
  }

  // Browser tab title follows what this person calls it.
  useEffect(() => {
    document.title = user ? `${user.helmName || "Settings"} — Einbau ID` : "Einbau ID";
  }, [user]);

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

  const isAdmin = user?.jobRole === SUPER_ADMIN;
  const canEditDepartments = isAdmin || user?.jobRole === "admin";
  // Non–Super Admins: Linked ids for the Admin job role, Security for anyone
  // given HELM's "Security dashboard" tool permission, My Account for all.
  const canSeeSecurity = isAdmin || !!user?.appExtras?.HELM?.includes("security_dashboard");
  const tabs = isAdmin
    ? ADMIN_TABS
    : [...(canEditDepartments ? [DEPARTMENT_TAB] : []), ...(canSeeSecurity ? [SECURITY_TAB] : []), ...USER_TABS];

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
            matrix={matrix}
            currentUsername={user.username}
            loading={loadingUsers}
            error={usersError}
            onRefresh={loadUsers}
            onToast={showToast}
          />
        )}
        {tab === "departments" && canEditDepartments && (
          <Departments onToast={showToast} onUnauthorized={handleLogout} />
        )}
        {tab === "matrix" && isAdmin && (
          <div className="tabs" style={{ marginTop: -6 }}>
            {[{ key: "roles", label: "Roles" }, { key: "tools", label: "Tool permissions" }].map((t) => (
              <button key={t.key} className={`tab ${matrixTab === t.key ? "active" : ""}`} style={{ fontSize: 11 }} onClick={() => setMatrixTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
        )}
        {tab === "matrix" && isAdmin && matrixTab === "tools" && (
          loadingUsers && !matrix ? (
            <div className="card"><div className="empty-state">Loading…</div></div>
          ) : (
            <ToolPermissions matrix={matrix} builtinExtras={builtinExtras} users={users} onChanged={loadUsers} onToast={showToast} />
          )
        )}
        {tab === "matrix" && isAdmin && matrixTab === "roles" && (
          loadingUsers && !matrix ? (
            <div className="card"><div className="empty-state">Loading…</div></div>
          ) : (
            <MatrixEditor
              key={matrix?.updatedAt || "none"}
              matrix={matrix}
              users={users}
              onSaved={() => loadUsers()}
              onToast={showToast}
            />
          )
        )}
        {tab === "security" && canSeeSecurity && <Security onToast={showToast} onUnauthorized={handleLogout} />}
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

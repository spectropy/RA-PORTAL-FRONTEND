import React, { useState, useEffect } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { GraduationCap, School, User, Users } from "lucide-react";
import LoginPage from "./components/LoginPage";
import Dashboard from "./Dashboard";
import SchoolOwnerDashboard from "./components/SchoolOwnerDashboard";
import TeacherDashboard from "./components/TeacherDashboard";
import StudentDashboard from "./components/StudentDashboard";
import ParentDashboard from "./components/ParentDashboard";
import GuestPage from "./components/GuestPage";
import portalLogo from "./assets/logo.png";

// ─── Role → Route map ────────────────────────────────────────────
const ROLE_ROUTES = {
  SPECTROPY_ADMIN: "/admin",
  SCHOOL_OWNER: "/school",
  TEACHER: "/teacher",
  STUDENT: "/student",
  PARENT: "/parent",
  GUEST: "/guest",
};

const ROLE_ICONS = {
  SCHOOL_OWNER: School,
  TEACHER: Users,
  STUDENT: GraduationCap,
  PARENT: Users,
};

function RoleIcon({ role }) {
  const Icon = ROLE_ICONS[role] || User;
  return <Icon size={14} strokeWidth={2} aria-hidden="true" />;
}

// ─── Route Guard ─────────────────────────────────────────────────
// Redirects unauthenticated users to /login.
// Redirects authenticated users away from their wrong role's route.
function Protected({ user, allowedRole, children }) {
  const location = useLocation();
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (user.role !== allowedRole) {
    const correctRoute = ROLE_ROUTES[user.role] || "/login";
    return <Navigate to={correctRoute} replace />;
  }
  return children;
}

// ─── App Shell (header + routing) ────────────────────────────────
function AppShell() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    try {
      const stored =
        localStorage.getItem("sp_user") || sessionStorage.getItem("sp_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        localStorage.setItem("sp_user", stored); // sync
      }
    } catch (e) {
      console.error("Failed to restore session:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLogin = (userData) => {
    const str = JSON.stringify(userData);
    localStorage.setItem("sp_user", str);
    sessionStorage.setItem("sp_user", str);
    setUser(userData);
    // Redirect to role-specific route after login
    navigate(ROLE_ROUTES[userData.role] || "/login", { replace: true });
  };

  const handleLogout = () => {
    localStorage.removeItem("sp_user");
    localStorage.removeItem("sp_school_id");
    localStorage.removeItem("sp_school_name");
    sessionStorage.clear();
    setUser(null);
    navigate("/login", { replace: true });
  };

  const headerRoleLabel =
    {
      SPECTROPY_ADMIN: "SPECTROPY ADMIN",
      SCHOOL_OWNER: "SCHOOL OWNER",
      TEACHER: "TEACHER LOGIN",
      STUDENT: "STUDENT LOGIN",
    }[user?.role] || user?.username || user?.name || user?.role;

  if (loading) {
    return (
      <div style={S.loadingWrap}>
        <div style={S.loadingBox}>
          <span className="spinner" style={{ width: "24px", height: "24px" }} />
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--color-text-main)",
            }}
          >
            Loading SPECTROPY Portal...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={S.container}>
      {/* ── Fixed Brand Header ───────────────────────────────── */}
      <header style={S.header} className="app-header">
        {/* Hamburger — Admin only */}
        {user?.role === "SPECTROPY_ADMIN" && (
          <button
            className="app-hamburger-btn"
            onClick={() =>
              window.dispatchEvent(new Event("toggleAdminSidebar"))
            }
            aria-label="Open Navigation"
          >
            ☰
          </button>
        )}
        {/* Hamburger — School Owner */}
        {user?.role === "SCHOOL_OWNER" && (
          <button
            className="app-hamburger-btn"
            onClick={() =>
              window.dispatchEvent(new Event("toggleSchoolAdminSidebar"))
            }
            aria-label="Open Navigation"
          >
            ☰
          </button>
        )}
        {/* Hamburger — Teacher */}
        {user?.role === "TEACHER" && (
          <button
            className="app-hamburger-btn"
            onClick={() =>
              window.dispatchEvent(new Event("toggleTeacherSidebar"))
            }
            aria-label="Open Navigation"
          >
            ☰
          </button>
        )}

        {/* Brand */}
        <div style={S.brandGroup} className="app-brand-group">
          <div style={S.logoContainer}>
            <img
              src={portalLogo}
              alt="SPECTROPY Logo"
              style={S.logoImg}
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "flex";
              }}
            />
            <div style={{ ...S.logoFallback, display: "none" }}>S</div>
          </div>
          <div style={S.titleBox}>
            <div style={S.titleRow}>
              <span style={S.brandTitle}>SPECTROPY</span>
            </div>
            <span style={S.subtitle}>Result Analysis Portal</span>
          </div>
        </div>

        {/* User pill + logout — hidden for SPECTROPY_ADMIN (sidebar) and TEACHER (sidebar has Sign Out) */}
        {user && (
            <div
              style={S.userMeta}
              className={`app-user-meta${user.role === "TEACHER" ? " app-user-meta--teacher" : ""}`}
            >
              <div style={S.userPill}>
                <RoleIcon role={user.role} />
                <span style={{ fontWeight: 600 }}>
                  {headerRoleLabel}
                </span>
              </div>
              {/* Sign Out hidden for TEACHER — already in sidebar */}
              {user.role !== "TEACHER" &&
                user.role !== "SPECTROPY_ADMIN" &&
                user.role !== "SCHOOL_OWNER" && (
                <button
                  onClick={handleLogout}
                  style={S.logoutBtn}
                  className="btn btn-outline"
                >
                  Sign Out
                </button>
              )}
            </div>
          )}
      </header>

      {/* ── Routes ────────────────────────────────────────────── */}
      <main style={S.mainContent}>
        <Routes>
          {/* Default: redirect to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

          {/* Public */}
          <Route
            path="/login"
            element={
              user ? (
                <Navigate to={ROLE_ROUTES[user.role] || "/login"} replace />
              ) : (
                <LoginPage onLogin={handleLogin} />
              )
            }
          />

          {/* Super Admin — /* allows nested tab routes */}
          <Route
            path="/admin/*"
            element={
              <Protected user={user} allowedRole="SPECTROPY_ADMIN">
                <Dashboard user={user} onLogout={handleLogout} />
              </Protected>
            }
          />

          {/* School Owner — /* allows nested tab routes */}
          <Route
            path="/school/*"
            element={
              <Protected user={user} allowedRole="SCHOOL_OWNER">
                <SchoolOwnerDashboard onBack={handleLogout} />
              </Protected>
            }
          />

          {/* Teacher — /* allows nested tab routes */}
          <Route
            path="/teacher/*"
            element={
              <Protected user={user} allowedRole="TEACHER">
                <TeacherDashboard onBack={handleLogout} />
              </Protected>
            }
          />

          {/* Student */}
          <Route
            path="/student"
            element={
              <Protected user={user} allowedRole="STUDENT">
                <StudentDashboard onBack={handleLogout} />
              </Protected>
            }
          />

          {/* Parent */}
          <Route
            path="/parent"
            element={
              <Protected user={user} allowedRole="PARENT">
                <ParentDashboard onBack={handleLogout} />
              </Protected>
            }
          />

          {/* Guest */}
          <Route
            path="/guest"
            element={
              <Protected user={user} allowedRole="GUEST">
                <GuestPage onBack={handleLogout} />
              </Protected>
            }
          />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}

// ─── Root App ────────────────────────────────────────────────────
// BrowserRouter is provided by main.jsx — do NOT add another one here.
export default function App() {
  return <AppShell />;
}

// ─── Shell Styles ─────────────────────────────────────────────────
const S = {
  container: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    backgroundColor: "var(--color-bg)",
  },
  header: {
    background: "var(--app-shell-bg)",
    color: "var(--color-text-main)",
    padding: "10px clamp(16px, 3vw, 32px)",
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    borderBottom: "1px solid var(--app-shell-border)",
    boxShadow: "0 4px 14px -6px rgba(15,23,42,0.18)",
    position: "sticky",
    top: 0,
    zIndex: 100,
  },
  brandGroup: { display: "flex", alignItems: "center", gap: "14px" },
  logoContainer: {
    padding: "2px 4px",

    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  logoImg: {
    height: "40px",
    width: "auto",
    maxWidth: "130px",
    objectFit: "contain",
  },
  logoFallback: {
    width: "32px",
    height: "32px",
    borderRadius: "6px",
    backgroundColor: "var(--primary-600)",
    color: "#ffffff",
    fontWeight: 700,
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  titleBox: { display: "flex", flexDirection: "column", gap: "2px" },
  titleRow: { display: "flex", alignItems: "center", gap: "8px" },
  brandTitle: {
    fontSize: "clamp(17px, 2.2vw, 20px)",
    fontWeight: 800,
    letterSpacing: "0.8px",
    color: "var(--color-text-main)",
    lineHeight: 1.1,
  },
  subtitle: {
    fontSize: "12px",
    color: "var(--color-text-muted)",
    fontWeight: 500,
  },
  userMeta: { display: "flex", alignItems: "center", gap: "12px" },
  userPill: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 14px",
    borderRadius: "99px",
    background: "var(--color-bg)",
    border: "1px solid var(--color-border)",
    color: "var(--color-text-main)",
    fontSize: "13px",
  },
  logoutBtn: {
    padding: "6px 14px",
    fontSize: "13px",
    minHeight: "36px",
    color: "var(--color-text-main)",
    borderColor: "var(--color-border)",
    background: "var(--color-bg)",
  },
  mainContent: { flex: 1, display: "flex", flexDirection: "column" },
  loadingWrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--color-bg)",
  },
  loadingBox: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "16px 24px",
    background: "#ffffff",
    borderRadius: "12px",
    border: "1px solid var(--color-border)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
  },
};

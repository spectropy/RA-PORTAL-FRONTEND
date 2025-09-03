import React, { useState } from "react";
import SchoolOwnerDashboard from "./SchoolOwnerDashboard";
import TeacherDashboard from "./TeacherDashboard";
import StudentDashboard from "./StudentDashboard";
import ParentDashboard from "./ParentDashboard";
import GuestPage from "./GuestPage";

const ROLES = {
  ADMIN: "SPECTROPY_ADMIN",
  OWNER: "SCHOOL_OWNER",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
  PARENT: "PARENT",
  GUEST: "GUEST",
};

// 🔐 Dev-only credentials (replace with backend later)
const CREDENTIALS = {
  OWNER: { username: "owner", password: "owner@123" },
  TEACHER: { username: "teacher", password: "teacher@123" },
  STUDENT: { username: "student", password: "student@123" },
  PARENT: { username: "parent", password: "parent@123" },
  ADMIN: { username: "admin", password: "spectropy@123" },
};

// 🔐 Reusable Password Input with Eye Toggle
function PasswordInput({ value, onChange, placeholder }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={styles.passwordContainer}>
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={styles.input}
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        style={styles.eyeButton}
        aria-label={showPassword ? "Hide password" : "Show password"}
        title={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

export default function LoginPage({ onLogin }) {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [loginStep, setLoginStep] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleUsername, setRoleUsername] = useState("");
  const [rolePassword, setRolePassword] = useState("");
  const [error, setError] = useState("");
  const [roleError, setRoleError] = useState("");

  // ← Back to role selection
  const handleBack = () => {
    setLoginStep(null);
    setShowAdminForm(false);
    setUsername("");
    setPassword("");
    setRoleUsername("");
    setRolePassword("");
    setError("");
    setRoleError("");
  };

  // 🛠️ Admin Login
  const handleAdminSubmit = (e) => {
    e.preventDefault();
    if (username === CREDENTIALS.ADMIN.username && password === CREDENTIALS.ADMIN.password) {
      setError("");
      onLogin({ role: ROLES.ADMIN });
    } else {
      setError("Invalid admin credentials");
    }
  };

  // 🏫 School Owner Login (Backend)
  const handleOwnerLogin = async (e) => {
    e.preventDefault();
    setRoleError("");

    try {
      const response = await fetch('http://localhost:4000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: roleUsername,
          password: rolePassword,
          role: ROLES.OWNER,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setRoleError(data.error || 'Invalid credentials');
        return;
      }

      sessionStorage.setItem('sp_school_id', data.school_id);
      setLoginStep("owner-dashboard");
    } catch (err) {
      setRoleError('Network error. Is backend running?');
    }
  };

  // 🧑‍🏫 Teacher, 🎓 Student, 👨‍👩‍👧‍👦 Parent Login
  const handleRoleLogin = (role) => async (e) => {
    e.preventDefault();
    setRoleError("");

    const creds = CREDENTIALS[role];
    if (roleUsername === creds.username && rolePassword === creds.password) {
      setLoginStep(`${role.toLowerCase()}-dashboard`);
    } else {
      setRoleError(`Invalid ${role.toLowerCase()} credentials`);
    }
  };

  // --- Dashboard Routes ---
  if (loginStep === "owner-dashboard") {
    return <SchoolOwnerDashboard onBack={handleBack} />;
  }
  if (loginStep === "teacher-dashboard") {
    return <TeacherDashboard onBack={handleBack} />;
  }
  if (loginStep === "student-dashboard") {
    return <StudentDashboard onBack={handleBack} />;
  }
  if (loginStep === "parent-dashboard") {
    return <ParentDashboard onBack={handleBack} />;
  }
  if (loginStep === "guest-dashboard") {
    return <GuestPage onBack={handleBack} />;
  }

  // --- Reusable Login Form ---
  const renderLoginForm = (title, emoji, role, onSubmit) => (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <header style={styles.header}>
          <h1 style={styles.h1}>🔐 {title} Login</h1>
          <p style={styles.sub}>Enter your credentials to continue</p>
        </header>

        <form onSubmit={onSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={roleUsername}
              onChange={(e) => setRoleUsername(e.target.value)}
              style={styles.input}
              placeholder={`e.g., ${role.toLowerCase()}`}
              autoFocus
            />
          </div>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <PasswordInput
              value={rolePassword}
              onChange={(e) => setRolePassword(e.target.value)}
              placeholder="Enter password"
            />
          </div>
          {roleError && <div style={styles.error}>{roleError}</div>}

          <div style={styles.formActions}>
            <button type="button" onClick={handleBack} style={styles.cancelBtn}>
              ← Back
            </button>
            <button type="submit" style={styles.submitBtn}>
              Log In
            </button>
          </div>
        </form>

        <footer style={styles.footer}>
          <small>Contact admin for credentials</small>
        </footer>
      </div>
    </div>
  );

  // --- Specific Login Forms ---
  if (loginStep === "owner-login") {
    return renderLoginForm("School Owner", "🏫", ROLES.OWNER, handleOwnerLogin);
  }
  if (loginStep === "teacher-login") {
    return renderLoginForm("Teacher", "👩‍🏫", ROLES.TEACHER, handleRoleLogin("TEACHER"));
  }
  if (loginStep === "student-login") {
    return renderLoginForm("Student", "🎓", ROLES.STUDENT, handleRoleLogin("STUDENT"));
  }
  if (loginStep === "parent-login") {
    return renderLoginForm("Parent", "👨‍👩‍👧‍👦", ROLES.PARENT, handleRoleLogin("PARENT"));
  }

  // --- Admin Login Form ---
  if (showAdminForm) {
    return (
      <div style={styles.wrap}>
        <div style={styles.card}>
          <header style={styles.header}>
            <h1 style={styles.h1}>🔐 Admin Login</h1>
            <p style={styles.sub}>Enter your credentials to continue</p>
          </header>

          <form onSubmit={handleAdminSubmit} style={styles.form}>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                placeholder="Enter username"
                autoFocus
              />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
              />
            </div>
            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.formActions}>
              <button type="button" onClick={handleBack} style={styles.cancelBtn}>
                ← Back
              </button>
              <button type="submit" style={styles.submitBtn}>
                Log In
              </button>
            </div>
          </form>

          <footer style={styles.footer}>
            <small>Contact admin for credentials</small>
          </footer>
        </div>
      </div>
    );
  }

  // --- Role Selection Screen ---
  const handleRoleClick = (role) => {
    if (role === ROLES.ADMIN) {
      setShowAdminForm(true);
    } else if (role === ROLES.OWNER) {
      setLoginStep("owner-login");
    } else if (role === ROLES.TEACHER) {
      setLoginStep("teacher-login");
    } else if (role === ROLES.STUDENT) {
      setLoginStep("student-login");
    } else if (role === ROLES.PARENT) {
      setLoginStep("parent-login");
    } else if (role === ROLES.GUEST) {
      setLoginStep("guest-dashboard");
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <header style={styles.header}>
          <h1 style={styles.h1}>SPECTROPY — Portal Login</h1>
          <p style={styles.sub}>Select your role to continue</p>
        </header>

        <div style={styles.grid} role="list">
          {[
            { key: ROLES.ADMIN, title: "Spectropy Admin", emoji: "🛠️", blurb: "Manage portals and schools." },
            { key: ROLES.OWNER, title: "School Owner", emoji: "🏫", blurb: "View school analytics." },
            { key: ROLES.TEACHER, title: "Teacher", emoji: "👩‍🏫", blurb: "Upload results & reports." },
            { key: ROLES.STUDENT, title: "Student", emoji: "🎓", blurb: "Check your scores." },
            { key: ROLES.PARENT, title: "Parent", emoji: "👨‍👩‍👧‍👦", blurb: "Track child performance." },
            { key: ROLES.GUEST, title: "Guest", emoji: "👤", blurb: "Preview limited access." },
          ].map(({ key, title, emoji, blurb }) => (
            <button
              key={key}
              role="listitem"
              onClick={() => handleRoleClick(key)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleRoleClick(key);
              }}
              style={styles.tile}
              aria-label={`Login as ${title}`}
            >
              <div style={styles.emoji}>{emoji}</div>
              <div style={styles.title}>{title}</div>
              <div style={styles.blurb}>{blurb}</div>
            </button>
          ))}
        </div>

        <footer style={styles.footer}>
          <small>
            Need help? Contact{" "}
            <a href="mailto:support@spectropy.com" style={styles.link}>
              support@spectropy.com
            </a>
          </small>
        </footer>
      </div>
    </div>
  );
}

// === Styles ===
const styles = {
  wrap: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f0f8ff",
    padding: 24,
  },
  card: {
    width: "min(1100px, 100%)",
    background: "white",
    border: "2px solid #add8e6",
    borderRadius: 20,
    padding: "28px 28px 18px",
    boxShadow: "0 6px 20px rgba(173,216,230,0.5)",
  },
  header: { textAlign: "center", marginBottom: 12 },
  h1: {
    margin: 0,
    color: "#1e90ff",
    fontSize: 28,
    fontWeight: 700,
  },
  sub: {
    marginTop: 6,
    color: "#4682b4",
    fontSize: 14,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 14,
    marginTop: 18,
  },
  tile: {
    display: "grid",
    gridTemplateRows: "auto auto 1fr",
    gap: 6,
    padding: "16px 14px",
    textAlign: "center",
    background: "#f0f8ff",
    border: "1px solid #87ceeb",
    borderRadius: 14,
    color: "#1e3d59",
    cursor: "pointer",
    transition: "transform 140ms ease, box-shadow 140ms ease, background 140ms ease",
    outline: "none",
  },
  emoji: { fontSize: 26, lineHeight: 1 },
  title: { fontSize: 16, fontWeight: 700, marginTop: 2, color: "#1e90ff" },
  blurb: { fontSize: 13, color: "#4682b4" },
  footer: { marginTop: 14, textAlign: "center", color: "#4682b4" },
  link: { color: "#1e90ff", textDecoration: "underline" },

  // Form Styles
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1e3d59",
  },
  input: {
    padding: "10px 12px",
    fontSize: 14,
    border: "1px solid #87ceeb",
    borderRadius: 8,
    outline: "none",
    background: "#f8faff",
  },
  error: {
    color: "#e3342f",
    fontSize: 13,
    textAlign: "center",
    padding: "8px",
    background: "#fff5f5",
    border: "1px solid #e3342f",
    borderRadius: 8,
  },
  formActions: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    padding: "8px 16px",
    fontSize: 14,
    border: "1px solid #4682b4",
    background: "white",
    color: "#4682b4",
    borderRadius: 8,
    cursor: "pointer",
  },
  submitBtn: {
    padding: "8px 20px",
    fontSize: 14,
    border: "none",
    background: "#1e90ff",
    color: "white",
    borderRadius: 8,
    cursor: "pointer",
  },

  // Password Input with Eye
  passwordContainer: {
    position: 'relative',
  },
  eyeButton: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    color: '#555',
    padding: '4px',
  },
};

// Responsive
styles.grid["@media (max-width: 900px)"] = { gridTemplateColumns: "repeat(2, minmax(0,1fr))" };
styles.grid["@media (max-width: 600px)"] = { gridTemplateColumns: "repeat(1, minmax(0,1fr))" };
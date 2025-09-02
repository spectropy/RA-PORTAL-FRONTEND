import React, { useState } from "react";

const ROLES = {
  ADMIN: "SPECTROPY_ADMIN",
  OWNER: "SCHOOL_OWNER",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
  PARENT: "PARENT",
  GUEST: "GUEST",
};

// Hardcoded admin credentials (replace with backend auth later)
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "spectropy@123", // Change this in production!
};

const ROLE_CARDS = [
  { key: ROLES.ADMIN, title: "Spectropy Admin", emoji: "🛠️", blurb: "Manage portals and schools." },
  { key: ROLES.OWNER, title: "School Owner", emoji: "🏫", blurb: "View school analytics." },
  { key: ROLES.TEACHER, title: "Teacher", emoji: "👩‍🏫", blurb: "Upload results & reports." },
  { key: ROLES.STUDENT, title: "Student", emoji: "🎓", blurb: "Check your scores." },
  { key: ROLES.PARENT, title: "Parent", emoji: "👨‍👩‍👧‍👦", blurb: "Track child performance." },
  { key: ROLES.GUEST, title: "Guest", emoji: "👤", blurb: "Preview limited access." },
];

export default function LoginPage({ onLogin }) {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleAdminSubmit = (e) => {
    e.preventDefault();
    if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
      setError("");
      setUsername("");
      setPassword("");
      setShowAdminForm(false);
      onLogin({ role: ROLES.ADMIN }); // Proceed to dashboard
    } else {
      setError("Invalid username or password");
    }
  };

  const handleRoleClick = (role) => {
    if (role === ROLES.ADMIN) {
      setShowAdminForm(true);
    } else {
      onLogin({ role }); // Other roles go directly (for now)
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        {/* Header */}
        <header style={styles.header}>
          <h1 style={styles.h1}>
            {showAdminForm ? "🔐 Admin Login" : "SPECTROPY — Portal Login"}
          </h1>
          <p style={styles.sub}>
            {showAdminForm
              ? "Enter your credentials to continue"
              : "Select your role to continue"}
          </p>
        </header>

        {/* Admin Login Form */}
        {showAdminForm ? (
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
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                placeholder="Enter password"
              />
            </div>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.formActions}>
              <button
                type="button"
                onClick={() => {
                  setShowAdminForm(false);
                  setError("");
                }}
                style={styles.cancelBtn}
              >
                ← Back
              </button>
              <button type="submit" style={styles.submitBtn}>
                Log In
              </button>
            </div>
          </form>
        ) : (
          /* Role Selection Grid */
          <div style={styles.grid} role="list">
            {ROLE_CARDS.map(({ key, title, emoji, blurb }) => (
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
        )}

        {/* Footer */}
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
};

// Responsive
styles.grid["@media (max-width: 900px)"] = { gridTemplateColumns: "repeat(2, minmax(0,1fr))" };
styles.grid["@media (max-width: 600px)"] = { gridTemplateColumns: "repeat(1, minmax(0,1fr))" };
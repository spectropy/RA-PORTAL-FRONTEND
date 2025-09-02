import React, { useState } from "react";
import supabase from '../lib/supabaseClient'; // ← Import Supabase client
import SchoolOwnerDashboard from "./SchoolOwnerDashboard";

const ROLES = {
  ADMIN: "SPECTROPY_ADMIN",
  OWNER: "SCHOOL_OWNER",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
  PARENT: "PARENT",
  GUEST: "GUEST",
};

export default function LoginPage({ onLogin }) {
  const [loginStep, setLoginStep] = useState(null); // null | 'admin-login' | 'owner-login' | 'owner-dashboard'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleBack = () => {
    setLoginStep(null);
    setEmail("");
    setPassword("");
    setError("");
  };

  // 🔐 Spectropy Admin Login
  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setError("");

    const { data: admin, error: fetchError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('email', email)
      .single();

    if (fetchError || !admin) {
      setError("Admin not found");
      return;
    }

    if (admin.password !== password) { // Compare plain text (dev only)
      setError("Invalid password");
      return;
    }

    // Save user to session
    sessionStorage.setItem('sp_user', JSON.stringify({
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: ROLES.ADMIN
    }));

    onLogin({ role: ROLES.ADMIN });
  };

  // 🏫 School Owner Login
  const handleOwnerLogin = async (e) => {
    e.preventDefault();
    setError("");

    const { data: user, error: fetchError } = await supabase
      .from('school_users')
      .select('*, schools(school_id)')
      .eq('email', email)
      .in('role', ['SCHOOL_OWNER', 'PRINCIPAL', 'ADMINISTRATOR'])
      .single();

    if (fetchError || !user) {
      setError("Invalid credentials or access denied");
      return;
    }

    if (user.password !== password) {
      setError("Invalid password");
      return;
    }

    // Save to session
    sessionStorage.setItem('sp_user', JSON.stringify({
      id: user.id,
      email: user.email,
      name: user.name,
      role: ROLES.OWNER,
      school_id: user.schools.school_id,
      school_name: user.schools.school_name
    }));

    sessionStorage.setItem('sp_school_id', user.schools.school_id);
    setLoginStep("owner-dashboard");
  };

  // ============ RENDER ============

  if (loginStep === "admin-login") {
    return (
      <AuthForm
        title="🔐 Spectropy Admin Login"
        subtitle="Enter your admin credentials"
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        onSubmit={handleAdminLogin}
        error={error}
        onBack={handleBack}
      />
    );
  }

  if (loginStep === "owner-login") {
    return (
      <AuthForm
        title="🏫 School Owner Login"
        subtitle="Enter your school credentials"
        email={email}
        password={password}
        setEmail={setEmail}
        setPassword={setPassword}
        onSubmit={handleOwnerLogin}
        error={error}
        onBack={handleBack}
      />
    );
  }

  if (loginStep === "owner-dashboard") {
    return <SchoolOwnerDashboard onBack={handleBack} />;
  }

  // === Role Selection Screen ===
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
              onClick={() => {
                if (key === ROLES.ADMIN) setLoginStep("admin-login");
                else if (key === ROLES.OWNER) setLoginStep("owner-login");
                else onLogin({ role: key });
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

// Reusable Auth Form Component
function AuthForm({ title, subtitle, email, password, setEmail, setPassword, onSubmit, error, onBack }) {
  return (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <header style={styles.header}>
          <h1 style={styles.h1}>{title}</h1>
          <p style={styles.sub}>{subtitle}</p>
        </header>

        <form onSubmit={onSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="you@domain.com"
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
            <button type="button" onClick={onBack} style={styles.cancelBtn}>
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

// === Styles (same as before) ===
const styles = { /* ... keep your existing styles ... */ };

// Responsive
styles.grid["@media (max-width: 900px)"] = { gridTemplateColumns: "repeat(2, minmax(0,1fr))" };
styles.grid["@media (max-width: 600px)"] = { gridTemplateColumns: "repeat(1, minmax(0,1fr))" };
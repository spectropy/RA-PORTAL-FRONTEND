import React, { useState } from "react";
import SchoolOwnerDashboard from "./SchoolOwnerDashboard";
import TeacherDashboard from "./TeacherDashboard";
import StudentDashboard from "./StudentDashboard";
import ParentDashboard from "./ParentDashboard";
import GuestPage from "./GuestPage";
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';


const ROLES = {
  ADMIN: "SPECTROPY_ADMIN",
  OWNER: "SCHOOL_OWNER",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
  PARENT: "PARENT",
  GUEST: "GUEST",
};

// 🔐 Dev-only credentials for non-owner roles
const CREDENTIALS = {
  STUDENT: { username: "student", password: "student@123" },
  PARENT: { username: "parent", password: "parent@123" },
  ADMIN: { username: "admin", password: "spectropy@123" },
};

export default function LoginPage({ onLogin }) {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [loginStep, setLoginStep] = useState(null);
  const [username, setUsername] = useState(""); // Admin username
  const [password, setPassword] = useState(""); // Admin password
  const [roleUsername, setRoleUsername] = useState(""); // For Teacher/Parent/Student
  const [rolePassword, setRolePassword] = useState("");
  const [schoolId, setSchoolId] = useState(""); // ← New: School ID input
  const [error, setError] = useState(""); // Admin error
  const [roleError, setRoleError] = useState(""); // Role login error
  const [schoolIdError, setSchoolIdError] = useState(""); // School ID error
  

  // ← Back to role selection
  const handleBack = () => {
    setLoginStep(null);
    setShowAdminForm(false);
    setUsername("");
    setPassword("");
    setRoleUsername("");
    setRolePassword("");
    setSchoolId("");
    setError("");
    setRoleError("");
    setSchoolIdError("");
  };

  // 🛠️ Admin Login (username + password)
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
  setSchoolIdError("");
  const username = schoolId.trim().toUpperCase(); // Using schoolId state for username
  const password = rolePassword.trim().toUpperCase(); // Use rolePassword for password field

  // Validate format: STATE (2 letters) + YY (2 digits) + NN (2 digits)
  const idRegex = /^[A-Z]{2}\d{4}$/;
  if (!idRegex.test(username)) {
    setSchoolIdError("Invalid format. Use: AA0000 (e.g., TS2501)");
    return;
  }

  if (username !== password) {
    setSchoolIdError("Username and Password must be the same School ID.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/schools/${username}`);
    if (!res.ok) {
      setSchoolIdError("Invalid School ID. School not found.");
      return;
    }

    const schoolData = await res.json();

    // ✅ Save session
    sessionStorage.setItem("sp_school_id", username);
    sessionStorage.setItem("sp_school_name", schoolData.school_name || "Unknown School");
    sessionStorage.setItem("sp_user", JSON.stringify({ role: ROLES.OWNER, school_id: username }));

    // 🚀 Go to dashboard
    setLoginStep("owner-dashboard");
  } catch (err) {
    console.error("Network error:", err);
    setSchoolIdError("Network error. Is the server running?");
  }
};

// 🧑‍🏫 Teacher, 🎓 Student, 👨‍👩‍👧‍👦 Parent Login
const handleRoleLogin = (role) => async (e) => {
  e.preventDefault();
  setRoleError("");

  const schoolId = sessionStorage.getItem("sp_school_id");

  // 🔐 TEACHER: Validate against actual teacher IDs in the school
  if (role === "TEACHER") {
    if (!schoolId) {
      setRoleError("No school context. Please log in as School Owner first.");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/schools/${schoolId}`);
      if (!res.ok) throw new Error("School not found");

      const schoolData = await res.json();
      const teachers = Array.isArray(schoolData.teachers) ? schoolData.teachers : [];

      const username = roleUsername.trim().toUpperCase();
      const password = rolePassword.trim().toUpperCase();

      // ❌ Username and password must be exactly the same
      if (username !== password) {
        setRoleError("Username and password must be the same.");
        return;
      }

      // ✅ Check if teacher ID exists (exact match)
      const matchedTeacher = teachers.find(t => t.teacherId && t.teacherId.trim() === username);

      if (!matchedTeacher) {
        setRoleError("Teacher ID not found in this school.");
        return;
      }

      // ✅ Login successful — Save full teacher info
      sessionStorage.setItem("sp_user", JSON.stringify({
        role: ROLES.TEACHER,
        school_id: schoolId,
        teacher_id: matchedTeacher.teacherId || null,
        name: matchedTeacher.name,
        contact: matchedTeacher.contact,
        email: matchedTeacher.email,
        teacher_assignments: matchedTeacher.teacher_assignments || []
      }));

      setLoginStep("teacher-dashboard");
    } catch (err) {
      console.error("Error during teacher login:", err);
      setRoleError("Failed to verify teacher. Is the server running?");
    }

    return;
  }
  
  // 🎓 STUDENT: Hardcoded login
  if (role === "STUDENT") {
    if (roleUsername === "student" && rolePassword === "student") {
      sessionStorage.setItem("sp_user", JSON.stringify({ 
        role: ROLES.STUDENT,
        username: "student"
      }));
      setLoginStep("student-dashboard");
    } else {
      setRoleError("Use 'student' as both username and password.");
    }
    return;
  }

  // 👨‍👩‍👧‍👦 PARENT: Hardcoded login
  if (role === "PARENT") {
    if (roleUsername === "parent" && rolePassword === "parent") {
      sessionStorage.setItem("sp_user", JSON.stringify({ 
        role: ROLES.PARENT,
        username: "parent"
      }));
      setLoginStep("parent-dashboard");
    } else {
      setRoleError("Use 'parent' as both username and password.");
    }
    return;
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

  // --- Reusable Login Form Component ---
  const renderLoginForm = (title, emoji, onSubmit, children) => (
    <div style={styles.wrap}>
      <div style={styles.card}>
        <header style={styles.header}>
          <h1 style={styles.h1}>🔐 {title} Login</h1>
          <p style={styles.sub}>Enter your credentials to continue</p>
        </header>

        <form onSubmit={onSubmit} style={styles.form}>
          {children}
          {roleError && <div style={styles.error}>{roleError}</div>}
          {schoolIdError && <div style={styles.error}>{schoolIdError}</div>}

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

  // --- School Owner: Enter School ID Only ---
// --- School Owner: Username & Password = School ID ---
if (loginStep === "owner-login") {
  return renderLoginForm(
    "School Owner",
    "🏫",
    handleOwnerLogin,
    <>
      {/* Username Field */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>Username (School ID)</label>
        <input
          type="text"
          value={schoolId}
          onChange={(e) => setSchoolId(e.target.value)}
          style={styles.input}
          placeholder="e.g., TS2501"
          autoFocus
        />
      </div>

      {/* Password Field */}
      <div style={styles.inputGroup}>
        <label style={styles.label}>Password (Same School ID)</label>
        <PasswordInput
          value={rolePassword}
          onChange={(e) => setRolePassword(e.target.value)}
          placeholder="Enter School ID again"
        />
      </div>

      {schoolIdError && <div style={styles.error}>{schoolIdError}</div>}
    </>
  );
}
  // --- Teacher Login ---
  if (loginStep === "teacher-login") {
    return renderLoginForm(
      "Teacher",
      "👩‍🏫",
      handleRoleLogin("TEACHER"),
      <>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Username (Teacher Name)</label>
          <input
            type="text"
            value={roleUsername}
            onChange={(e) => setRoleUsername(e.target.value)}
            style={styles.input}
            placeholder="e.g., teacher"
            autoFocus
          />
        </div>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Password (Same Teacher Name)</label>
          <PasswordInput
            value={rolePassword}
            onChange={(e) => setRolePassword(e.target.value)}
            placeholder="Enter password"
          />
        </div>
      </>
    );
  }

  // --- Student Login ---
  if (loginStep === "student-login") {
    return renderLoginForm(
      "Student",
      "🎓",
      handleRoleLogin("STUDENT"),
      <>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Username</label>
          <input
            type="text"
            value={roleUsername}
            onChange={(e) => setRoleUsername(e.target.value)}
            style={styles.input}
            placeholder="e.g., student"
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
      </>
    );
  }

  // --- Parent Login ---
  if (loginStep === "parent-login") {
    return renderLoginForm(
      "Parent",
      "👨‍👩‍👧‍👦",
      handleRoleLogin("PARENT"),
      <>
        <div style={styles.inputGroup}>
          <label style={styles.label}>Username</label>
          <input
            type="text"
            value={roleUsername}
            onChange={(e) => setRoleUsername(e.target.value)}
            style={styles.input}
            placeholder="e.g., parent"
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
      </>
    );
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

// --- Password Input Component ---
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
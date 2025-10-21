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
  ADMIN: [
    { username: "admin", password: "spectropy@123" },
    { username: "Krishna", password: "Krishna@123" },
    { username: "Sumathi", password: "Sumathi@123" },
    { username: "Naresh", password: "Naresh@123"},
    { username: "Pooja", password: "Pooja@123" },
    { username: "Rahul", password: "Rahul@123" },
    { username: "Ramesh", password: "Ramesh@123" },
    { username: "Teja", password: "Teja@123" },
  ],
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

  const handleAdminSubmit = (e) => {
  e.preventDefault();
  const matchedAdmin = CREDENTIALS.ADMIN.find(
    (admin) => admin.username === username && admin.password === password
  );

  if (matchedAdmin) {
    setError("");
    // ✅ Save admin identity in session (optional but useful)
    sessionStorage.setItem("sp_user", JSON.stringify({
      role: ROLES.ADMIN,
      username: matchedAdmin.username
    }));
    onLogin({ role: ROLES.ADMIN, username: matchedAdmin.username });
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

  // --- Teacher Login (Direct) ---
if (role === "TEACHER") {
  const username = roleUsername.trim().toUpperCase();
  const password = rolePassword.trim().toUpperCase();

  if (username !== password) {
    setRoleError("Teacher ID and password must be the same.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/teachers/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id: username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      setRoleError(data.error || "Invalid Teacher ID or password.");
      return;
    }

    // ✅ Save full teacher + school info to session
    sessionStorage.setItem("sp_user", JSON.stringify({
      role: ROLES.TEACHER,
      teacher_id: data.teacher.teacher_id,
      name: data.teacher.name,
      contact: data.teacher.contact,
      email: data.teacher.email,
      school_id: data.teacher.school_id,
      school_name: data.teacher.school_name,
      teacher_assignments: data.teacher.teacher_assignments || []
    }));

    setLoginStep("teacher-dashboard");
  } catch (err) {
    console.error("Network error during teacher login:", err);
    setRoleError("Network error. Please try again later.");
  }
  return;
}
  
  // 🎓 STUDENT: Hardcoded login
  // --- Student Login (Direct) ---
if (role === "STUDENT") {
  const username = roleUsername.trim();
  const password = rolePassword.trim();

  if (username !== password) {
    setRoleError("Student ID and password must be the same.");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/students/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      setRoleError(data.error || "Invalid Student ID or password.");
      return;
    }

    // ✅ Save full student + school info to session
    sessionStorage.setItem("sp_user", JSON.stringify({
      role: ROLES.STUDENT,
      student_id: data.student.student_id,
      roll_no: data.student.roll_no,
      name: data.student.name,
      class: data.student.class,
      section: data.student.section,
      gender: data.student.gender,
      parent_phone: data.student.parent_phone,
      parent_email: data.student.parent_email,
      school_id: data.student.school_id,
      school_name: data.student.school_name
    }));

    setLoginStep("student-dashboard");
  } catch (err) {
    console.error("Network error during student login:", err);
    setRoleError("Network error. Please try again later.");
  }
  return;
}

  // 👨‍👩‍👧‍👦 PARENT: Hardcoded login
if (role === "PARENT") {
  const username = roleUsername.trim();
  const password = rolePassword.trim();

  if (username !== password) {
    setRoleError("Parent ID and password must be the same (use Student ID).");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/students/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ student_id: username, password })
    });

    const data = await res.json();

    if (!res.ok) {
      setRoleError(data.error || "Invalid Student ID or password.");
      return;
    }

    // ✅ Save student data under PARENT role
    sessionStorage.setItem("sp_user", JSON.stringify({
      role: ROLES.PARENT,
      student_id: data.student.student_id,
      roll_no: data.student.roll_no,
      name: data.student.name,
      class: data.student.class,
      section: data.student.section,
      gender: data.student.gender,
      parent_phone: data.student.parent_phone,
      parent_email: data.student.parent_email,
      school_id: data.student.school_id,
      school_name: data.student.school_name
    }));

    setLoginStep("parent-dashboard"); // ← You’ll need to create ParentDashboard next
  } catch (err) {
    console.error("Network error during parent login:", err);
    setRoleError("Network error. Please try again later.");
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

const styles = {
  wrap: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    background: "#f0f8ff",
    padding: "clamp(16px, 4vw, 32px)", // adjusts automatically
  },
  card: {
    width: "min(100%, 1100px)",
    background: "white",
    border: "2px solid #add8e6",
    borderRadius: 20,
    padding: "clamp(20px, 3vw, 36px)",
    boxShadow: "0 6px 20px rgba(173,216,230,0.5)",
  },
  header: { textAlign: "center", marginBottom: 16 },
  h1: {
    margin: 0,
    color: "#1e90ff",
    fontSize: "clamp(20px, 3vw, 32px)",
    fontWeight: 700,
  },
  sub: {
    marginTop: 6,
    color: "#4682b4",
    fontSize: "clamp(13px, 1.4vw, 16px)",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: 16,
    marginTop: 20,
  },
  tile: {
    display: "grid",
    gridTemplateRows: "auto auto 1fr",
    gap: 6,
    padding: "clamp(12px, 2vw, 18px)",
    textAlign: "center",
    background: "#f0f8ff",
    border: "1px solid #87ceeb",
    borderRadius: 14,
    color: "#1e3d59",
    cursor: "pointer",
    transition: "transform 140ms ease, box-shadow 140ms ease, background 140ms ease",
  },
  emoji: { fontSize: "clamp(22px, 2.5vw, 28px)", lineHeight: 1 },
  title: {
    fontSize: "clamp(15px, 2vw, 18px)",
    fontWeight: 700,
    marginTop: 2,
    color: "#1e90ff",
  },
  blurb: {
    fontSize: "clamp(12px, 1.5vw, 14px)",
    color: "#4682b4",
  },
  footer: { marginTop: 18, textAlign: "center", color: "#4682b4" },
  link: { color: "#1e90ff", textDecoration: "underline" },

  // Form Styles
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    marginTop: 12,
  },
  inputGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  label: {
    fontSize: "clamp(13px, 1.3vw, 15px)",
    fontWeight: 600,
    color: "#1e3d59",
  },
  input: {
    padding: "clamp(10px, 2vw, 14px) 12px",
    fontSize: "clamp(13px, 1.5vw, 15px)",
    border: "1px solid #87ceeb",
    borderRadius: 8,
    outline: "none",
    background: "#f8faff",
  },
  error: {
    color: "#e3342f",
    fontSize: "clamp(12px, 1.3vw, 14px)",
    textAlign: "center",
    padding: "8px",
    background: "#fff5f5",
    border: "1px solid #e3342f",
    borderRadius: 8,
  },
  formActions: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    minWidth: 100,
    padding: "clamp(8px, 2vw, 10px) 16px",
    fontSize: "clamp(13px, 1.5vw, 15px)",
    border: "1px solid #4682b4",
    background: "white",
    color: "#4682b4",
    borderRadius: 8,
    cursor: "pointer",
  },
  submitBtn: {
    flex: 1,
    minWidth: 100,
    padding: "clamp(8px, 2vw, 10px) 20px",
    fontSize: "clamp(13px, 1.5vw, 15px)",
    border: "none",
    background: "#1e90ff",
    color: "white",
    borderRadius: 8,
    cursor: "pointer",
  },
  passwordContainer: {
    position: "relative",
  },
  eyeButton: {
    position: "absolute",
    right: "10px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "none",
    border: "none",
    fontSize: "18px",
    cursor: "pointer",
    color: "#555",
    padding: "4px",
  },
};

// Extra media queries for fine-tuning (optional)
styles.card["@media (max-width: 480px)"] = {
  borderRadius: 12,
  padding: "18px 16px",
};
styles.formActions["@media (max-width: 480px)"] = {
  flexDirection: "column",
  alignItems: "stretch",
};
styles.h1["@media (max-width: 360px)"] = { fontSize: "20px" };

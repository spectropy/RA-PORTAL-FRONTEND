import React, { useState } from "react";

// 🖼️ Import Role Specific Images from src/assets
import adminImg from "../assets/Spectropy Admin.png";
import ownerImg from "../assets/school owner.png";
import teacherImg from "../assets/Teacher Portal.png";
import studentImg from "../assets/Student Portal.png";
import parentImg from "../assets/Parent Portal.png";
import guestImg from "../assets/Guest Access.png";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

const ROLES = {
  ADMIN: "SPECTROPY_ADMIN",
  OWNER: "SCHOOL_OWNER",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
  PARENT: "PARENT",
  GUEST: "GUEST",
};

// 🔐 Credentials for admin login
const CREDENTIALS = {
  ADMIN: [
    { username: "admin", password: "spectropy@123" },
    { username: "Krishna", password: "Krishna@123" },
    { username: "Sumathi", password: "Sumathi@123" },
    { username: "Naresh", password: "Naresh@123" },
    { username: "Pooja", password: "Pooja@123" },
    { username: "Rahul", password: "Rahul@123" },
    { username: "Ramesh", password: "Ramesh@123" },
    { username: "Teja", password: "Teja@123" },
  ],
};

export default function LoginPage({ onLogin }) {
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [loginStep, setLoginStep] = useState(null);

  // Form Fields
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [roleUsername, setRoleUsername] = useState("");
  const [rolePassword, setRolePassword] = useState("");
  const [schoolId, setSchoolId] = useState("");

  // Errors & Loading
  const [error, setError] = useState("");
  const [roleError, setRoleError] = useState("");
  const [schoolIdError, setSchoolIdError] = useState("");
  const [loading, setLoading] = useState(false);

  // Reset view to main role selection grid
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
    setLoading(false);
  };

  // 🛠️ Admin Submit
  const handleAdminSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    setTimeout(() => {
      const matchedAdmin = CREDENTIALS.ADMIN.find(
        (admin) =>
          admin.username.toUpperCase() === username.trim().toUpperCase() &&
          admin.password === password,
      );

      if (matchedAdmin) {
        setError("");
        const userObj = {
          role: ROLES.ADMIN,
          username: matchedAdmin.username,
        };
        sessionStorage.setItem("sp_user", JSON.stringify(userObj));
        localStorage.setItem("sp_user", JSON.stringify(userObj));
        if (onLogin) onLogin(userObj);
      } else {
        setError("Invalid admin username or password.");
      }
      setLoading(false);
    }, 300);
  };

  // 🏫 School Owner Login
  const handleOwnerLogin = async (e) => {
    e.preventDefault();
    setSchoolIdError("");
    setLoading(true);

    const sId = schoolId.trim().toUpperCase();
    const sPassword = rolePassword.trim().toUpperCase();

    const idRegex = /^[A-Z]{2}\d{4}$/;
    if (!idRegex.test(sId)) {
      setSchoolIdError(
        "Invalid format. Use 2-letter state code + 4 digits (e.g., TS2501).",
      );
      setLoading(false);
      return;
    }

    if (sId !== sPassword) {
      setSchoolIdError("School ID and Password must match.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/schools/${sId}`);
      if (!res.ok) {
        setSchoolIdError("Invalid School ID. School record not found.");
        setLoading(false);
        return;
      }

      const schoolData = await res.json();

      sessionStorage.setItem("sp_school_id", sId);
      localStorage.setItem("sp_school_id", sId);
      sessionStorage.setItem(
        "sp_school_name",
        schoolData.school?.school_name ||
          schoolData.school_name ||
          "Unknown School",
      );
      localStorage.setItem(
        "sp_school_name",
        schoolData.school?.school_name ||
          schoolData.school_name ||
          "Unknown School",
      );
      const userObj = { role: ROLES.OWNER, school_id: sId };
      sessionStorage.setItem("sp_user", JSON.stringify(userObj));
      localStorage.setItem("sp_user", JSON.stringify(userObj));

      if (onLogin) {
        onLogin(userObj);
      } else {
        setLoginStep("owner-dashboard");
      }
    } catch (err) {
      console.error("Network error during school owner login:", err);
      setSchoolIdError(
        "Unable to connect to portal server. Please check network connection.",
      );
    } finally {
      setLoading(false);
    }
  };

  // 🧑‍🏫 Teacher, 🎓 Student, 👨‍👩‍👧‍👦 Parent Login
  const handleRoleLogin = (role) => async (e) => {
    e.preventDefault();
    setRoleError("");
    setLoading(true);

    // --- Teacher Login ---
    if (role === "TEACHER") {
      const uName = roleUsername.trim().toUpperCase();
      const pwd = rolePassword.trim().toUpperCase();

      if (!uName || !pwd) {
        setRoleError("Please enter both Teacher ID and Password.");
        setLoading(false);
        return;
      }

      if (uName !== pwd) {
        setRoleError("Teacher ID and password must match.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/teachers/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ teacher_id: uName, password: pwd }),
        });

        const data = await res.json();

        if (!res.ok) {
          setRoleError(data.error || "Invalid Teacher ID or password.");
          setLoading(false);
          return;
        }

        const userObj = {
          role: ROLES.TEACHER,
          teacher_id: data.teacher.teacher_id,
          name: data.teacher.name,
          contact: data.teacher.contact,
          email: data.teacher.email,
          school_id: data.teacher.school_id,
          school_name: data.teacher.school_name,
          teacher_assignments: data.teacher.teacher_assignments || [],
        };
        sessionStorage.setItem("sp_user", JSON.stringify(userObj));
        localStorage.setItem("sp_user", JSON.stringify(userObj));

        if (onLogin) {
          onLogin(userObj);
        } else {
          setLoginStep("teacher-dashboard");
        }
      } catch (err) {
        console.error("Teacher login error:", err);
        setRoleError("Network error. Please try again later.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- Student Login ---
    if (role === "STUDENT") {
      const uName = roleUsername.trim();
      const pwd = rolePassword.trim();

      if (!uName || !pwd) {
        setRoleError("Please enter both Student ID and Password.");
        setLoading(false);
        return;
      }

      if (uName !== pwd) {
        setRoleError("Student ID and password must match.");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/students/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: uName, password: pwd }),
        });

        const data = await res.json();

        if (!res.ok) {
          setRoleError(data.error || "Invalid Student ID or password.");
          setLoading(false);
          return;
        }

        const userObj = {
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
          school_name: data.student.school_name,
        };
        sessionStorage.setItem("sp_user", JSON.stringify(userObj));
        localStorage.setItem("sp_user", JSON.stringify(userObj));

        if (onLogin) {
          onLogin(userObj);
        } else {
          setLoginStep("student-dashboard");
        }
      } catch (err) {
        console.error("Student login error:", err);
        setRoleError("Network error. Please try again later.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- Parent Login ---
    if (role === "PARENT") {
      const uName = roleUsername.trim();
      const pwd = rolePassword.trim();

      if (!uName || !pwd) {
        setRoleError("Please enter Student ID and Password.");
        setLoading(false);
        return;
      }

      if (uName !== pwd) {
        setRoleError("Parent ID and password must match (use Student ID).");
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/students/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: uName, password: pwd }),
        });

        const data = await res.json();

        if (!res.ok) {
          setRoleError(data.error || "Invalid Student ID or password.");
          setLoading(false);
          return;
        }

        const userObj = {
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
          school_name: data.student.school_name,
        };
        sessionStorage.setItem("sp_user", JSON.stringify(userObj));
        localStorage.setItem("sp_user", JSON.stringify(userObj));

        if (onLogin) {
          onLogin(userObj);
        } else {
          setLoginStep("parent-dashboard");
        }
      } catch (err) {
        console.error("Parent login error:", err);
        setRoleError("Network error. Please try again later.");
      } finally {
        setLoading(false);
      }
      return;
    }
  };

  /**
   * 🌟 Pure Un-shadowed Canvas Blend Layout:
   * 1. LEFT SIDE (50%): Clean, un-shadowed hero image sitting directly on pure white canvas (no drop-shadows & no colored aura blobs)
   * 2. RIGHT SIDE (50%): Clean Credentials Login Form
   */
  const renderLoginForm = (
    title,
    emoji,
    roleAssetImg,
    panelBgColor,
    accentColor,
    onSubmit,
    children,
    errorMessage,
    showHeroImage = true,
  ) => (
    <div style={{ width: "100%", background: "#ffffff" }}>
      <div
        className={`fullscreen-split-layout${showHeroImage ? "" : " fullscreen-split-layout--no-image"}`}
      >
        {/* 👈 LEFT SIDE (50%): Hero Image sitting directly on white canvas */}
        {showHeroImage && <div className="slide-in-left left-image-half">
          <img
            src={roleAssetImg}
            alt={`${title} Full Hero Illustration`}
            className="full-hero-image"
          />
        </div>}

        {/* 👉 RIGHT SIDE (50%): Clean Credentials Login Form */}
        <div className="slide-in-right right-form-half">
          {/* Header Title & Subtitle */}
          <div style={customStyles.formHeaderGroup}>
            <div style={customStyles.welcomeTitleRow}>
              <span style={{ fontSize: "32px" }}>{emoji}</span>
              <h2 style={customStyles.welcomeTitle}>Welcome Back</h2>
            </div>
            <p style={customStyles.welcomeSubtitle}>
              Please sign in with your credentials to access the {title}{" "}
              workspace.
            </p>
          </div>

          {/* Clean Credentials Form */}
          <form onSubmit={onSubmit} style={customStyles.formStack}>
            {children}

            {errorMessage && (
              <div style={customStyles.alertError} role="alert">
                <span style={{ fontSize: "16px" }}>⚠️</span>
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Rounded Pill Action Buttons */}
            <div style={customStyles.formActionsRow}>
              <button
                type="button"
                onClick={handleBack}
                className="btn-pill-secondary"
              >
                Back to Roles
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  background: accentColor,
                }}
                className="btn-pill-primary"
              >
                {loading ? (
                  <>
                    <span className="spinner" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In →</span>
                )}
              </button>
            </div>
          </form>

          <footer style={customStyles.formFooter}>
            <span
              style={{ fontSize: "12px", color: "var(--color-text-muted)" }}
            >
              🔒 Protected by SPECTROPY SSO Portal Security
            </span>
          </footer>
        </div>
      </div>
    </div>
  );

  // --- School Owner Login Sub-View ---
  if (loginStep === "owner-login") {
    return renderLoginForm(
      "School Owner",
      "🏫",
      ownerImg,
      "#f0fdf4",
      "#16a34a",
      handleOwnerLogin,
      <>
        <div style={customStyles.inputFieldGroup}>
          <label style={customStyles.fieldLabel}>School ID (Username)</label>
          <div style={customStyles.inputWithIcon}>
            <span style={customStyles.inputIcon}>🏫</span>
            <input
              type="text"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value.toUpperCase())}
              placeholder="e.g., TS2501"
              style={customStyles.inputControl}
              autoFocus
              required
            />
            {schoolId && (
              <button
                type="button"
                onClick={() => setSchoolId("")}
                style={customStyles.clearInputBtn}
                title="Clear"
              >
                ✕
              </button>
            )}
          </div>
          <span style={customStyles.fieldHelp}>
            Format: 2-letter state code + 4 digits (e.g. TS2501)
          </span>
        </div>

        <div style={customStyles.inputFieldGroup}>
          <label style={customStyles.fieldLabel}>Password</label>
          <PasswordInput
            value={rolePassword}
            onChange={(e) => setRolePassword(e.target.value.toUpperCase())}
            placeholder="Enter School ID again"
          />
        </div>
      </>,
      schoolIdError,
    );
  }

  // --- Teacher Login Sub-View ---
  if (loginStep === "teacher-login") {
    return renderLoginForm(
      "Teacher",
      "👩‍🏫",
      teacherImg,
      "#eef2ff",
      "#4f46e5",
      handleRoleLogin("TEACHER"),
      <>
        <div style={customStyles.inputFieldGroup}>
          <label style={customStyles.fieldLabel}>Teacher ID / Username</label>
          <div style={customStyles.inputWithIcon}>
            <span style={customStyles.inputIcon}>👩‍🏫</span>
            <input
              type="text"
              value={roleUsername}
              onChange={(e) => setRoleUsername(e.target.value)}
              placeholder="Enter Teacher ID"
              style={customStyles.inputControl}
              autoFocus
              required
            />
            {roleUsername && (
              <button
                type="button"
                onClick={() => setRoleUsername("")}
                style={customStyles.clearInputBtn}
                title="Clear"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div style={customStyles.inputFieldGroup}>
          <label style={customStyles.fieldLabel}>Password</label>
          <PasswordInput
            value={rolePassword}
            onChange={(e) => setRolePassword(e.target.value)}
            placeholder="Enter password"
          />
        </div>
      </>,
      roleError,
    );
  }

  // --- Student Login Sub-View ---
  if (loginStep === "student-login") {
    return renderLoginForm(
      "Student",
      "🎓",
      studentImg,
      "#fffbeb",
      "#d97706",
      handleRoleLogin("STUDENT"),
      <>
        <div style={customStyles.inputFieldGroup}>
          <label style={customStyles.fieldLabel}>Student ID</label>
          <div style={customStyles.inputWithIcon}>
            <span style={customStyles.inputIcon}>🎓</span>
            <input
              type="text"
              value={roleUsername}
              onChange={(e) => setRoleUsername(e.target.value)}
              placeholder="Enter Student ID"
              style={customStyles.inputControl}
              autoFocus
              required
            />
            {roleUsername && (
              <button
                type="button"
                onClick={() => setRoleUsername("")}
                style={customStyles.clearInputBtn}
                title="Clear"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div style={customStyles.inputFieldGroup}>
          <label style={customStyles.fieldLabel}>Password</label>
          <PasswordInput
            value={rolePassword}
            onChange={(e) => setRolePassword(e.target.value)}
            placeholder="Enter password"
          />
        </div>
      </>,
      roleError,
    );
  }

  // --- Parent Login Sub-View ---
  if (loginStep === "parent-login") {
    return renderLoginForm(
      "Parent",
      "",
      parentImg,
      "#fff1f2",
      "#e11d48",
      handleRoleLogin("PARENT"),
      <>
        <div style={customStyles.inputFieldGroup}>
          <label style={customStyles.fieldLabel}>
            Student ID (Parent Access)
          </label>
          <div style={customStyles.inputWithIcon}>
            <span style={customStyles.inputIcon}>👨‍👩‍👧‍👦</span>
            <input
              type="text"
              value={roleUsername}
              onChange={(e) => setRoleUsername(e.target.value)}
              placeholder="Enter Child's Student ID"
              style={customStyles.inputControl}
              autoFocus
              required
            />
            {roleUsername && (
              <button
                type="button"
                onClick={() => setRoleUsername("")}
                style={customStyles.clearInputBtn}
                title="Clear"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div style={customStyles.inputFieldGroup}>
          <label style={customStyles.fieldLabel}>Password</label>
          <PasswordInput
            value={rolePassword}
            onChange={(e) => setRolePassword(e.target.value)}
            placeholder="Enter password"
          />
        </div>
      </>,
      roleError,
    );
  }

  // --- Admin Login Sub-View ---
  if (showAdminForm) {
    return renderLoginForm(
      "Super Admin",
      "🛡️",
      adminImg,
      "#eff6ff",
      "#2563eb",
      handleAdminSubmit,
      <>
        <div style={customStyles.inputFieldGroup}>
          <label style={customStyles.fieldLabel}>Admin Username</label>
          <div style={customStyles.inputWithIcon}>
            <span style={customStyles.inputIcon}>👤</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter admin username"
              style={customStyles.inputControl}
              autoFocus
              required
            />
            {username && (
              <button
                type="button"
                onClick={() => setUsername("")}
                style={customStyles.clearInputBtn}
                title="Clear"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div style={customStyles.inputFieldGroup}>
          <label style={customStyles.fieldLabel}>Admin Password</label>
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
          />
        </div>
      </>,
      error,
      false,
    );
  }

  // Role Definitions for Main Grid with Synchronized Role Colors
  const handleRoleClick = (roleKey) => {
    if (roleKey === ROLES.ADMIN) {
      setShowAdminForm(true);
    } else if (roleKey === ROLES.OWNER) {
      setLoginStep("owner-login");
    } else if (roleKey === ROLES.TEACHER) {
      setLoginStep("teacher-login");
    } else if (roleKey === ROLES.STUDENT) {
      setLoginStep("student-login");
    } else if (roleKey === ROLES.PARENT) {
      setLoginStep("parent-login");
    } else if (roleKey === ROLES.GUEST) {
      const userObj = { role: ROLES.GUEST };
      sessionStorage.setItem("sp_user", JSON.stringify(userObj));
      localStorage.setItem("sp_user", JSON.stringify(userObj));
      if (onLogin) {
        onLogin(userObj);
      } else {
        setLoginStep("guest-dashboard");
      }
    }
  };

  const roleOptions = [
    {
      key: ROLES.ADMIN,
      title: "Spectropy Admin",
      emoji: "🛠️",
      blurb: "Manage portals, schools & master database.",
      accent: "#2563eb",
      hoverBg: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)",
      iconBg: "#eff6ff",
      iconBorder: "#bfdbfe",
    },
    {
      key: ROLES.OWNER,
      title: "School Owner",
      emoji: "🏫",
      blurb: "View overall school performance & metrics.",
      accent: "#16a34a",
      hoverBg: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
      iconBg: "#f0fdf4",
      iconBorder: "#bbf7d0",
    },
    {
      key: ROLES.TEACHER,
      title: "Teacher Portal",
      emoji: "👩‍🏫",
      blurb: "Upload OMR results & generate report cards.",
      accent: "#4f46e5",
      hoverBg: "linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)",
      iconBg: "#eef2ff",
      iconBorder: "#c7d2fe",
    },
    {
      key: ROLES.STUDENT,
      title: "Student Portal",
      emoji: "🎓",
      blurb: "Check test scores, progress & rank cards.",
      accent: "#d97706",
      hoverBg: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
      iconBg: "#fffbeb",
      iconBorder: "#fde68a",
    },
    {
      key: ROLES.PARENT,
      title: "Parent Portal",
      emoji: "👨‍👩‍👧‍👦",
      blurb: "Track child academic growth & reports.",
      accent: "#e11d48",
      hoverBg: "linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)",
      iconBg: "#fff1f2",
      iconBorder: "#fecdd3",
    },
    {
      key: ROLES.GUEST,
      title: "Guest Access",
      emoji: "👤",
      blurb: "Explore system features with sample data.",
      accent: "#475569",
      hoverBg: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
      iconBg: "#f8fafc",
      iconBorder: "#e2e8f0",
    },
  ];

  return (
    <div style={customStyles.whitePageWrap} className="animate-fade-in">
      <div style={customStyles.portalCard}>
        <header style={customStyles.headerSection}>
          <h1 style={customStyles.mainHeading}>SPECTROPY — Portal Login</h1>
          <p style={customStyles.mainSubheading}>
            Select your role to access your portal workspace
          </p>
        </header>

        {/* Multi-Login Cards Grid */}
        <div className="role-card-grid" role="list">
          {roleOptions.map(
            ({
              key,
              title,
              emoji,
              blurb,
              accent,
              hoverBg,
              iconBg,
              iconBorder,
            }) => (
              <div
                key={key}
                className="role-card"
                style={{
                  "--card-accent": accent,
                  "--card-hover-bg": hoverBg,
                  "--icon-bg": iconBg,
                  "--icon-border": iconBorder,
                }}
                role="button"
                tabIndex={0}
                onClick={() => handleRoleClick(key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleRoleClick(key);
                  }
                }}
                aria-label={`Login as ${title}`}
              >
                <div className="role-icon-box">
                  <span>{emoji}</span>
                </div>
                <h3 className="role-card-title">{title}</h3>
                <p className="role-card-blurb">{blurb}</p>
                <div className="role-action-btn">
                  <span>Access Portal</span>
                  <span>→</span>
                </div>
              </div>
            ),
          )}
        </div>

        <footer style={customStyles.mainFooter}>
          <p style={customStyles.footerLinkText}>
            Need assistance? Visit{" "}
            <a
              href="https://spectropy.com"
              target="_blank"
              rel="noreferrer"
              style={customStyles.link}
            >
              spectropy.com
            </a>{" "}
            or contact portal support.
          </p>
        </footer>
      </div>
    </div>
  );
}

// 🔑 Accessible Password Input Component
function PasswordInput({ value, onChange, placeholder }) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div style={customStyles.passwordWrapper}>
      <span style={customStyles.inputIcon}>🔑</span>
      <input
        type={showPassword ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...customStyles.inputControl, paddingRight: "44px" }}
        required
      />
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        style={customStyles.eyeToggleBtn}
        aria-label={showPassword ? "Hide password" : "Show password"}
        title={showPassword ? "Hide password" : "Show password"}
      >
        {showPassword ? "🙈" : "👁️"}
      </button>
    </div>
  );
}

// 🎨 Clean Styles (No drop shadow, no background aura blob)
const customStyles = {
  whitePageWrap: {
    minHeight: "calc(100vh - 65px)",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#ffffff",
    boxSizing: "border-box",
    flex: 1,
  },
  portalCard: {
    width: "100%",
    maxWidth: "940px",
    minHeight: "clamp(480px, 75vh, 640px)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    background: "#ffffff",
    border: "1px solid var(--color-border)",
    borderRadius: "18px",
    padding: "clamp(16px, 3vw, 28px)",
    boxShadow:
      "0 12px 30px -6px rgba(15, 23, 42, 0.08), 0 4px 12px -2px rgba(15, 23, 42, 0.04)",
  },

  formHeaderGroup: {
    marginBottom: "28px",
  },
  welcomeTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  welcomeTitle: {
    margin: 0,
    fontSize: "clamp(28px, 3.5vw, 38px)",
    fontWeight: 800,
    color: "#0f172a",
    letterSpacing: "-0.6px",
  },
  welcomeSubtitle: {
    margin: "8px 0 0",
    fontSize: "14px",
    color: "var(--color-text-muted)",
    lineHeight: 1.5,
  },

  headerSection: {
    textAlign: "center",
    marginBottom: "clamp(18px, 2.5vw, 28px)",
    paddingBottom: "14px",
    borderBottom: "1px solid var(--color-border)",
  },
  mainHeading: {
    margin: 0,
    fontSize: "clamp(18px, 2.5vw, 24px)",
    fontWeight: 800,
    color: "var(--color-text-main)",
    letterSpacing: "0.3px",
  },
  mainSubheading: {
    marginTop: "6px",
    fontSize: "clamp(12px, 1.5vw, 13.5px)",
    color: "var(--color-text-muted)",
  },
  inputFieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  fieldLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--color-text-main)",
  },
  inputWithIcon: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  inputIcon: {
    position: "absolute",
    left: "14px",
    fontSize: "16px",
    pointerEvents: "none",
  },
  inputControl: {
    paddingLeft: "42px",
    minHeight: "46px",
    fontSize: "14.5px",
  },
  clearInputBtn: {
    position: "absolute",
    right: "12px",
    background: "none",
    border: "none",
    fontSize: "14px",
    color: "var(--color-text-subtle)",
    cursor: "pointer",
    padding: "4px",
  },
  fieldHelp: {
    fontSize: "11.5px",
    color: "var(--color-text-muted)",
  },
  passwordWrapper: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  eyeToggleBtn: {
    position: "absolute",
    right: "8px",
    top: "50%",
    transform: "translateY(-50%)",
    background: "transparent",
    border: "none",
    fontSize: "16px",
    cursor: "pointer",
    padding: "6px",
    minWidth: "36px",
    minHeight: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "6px",
  },
  alertError: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    background: "var(--danger-bg)",
    border: "1px solid var(--danger-border)",
    borderRadius: "10px",
    color: "var(--danger-text)",
    fontSize: "13px",
    lineHeight: 1.4,
  },
  formStack: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  formActionsRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginTop: "8px",
  },
  formFooter: {
    marginTop: "24px",
    textAlign: "left",
  },
  mainFooter: {
    marginTop: "18px",
    paddingTop: "14px",
    borderTop: "1px solid var(--color-border)",
    textAlign: "center",
  },
  footerLinkText: {
    margin: 0,
    fontSize: "12px",
    color: "var(--color-text-muted)",
  },
  link: {
    color: "var(--primary-600)",
    textDecoration: "underline",
    fontWeight: 500,
  },
};

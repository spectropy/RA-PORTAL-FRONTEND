import React, { useState } from "react";

const STATES = {
  "Andhra Pradesh": "AP",
  "Arunachal Pradesh": "AR",
  Assam: "AS",
  Bihar: "BR",
  Chhattisgarh: "CG",
  Goa: "GA",
  Gujarat: "GJ",
  Haryana: "HR",
  "Himachal Pradesh": "HP",
  Jharkhand: "JH",
  Karnataka: "KA",
  Kerala: "KL",
  "Madhya Pradesh": "MP",
  Maharashtra: "MH",
  Manipur: "MN",
  Meghalaya: "ML",
  Mizoram: "MZ",
  Nagaland: "NL",
  Odisha: "OD",
  Punjab: "PB",
  Rajasthan: "RJ",
  Sikkim: "SK",
  "Tamil Nadu": "TN",
  Telangana: "TS",
  Tripura: "TR",
  "Uttar Pradesh": "UP",
  Uttarakhand: "UK",
  "West Bengal": "WB",
  "Andaman & Nicobar Islands": "AN",
  Chandigarh: "CH",
  "Dadra & Nagar Haveli and Daman & Diu": "DN",
  Delhi: "DL",
  "Jammu & Kashmir": "JK",
  Ladakh: "LA",
  Lakshadweep: "LD",
  Puducherry: "PY",
};

const ACADEMIC_YEARS = ["2025-2026", "2026-2027"];

function yy(ay) {
  if (!ay) return "";
  const start = ay.split("-")[0] || "";
  return start.slice(-2);
}

export default function SchoolForm({
  onSubmit,
  onCancel,
  existingSchools = [],
}) {
  const [name, setName] = useState("");
  const [state, setState] = useState("");
  const [ay, setAy] = useState(ACADEMIC_YEARS[0]);
  const [area, setArea] = useState("");
  const [district, setDistrict] = useState("");
  const [schoolNum, setSchoolNum] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [alertMsg, setAlertMsg] = useState("");

  const abbr = STATES[state] || "";
  const num2 = (() => {
    const onlyDigits = (schoolNum || "").replace(/\D/g, "").slice(0, 2);
    if (!onlyDigits) return "";
    const v = parseInt(onlyDigits, 10);
    if (!Number.isFinite(v) || v < 1 || v > 99) return "";
    return String(v).padStart(2, "0");
  })();
  const schoolId = abbr && yy(ay) && num2 ? `${abbr}${yy(ay)}${num2}` : "";

  function handleSubmit(e) {
    e.preventDefault();
    if (!name || !state || !ay || !num2 || !schoolId) {
      setAlertMsg(
        "Please fill School Name, Academic Year, State, and a valid 2-digit School Number (01-99).",
      );
      return;
    }
    const isDuplicate = existingSchools.some(
      (school) => school.school_id === schoolId,
    );
    if (isDuplicate) {
      setAlertMsg(`A school with SCHOOL_ID "${schoolId}" already exists.`);
      return;
    }
    onSubmit?.({
      school_name: name,
      state,
      academic_year: ay,
      area,
      district,
      logo_url: logoUrl,
      school_number_2d: num2,
      school_id: schoolId,
      classes: [],
      teachers: [],
    });
    setAlertMsg("");
    setName("");
    setArea("");
    setDistrict("");
    setSchoolNum("");
    setLogoUrl("");
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: "100%" }}>
      {alertMsg && (
        <div
          className="alert-banner alert-banner--error"
          style={{ marginBottom: 16 }}
        >
          <span className="alert-banner-icon">⚠️</span>
          <span>{alertMsg}</span>
        </div>
      )}

      {/* Section 1: School Name & Identification */}
      <div className="ct-section">
        <div className="ct-section-title">📋 School Information &amp; ID</div>

        {/* Row 1: School Name & School Logo */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          <div className="form-field">
            <label className="form-label" htmlFor="school-name">
              School Name *
            </label>
            <input
              id="school-name"
              className="form-input"
              type="text"
              placeholder="e.g. Hyderabad Public School"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setAlertMsg("");
              }}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="school-logo">
              School Logo (URL or Upload Image)
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                id="school-logo"
                className="form-input"
                type="text"
                placeholder="Paste Image URL or select file..."
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                style={{ flex: 1 }}
              />
              <label
                className="btn btn-outline"
                style={{
                  padding: "8px 12px",
                  fontSize: 13,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                🖼️ Upload
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => setLogoUrl(ev.target.result);
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              {logoUrl && (
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    style={{
                      height: 38,
                      width: 38,
                      objectFit: "contain",
                      borderRadius: 6,
                      border: "1px solid #cbd5e1",
                      background: "#fff",
                      padding: 2,
                    }}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    title="Remove logo"
                    style={{
                      position: "absolute",
                      top: -6,
                      right: -6,
                      background: "#ef4444",
                      color: "#fff",
                      border: "none",
                      borderRadius: "50%",
                      width: 18,
                      height: 18,
                      fontSize: 10,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                    }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Below School Name -> Academic Year, School Number, Auto-Generated ID */}
        <div className="form-grid-3">
          <div className="form-field">
            <label className="form-label" htmlFor="school-ay">
              Academic Year *
            </label>
            <select
              id="school-ay"
              className="form-input"
              value={ay}
              onChange={(e) => {
                setAy(e.target.value);
                setAlertMsg("");
              }}
              required
            >
              {ACADEMIC_YEARS.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="school-num">
              School Number (2 Digits: 01-99) *
            </label>
            <input
              id="school-num"
              className="form-input"
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="e.g. 01"
              value={schoolNum}
              onChange={(e) => {
                setSchoolNum(e.target.value);
                setAlertMsg("");
              }}
              required
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="school-id">
              Auto-Generated School ID
            </label>
            <input
              id="school-id"
              className="form-input"
              type="text"
              value={schoolId}
              readOnly
              placeholder="Auto-generated (e.g. TS2501)"
              style={{ backgroundColor: "#f1f5f9", fontWeight: 700 }}
            />
          </div>
        </div>
      </div>

      {/* Section 2: Address & Location Details (State placed with Area and District) */}
      <div className="ct-section">
        <div className="ct-section-title">📍 Address &amp; Location</div>
        <div className="form-grid-3">
          <div className="form-field">
            <label className="form-label" htmlFor="school-state">
              State *
            </label>
            <select
              id="school-state"
              className="form-input"
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setAlertMsg("");
              }}
              required
            >
              <option value="">— Select State —</option>
              {Object.keys(STATES).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="school-area">
              Area / Address Line
            </label>
            <input
              id="school-area"
              className="form-input"
              type="text"
              placeholder="e.g. Begumpet, Main Road"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>

          <div className="form-field">
            <label className="form-label" htmlFor="school-district">
              District
            </label>
            <input
              id="school-district"
              className="form-input"
              type="text"
              placeholder="e.g. Hyderabad"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="form-actions" style={{ marginTop: 20 }}>
        <button type="submit" className="btn btn-primary">
          🏫 Add School
        </button>
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <p className="form-help" style={{ marginTop: 12 }}>
        Format: <b>STATE_ABBR + YY + NN</b> — e.g. TS + 25 + 01 → <b>TS2501</b>
      </p>
    </form>
  );
}

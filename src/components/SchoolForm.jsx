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

const ACADEMIC_YEARS = [
  "2025-2026",
  "2026-2027",
  "2027-2028",
  "2028-2029",
  "2029-2030",
  "2030-2031",
  "2031-2032",
];

const SUPPORTED_LOGO_TYPES = ["image/png", "image/jpeg"];
const SUPPORTED_LOGO_EXTENSIONS = [".png", ".jpg", ".jpeg"];
const MAX_LOGO_SIZE_BYTES = 100 * 1024;

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
    <form className="school-form" onSubmit={handleSubmit}>
      {alertMsg && (
        <div className="alert-banner alert-banner--error school-form-alert">
          <span className="alert-banner-icon">!</span>
          <span>{alertMsg}</span>
        </div>
      )}

      <section className="school-form-section">
        <div className="school-form-section-title">School Information & ID</div>

        <div className="school-form-grid school-form-grid--main">
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
              School Logo
            </label>
            <div className="school-logo-input-row">
              <input
                id="school-logo"
                className="form-input"
                type="text"
                placeholder="Paste image URL or select a file"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
              <label className="btn btn-outline school-logo-upload-btn">
                Upload
                <input
                  type="file"
                  accept={SUPPORTED_LOGO_EXTENSIONS.join(",")}
                  className="school-logo-file-input"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const fileName = file.name.toLowerCase();
                      const hasSupportedExtension =
                        SUPPORTED_LOGO_EXTENSIONS.some((ext) =>
                          fileName.endsWith(ext),
                        );
                      const hasSupportedType = SUPPORTED_LOGO_TYPES.includes(
                        file.type,
                      );

                      if (!hasSupportedType || !hasSupportedExtension) {
                        setAlertMsg(
                          "Unsupported logo format. Please upload PNG, JPG, or JPEG only.",
                        );
                        e.target.value = "";
                        return;
                      }

                      if (file.size > MAX_LOGO_SIZE_BYTES) {
                        setAlertMsg(
                          "Logo file is too large. Please upload a PNG, JPG, or JPEG under 100 KB.",
                        );
                        e.target.value = "";
                        return;
                      }

                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        setLogoUrl(ev.target.result);
                        setAlertMsg("");
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
              {logoUrl && (
                <div className="school-logo-preview-wrap">
                  <img
                    src={logoUrl}
                    alt="Logo preview"
                    className="school-logo-preview"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setLogoUrl("")}
                    title="Remove logo"
                    className="school-logo-remove"
                  >
                    X
                  </button>
                </div>
              )}
            </div>
            <p className="form-help" style={{ marginTop: 6 }}>
              Supported logo formats: PNG, JPG, JPEG. Maximum size: 100 KB.
            </p>
          </div>
        </div>

        <div className="school-form-grid school-form-grid--three">
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
              School Number *
            </label>
            <input
              id="school-num"
              className="form-input"
              type="text"
              inputMode="numeric"
              maxLength={2}
              placeholder="01-99"
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
              className="form-input school-id-preview-input"
              type="text"
              value={schoolId}
              readOnly
              placeholder="Auto-generated, e.g. TS2501"
            />
          </div>
        </div>
      </section>

      <section className="school-form-section">
        <div className="school-form-section-title">Address & Location</div>
        <div className="school-form-grid school-form-grid--three">
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
              <option value="">-- Select State --</option>
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
      </section>

      <div className="form-actions school-form-actions">
        <button type="submit" className="btn btn-primary">
          Add School
        </button>
        {onCancel && (
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      <p className="form-help school-form-help">
        Format: <b>STATE_ABBR + YY + NN</b> - e.g. TS + 25 + 01 = <b>TS2501</b>
      </p>
    </form>
  );
}

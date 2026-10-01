import React, { useEffect, useState } from "react";
import { getSchools } from "../api";

export default function CsmSchoolSelection({ onSelect }) {
  const [schools, setSchools] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getSchools().then((data) => {
      if (active) setSchools(data);
    }).catch(() => {
      if (active) setError("Unable to load schools. Please try again.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [attempt]);

  const label = (school) => `${school.school_name || "Unnamed School"} — ${school.school_id}`;
  const matches = schools.filter((school) => label(school).toLowerCase().includes(query.trim().toLowerCase()));
  const selected = schools.find((school) => school.school_id === selectedId);

  return (
    <section style={{ width: "min(560px, calc(100% - 32px))", margin: "32px auto", padding: 28,
      background: "#fff", border: "1px solid var(--color-border)", borderRadius: 16 }}>
      <h1 style={{ marginTop: 0 }}>Select School</h1>
      <p style={{ color: "var(--color-text-muted)" }}>Search for a school to open its dashboard.</p>
      {loading ? <p role="status">Loading schools...</p> : error ? (
        <div role="alert"><p>{error}</p><button className="btn btn-outline" onClick={() => setAttempt(attempt + 1)}>Retry</button></div>
      ) : (
        <form onSubmit={(event) => { event.preventDefault(); if (selected) onSelect(selected); }}>
          <label htmlFor="csm-school-search">School name or School ID</label>
          <div style={{ position: "relative", marginTop: 8 }}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
            <input id="csm-school-search" type="text" role="combobox" autoComplete="off"
              aria-expanded={open} aria-controls="csm-school-options" aria-autocomplete="list"
              placeholder="Search schools..." value={query} style={{ width: "100%" }}
              onFocus={() => setOpen(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setOpen(false);
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setOpen(true);
                  requestAnimationFrame(() => document.querySelector("#csm-school-options button")?.focus());
                }
              }}
              onChange={(event) => { setQuery(event.target.value); setSelectedId(""); setOpen(true); }} />
            {open && (
              <div id="csm-school-options" role="listbox" aria-label="Schools"
                style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--color-border)", borderRadius: 8, marginTop: 4 }}>
                {matches.length ? matches.map((school) => (
                  <button key={school.school_id} type="button" role="option"
                    aria-selected={selectedId === school.school_id}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: 12, border: 0, background: "#f8fafc", cursor: "pointer" }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                        event.preventDefault();
                        (event.key === "ArrowDown" ? event.currentTarget.nextElementSibling : event.currentTarget.previousElementSibling)?.focus();
                      }
                      if (event.key === "Escape") { document.getElementById("csm-school-search")?.focus(); setOpen(false); }
                    }}
                    onClick={() => { setSelectedId(school.school_id); setQuery(label(school)); document.getElementById("csm-school-search")?.focus(); setOpen(false); }}>
                    {label(school)}
                  </button>
                )) : <p role="status" style={{ padding: 12 }}>{schools.length ? "No matching schools." : "No schools available."}</p>}
              </div>
            )}
          </div>
          <button type="submit" className="btn btn-primary" disabled={!selected} style={{ marginTop: 24 }}>Open Dashboard</button>
        </form>
      )}
    </section>
  );
}

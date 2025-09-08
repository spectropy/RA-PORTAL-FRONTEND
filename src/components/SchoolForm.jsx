import React, { useEffect, useMemo, useRef, useState } from 'react'

const STATES = {
  "Andhra Pradesh": "AP", "Arunachal Pradesh": "AR", "Assam": "AS", "Bihar": "BR",
  "Chhattisgarh": "CG", "Goa": "GA", "Gujarat": "GJ", "Haryana": "HR", "Himachal Pradesh": "HP",
  "Jharkhand": "JH", "Karnataka": "KA", "Kerala": "KL", "Madhya Pradesh": "MP", "Maharashtra": "MH",
  "Manipur": "MN", "Meghalaya": "ML", "Mizoram": "MZ", "Nagaland": "NL", "Odisha": "OD",
  "Punjab": "PB", "Rajasthan": "RJ", "Sikkim": "SK", "Tamil Nadu": "TN", "Telangana": "TS",
  "Tripura": "TR", "Uttar Pradesh": "UP", "Uttarakhand": "UK", "West Bengal": "WB",
  "Andaman & Nicobar Islands": "AN", "Chandigarh": "CH", "Dadra & Nagar Haveli and Daman & Diu": "DN",
  "Delhi": "DL", "Jammu & Kashmir": "JK", "Ladakh": "LA", "Lakshadweep": "LD", "Puducherry": "PY"
}

const ACADEMIC_YEARS = ["2025-2026", "2026-2027"]
const GRADE_OPTIONS = Array.from({ length: 12 }, (_, i) => `GRADE-${i + 1}`)
const FOUNDATION_OPTIONS = ["IIT-MED", "IIT", "MED", "FF"]
const PROGRAM_OPTIONS = ["CAT", "MAE", "PIO"]
const GROUP_OPTIONS = ["PCM", "PCB", "PCMB"]
const SECTION_OPTIONS = "ABCDEF".split("")

// Subject mapping per foundation
const FOUNDATION_SUBJECTS = {
  "IIT-MED": ["Physics", "Chemistry", "Mathematics", "Biology"],
  "IIT":     ["Physics", "Chemistry", "Mathematics"],
  "MED":     ["Physics", "Chemistry", "Biology"],
  "FF":      ["Physics", "Chemistry", "Mathematics", "Biology"], // fallback
}

function yy(ay) {
  if (!ay) return ''
  const start = ay.split('-')[0] || ''
  return start.slice(-2)
}

// ===== Helpers =====
function getNextSectionForGrade(grade, classes) {
  const used = new Set(
    classes.filter(c => c.class === grade).map(c => c.section)
  )
  for (const ch of SECTION_OPTIONS) if (!used.has(ch)) return ch
  return "A"
}
function forcedGroupForFoundation(foundation) {
  if (foundation === "IIT-MED") return "PCMB"
  if (foundation === "IIT") return "PCM"
  if (foundation === "MED") return "PCB"
  return null
}

export default function SchoolForm({ onSubmit }) {
  // ===== School fields =====
  const [name, setName] = useState('')
  const [state, setState] = useState('')
  const [ay, setAy] = useState(ACADEMIC_YEARS[0])
  const [area, setArea] = useState('')
  const [district, setDistrict] = useState('')
  const [schoolNum, setSchoolNum] = useState('') // NN (01–99)

  const abbr = STATES[state] || ''
  const num2 = (() => {
    const onlyDigits = (schoolNum || '').replace(/\D/g, '').slice(0, 2)
    if (!onlyDigits) return ''
    const v = parseInt(onlyDigits, 10)
    if (!Number.isFinite(v) || v < 1 || v > 99) return ''
    return String(v).padStart(2, '0')
  })()
  const schoolId = (abbr && yy(ay) && num2) ? `${abbr}${yy(ay)}${num2}` : ''

  // ===== Classes builder =====
  const [classes, setClasses] = useState([])
  const [grade, setGrade] = useState(GRADE_OPTIONS[0])
  const [foundation, setFoundation] = useState(FOUNDATION_OPTIONS[0])
  const [program, setProgram] = useState(PROGRAM_OPTIONS[0])
  const [group, setGroup] = useState(GROUP_OPTIONS[0])
  const [section, setSection] = useState('A')
  const [numStudents, setNumStudents] = useState('') // numeric

  // Auto-pick next section when grade changes or classes list updates
  useEffect(() => {
    if (!grade) return
    setSection(getNextSectionForGrade(grade, classes))
  }, [grade, classes])

  // Lock group when foundation is IIT-MED / IIT / MED
  useEffect(() => {
    const forced = forcedGroupForFoundation(foundation)
    if (forced) setGroup(forced)
  }, [foundation])

  function addClassRow(e) {
    e?.preventDefault?.()
    const n = parseInt((numStudents || '').replace(/\D/g, ''), 10)
    if (!Number.isFinite(n) || n <= 0) {
      alert('Enter a valid Number of Students (> 0)')
      return
    }
    // prevent duplicate Grade+Section
    const dup = classes.some(c => c.class === grade && c.section === section)
    if (dup) {
      alert(`Section ${section} for ${grade} already exists. Pick a different section.`)
      return
    }
    // ensure group follows forced mapping at save time too
    const finalGroup = forcedGroupForFoundation(foundation) || group
    const row = { class: grade, foundation, program, group: finalGroup, section, num_students: n }
    setClasses(prev => [...prev, row])
    setNumStudents('')
    // Prefill next available section for convenience
    const next = getNextSectionForGrade(grade, [...classes, row])
    setSection(next)
  }
  function removeClassRow(idx) {
    setClasses(prev => prev.filter((_, i) => i !== idx))
  }

  // Build dynamic options for Teachers (from classes above):
  // CONCAT(Class, Section, Subject) with Subjects determined by each class's foundation
  const assignOptions = useMemo(() => {
    const opts = []
    for (const c of classes) {
      const subs = FOUNDATION_SUBJECTS[c.foundation] || FOUNDATION_SUBJECTS.FF
      for (const sub of subs) {
        opts.push({
          key: `${c.class}-${c.section}-${sub}`,
          class: c.class,
          section: c.section,
          subject: sub,
          label: `${c.class} • ${c.section} • ${sub}`,
        })
      }
    }
    // sort by class, then section, then subject
    return opts.sort((a,b)=>{
      const ca = a.class.localeCompare(b.class)
      if (ca !== 0) return ca
      const sa = a.section.localeCompare(b.section)
      if (sa !== 0) return sa
      return a.subject.localeCompare(b.subject)
    })
  }, [classes])

  // ===== Teachers builder =====
  const [teachers, setTeachers] = useState([])
  const [tName, setTName] = useState('')
  const [tContact, setTContact] = useState('')
  const [tEmail, setTEmail] = useState('')
  const [tAssignments, setTAssignments] = useState([]) // array of { class, section, subject, key }

  function addTeacherRow(e) {
    e?.preventDefault?.()
    if (!tName.trim()) return alert('Enter teacher name')
    if (tEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tEmail)) {
      return alert('Enter a valid email or leave empty')
    }
    if (tAssignments.length === 0) {
      return alert('Select at least one (Class • Section • Subject) assignment')
    }
    if (!schoolId) {
      return alert('School ID must be generated before adding teachers.')
    }

    // Generate next teacher number (01-99)
    const existingTeacherNumbers = teachers
      .map(t => t.teacherId?.slice(-2)) // get last 2 digits
      .filter(n => /^\d{2}$/.test(n))
      .map(n => parseInt(n, 10))
      .filter(n => n >= 1 && n <= 99)

    let nextNumber = 1
    while (nextNumber <= 99 && existingTeacherNumbers.includes(nextNumber)) {
      nextNumber++
    }

    if (nextNumber > 99) {
      return alert('Maximum 99 teachers allowed per school.')
    }

    const teacherId = `${schoolId}${String(nextNumber).padStart(2, '0')}`

    const row = {
      teacherId, // <-- NEW: Unique ID for teacher
      name: tName.trim(),
      contact: tContact.trim(),
      email: tEmail.trim(),
      assignments: tAssignments.map(a => ({ class: a.class, section: a.section, subject: a.subject }))
    }
    setTeachers(prev => [...prev, row])

    // reset row inputs
    setTName(''); setTContact(''); setTEmail(''); setTAssignments([])
  }

  function removeTeacherRow(idx) {
    setTeachers(prev => prev.filter((_, i) => i !== idx))
  }

  // ===== Submit =====
  function handleSubmit(e) {
    e.preventDefault()
    if (!name || !state || !ay || !num2 || !schoolId) {
      return alert('Please fill School Name, State, Academic Year, and a valid 2-digit School Number (01–99).')
    }
    onSubmit?.({
      school_name: name,
      state,
      academic_year: ay,
      area,
      district,
      school_number_2d: num2,
      school_id: schoolId,
      classes,
      teachers
    })
    // Clear for next entry
    setName(''); setArea(''); setDistrict(''); setSchoolNum('')
    setClasses([]); setGrade(GRADE_OPTIONS[0]); setFoundation(FOUNDATION_OPTIONS[0])
    setProgram(PROGRAM_OPTIONS[0]); setGroup(GROUP_OPTIONS[0]); setSection('A'); setNumStudents('')
    setTeachers([]); setTName(''); setTContact(''); setTEmail(''); setTAssignments([])
  }

  const forced = forcedGroupForFoundation(foundation)

  return (
    <form onSubmit={handleSubmit}>
      <h3 className="h3">Add School (Manual)</h3>

      {/* School core */}
      <div className="grid-2">
        <div>
          <label>School Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder='e.g., Geetha Shree High School, Jadcherla' />
        </div>
        <div>
          <label>State</label>
          <select value={state} onChange={e => setState(e.target.value)}>
            <option value='' disabled>Select State</option>
            {Object.keys(STATES).sort().map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 8 }}>
        <div>
          <label>Academic Year</label>
          <select value={ay} onChange={e => setAy(e.target.value)}>
            {ACADEMIC_YEARS.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label>School Number (01–99)</label>
          <input
            value={schoolNum}
            onChange={e => setSchoolNum(e.target.value)}
            inputMode="numeric"
            placeholder="e.g., 01"
            maxLength={2}
          />
          <div className="help">Used as the last 2 digits of SCHOOL_ID</div>
        </div>
        <div>
          <label>School ID (auto: STATE_ABBR + YY + NN)</label>
          <input value={schoolId} readOnly />
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 8 }}>
        <div>
          <label>Area (optional)</label>
          <input value={area} onChange={e => setArea(e.target.value)} placeholder='e.g., Shanti Nagar' />
        </div>
        <div>
          <label>District (optional)</label>
          <input value={district} onChange={e => setDistrict(e.target.value)} placeholder='e.g., Mahabubnagar' />
        </div>
      </div>

      {/* ===== Classes builder ===== */}
      <div className="section">
        <h4 className="h3" style={{ fontSize: 18 }}>Classes (add manually)</h4>

        <div className="grid-classes">
          <div>
            <label>CLASS (Grade)</label>
            <select value={grade} onChange={e => setGrade(e.target.value)}>
              {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label>FOUNDATION</label>
            <select value={foundation} onChange={e => setFoundation(e.target.value)}>
              {FOUNDATION_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label>PROGRAM</label>
            <select value={program} onChange={e => setProgram(e.target.value)}>
              {PROGRAM_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* GROUP (depends on foundation) */}
          <div>
            <label>GROUP</label>
            {forced ? (
              <input value={forced} readOnly />
            ) : (
              <select value={group} onChange={e => setGroup(e.target.value)}>
                {GROUP_OPTIONS.map(gp => <option key={gp} value={gp}>{gp}</option>)}
              </select>
            )}
          </div>

          {/* SECTION (auto-suggest next, editable) */}
          <div>
            <label>SECTION</label>
            <select value={section} onChange={e => setSection(e.target.value)}>
              {SECTION_OPTIONS.map(sec => <option key={sec} value={sec}>{sec}</option>)}
            </select>
          </div>

          <div>
            <label>Number of Students</label>
            <input
              type="number" min={1} step={1} value={numStudents}
              onChange={e => setNumStudents(e.target.value)} placeholder="e.g., 40"
            />
          </div>

          <div>
            <button className="btn btn-outline" type="button" onClick={addClassRow}>Add Class</button>
          </div>
        </div>

        <div className="table-wrap">
          {classes.length === 0 ? (
            <p style={{ padding: 10, margin: 0, color: '#666' }}>No classes added yet.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>CLASS</th>
                  <th>FOUNDATION</th>
                  <th>PROGRAM</th>
                  <th>GROUP</th>
                  <th>SECTION</th>
                  <th>NUMBER OF STUDENTS</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {classes.map((r, idx) => (
                  <tr key={idx}>
                    <td>{r.class}</td>
                    <td>{r.foundation}</td>
                    <td>{r.program}</td>
                    <td>{r.group}</td>
                    <td>{r.section}</td>
                    <td>{r.num_students}</td>
                    <td>
                      <button className="btn btn-outline" type="button" onClick={() => removeClassRow(idx)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ===== Teachers builder ===== */}
      <div className="section">
        <h4 className="h3" style={{ fontSize: 18 }}>Teachers (add manually)</h4>

        {assignOptions.length === 0 ? (
          <p style={{ margin: 0, color: '#666' }}>Add at least one Class above to choose assignments.</p>
        ) : (
          <>
            <div className="grid-teachers">
              <div>
                <label>Name</label>
                <input value={tName} onChange={e => setTName(e.target.value)} placeholder="e.g., S. Reddy" />
              </div>
              <div>
                <label>Contact</label>
                <input value={tContact} onChange={e => setTContact(e.target.value)} inputMode="tel" placeholder="e.g., 98xxxxxx10" />
              </div>
              <div>
                <label>Email</label>
                <input value={tEmail} onChange={e => setTEmail(e.target.value)} placeholder="e.g., s.reddy@school.com" />
              </div>

              {/* Multi-select dropdown for CONCAT(Class, Section, Subject) */}
              <div>
                <label>Allotment (Class • Section • Subject)</label>
                <MultiAssignDropdown
                  options={assignOptions}
                  value={tAssignments}
                  onChange={setTAssignments}
                />
              </div>

              <div>
                <button className="btn btn-outline" type="button" onClick={addTeacherRow}>Add Teacher</button>
              </div>
            </div>

            <div className="table-wrap">
              {teachers.length === 0 ? (
                <p style={{ padding: 10, margin: 0, color: '#666' }}>No teachers added yet.</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ID</th> {/* <-- NEW COLUMN */}
                      <th>NAME</th>
                      <th>CONTACT</th>
                      <th>EMAIL</th>
                      <th>ALLOTMENT</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((t, idx) => (
                      <tr key={idx}>
                        <td>{t.teacherId}</td> {/* <-- DISPLAY TEACHER ID */}
                        <td>{t.name}</td>
                        <td>{t.contact}</td>
                        <td>{t.email}</td>
                        <td>
                          {t.assignments.map((a,i)=>(
                            <span key={i} className="badge" style={{marginRight:6}}>
                              {a.class} • {a.section} • {a.subject}
                            </span>
                          ))}
                        </td>
                        <td>
                          <button className="btn btn-outline" type="button" onClick={() => removeTeacherRow(idx)}>Remove</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
      </div>

      {/* submit */}
      <div className="row">
        <button className="btn btn-primary" type='submit'>Add to List</button>
        <button className="btn btn-outline" type='button'
          onClick={()=>window.scrollTo({ top:0, behavior:'smooth' })}>
          Back to Top
        </button>
      </div>

      <p className="help" style={{ marginTop: 8 }}>
        SCHOOL_ID format: <b>STATE_ABBR + YY + NN</b> (e.g., TS + 25 + 01 → <b>TS2501</b>).<br/>
        TEACHER_ID format: <b>SCHOOL_ID + 01-99</b> (e.g., <b>TS250101</b>, <b>TS250102</b>, ...).
      </p>
    </form>
  )
}

/* ---------- MultiAssignDropdown (checkbox dropdown) ---------- */
function MultiAssignDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const ref = useRef(null)

  // close on outside click
  useEffect(() => {
    function onDoc(e){
      if (!ref.current) return
      if (!ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const selectedKeys = new Set(value.map(v => v.key))
  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(q.toLowerCase())
  )

  function toggle(opt){
    if (selectedKeys.has(opt.key)) {
      onChange(value.filter(v => v.key !== opt.key))
    } else {
      onChange([...value, opt])
    }
  }
  function clearAll(){
    onChange([])
  }

  return (
    <div className="multi" ref={ref}>
      <div
        className="multi-control"
        tabIndex={0}
        onClick={()=>setOpen(v=>!v)}
        onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') setOpen(v=>!v) }}
      >
        <div className="multi-value">
          {value.length === 0 ? (
            <span className="opt-muted">Select allotments…</span>
          ) : value.slice(0,3).map(v => (
            <span className="badge" key={v.key}>{v.class} • {v.section} • {v.subject}</span>
          ))}
          {value.length > 3 && (
            <span className="badge">+{value.length - 3}</span>
          )}
        </div>
        <span className="chev">▾</span>
      </div>

      {open && (
        <div className="multi-menu">
          <div className="multi-search">
            <input
              className="input"
              placeholder="Search class/section/subject…"
              value={q}
              onChange={e=>setQ(e.target.value)}
            />
          </div>

          <div className="multi-opt" onClick={clearAll} style={{cursor:'pointer'}}>
            <input type="checkbox" checked={value.length===0} readOnly />
            <span>Clear all</span>
          </div>
          <div className="divider"></div>

          {filtered.length === 0 ? (
            <div className="opt-muted" style={{padding:'6px 6px'}}>No matches</div>
          ) : filtered.map(opt => (
            <label key={opt.key} className="multi-opt" style={{cursor:'pointer'}}>
              <input
                type="checkbox"
                checked={selectedKeys.has(opt.key)}
                onChange={()=>toggle(opt)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
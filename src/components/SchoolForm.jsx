import React, { useState, useMemo } from 'react'

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
const SECTION_OPTIONS = ["A", "B", "C"]
const SUBJECT_OPTIONS = ["Maths", "Physics", "Biology", "Chemistry"]

function yy(ay) {
  if (!ay) return ''
  const start = ay.split('-')[0] || ''
  return start.slice(-2)
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
  const [section, setSection] = useState(SECTION_OPTIONS[0])
  const [numStudents, setNumStudents] = useState('') // numeric

  function addClassRow(e) {
    e?.preventDefault?.()
    const n = parseInt((numStudents || '').replace(/\D/g, ''), 10)
    if (!Number.isFinite(n) || n <= 0) {
      alert('Enter a valid Number of Students (> 0)')
      return
    }
    const row = { class: grade, foundation, program, group, section, num_students: n }
    setClasses(prev => [...prev, row])
    setNumStudents('')
  }
  function removeClassRow(idx) {
    setClasses(prev => prev.filter((_, i) => i !== idx))
  }

  // Build dynamic options for Teachers (from classes above)
  const classOptionsFromClasses = useMemo(() => {
    const set = new Set(classes.map(c => c.class))
    return Array.from(set)
  }, [classes])

  const sectionsByClass = useMemo(() => {
    const map = {}
    for (const c of classes) {
      map[c.class] = map[c.class] || new Set()
      map[c.class].add(c.section)
    }
    // convert sets to sorted arrays
    const out = {}
    for (const k of Object.keys(map)) out[k] = Array.from(map[k]).sort()
    return out
  }, [classes])

  // ===== Teachers builder =====
  const [teachers, setTeachers] = useState([])
  const [tName, setTName] = useState('')
  const [tContact, setTContact] = useState('')
  const [tEmail, setTEmail] = useState('')
  const [tSubject, setTSubject] = useState(SUBJECT_OPTIONS[0])
  const [tClass, setTClass] = useState('')      // selected class (from classes added)
  const [tSection, setTSection] = useState('')  // filtered by selected class

  // Update section options when class changes
  const teacherSectionOptions = tClass ? (sectionsByClass[tClass] || []) : []

  function addTeacherRow(e) {
    e?.preventDefault?.()
    if (!tName.trim()) return alert('Enter teacher name')
    if (!tClass) return alert('Pick a Class (add classes above first)')
    if (!tSection) return alert('Pick a Section for the selected Class')

    // (optional) simple email sanity
    if (tEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(tEmail)) {
      return alert('Enter a valid email or leave empty')
    }

    const row = {
      name: tName.trim(),
      contact: tContact.trim(),
      email: tEmail.trim(),
      subject: tSubject,
      class: tClass,
      section: tSection
    }
    setTeachers(prev => [...prev, row])

    // reset row inputs
    setTName(''); setTContact(''); setTEmail('')
    setTSubject(SUBJECT_OPTIONS[0])
    setTClass(''); setTSection('')
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

    onSubmit({
      school_name: name,
      state,
      academic_year: ay,
      area,
      district,
      school_number_2d: num2,
      school_id: schoolId,
      classes,   // [{ class, foundation, program, group, section, num_students }]
      teachers   // [{ name, contact, email, subject, class, section }]
    })

    // Clear for next entry
    setName(''); setArea(''); setDistrict(''); setSchoolNum('')
    setClasses([]); setGrade(GRADE_OPTIONS[0]); setFoundation(FOUNDATION_OPTIONS[0])
    setProgram(PROGRAM_OPTIONS[0]); setGroup(GROUP_OPTIONS[0]); setSection(SECTION_OPTIONS[0]); setNumStudents('')
    setTeachers([]); setTName(''); setTContact(''); setTEmail(''); setTSubject(SUBJECT_OPTIONS[0]); setTClass(''); setTSection('')
  }

  return (
    <form onSubmit={handleSubmit}>
      <h3 style={{ margin: '0 0 8px' }}>Add School (Manual)</h3>

      {/* School core */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
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
          <div style={{ fontSize: 12, color: '#666' }}>Used as the last 2 digits of SCHOOL_ID</div>
        </div>
        <div>
          <label>School ID (auto: STATE_ABBR + YY + NN)</label>
          <input value={schoolId} readOnly />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
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
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 8px' }}>Classes (add manually)</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
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
          <div>
            <label>GROUP</label>
            <select value={group} onChange={e => setGroup(e.target.value)}>
              {GROUP_OPTIONS.map(gp => <option key={gp} value={gp}>{gp}</option>)}
            </select>
          </div>
          <div>
            <label>SECTION</label>
            <select value={section} onChange={e => setSection(e.target.value)}>
              {SECTION_OPTIONS.map(sec => <option key={sec} value={sec}>{sec}</option>)}
            </select>
          </div>
          <div>
            <label>Number of Students</label>
            <input
              type="number"
              min={1}
              step={1}
              value={numStudents}
              onChange={e => setNumStudents(e.target.value)}
              placeholder="e.g., 40"
            />
          </div>
          <div>
            <button type="button" onClick={addClassRow}>Add Class</button>
          </div>
        </div>

        <div style={{ marginTop: 10, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 12 }}>
          {classes.length === 0 ? (
            <p style={{ padding: 10, margin: 0, color: '#666' }}>No classes added yet.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7fafc' }}>
                  <th style={th}>CLASS</th>
                  <th style={th}>FOUNDATION</th>
                  <th style={th}>PROGRAM</th>
                  <th style={th}>GROUP</th>
                  <th style={th}>SECTION</th>
                  <th style={th}>NUMBER OF STUDENTS</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {classes.map((r, idx) => (
                  <tr key={idx}>
                    <td style={td}>{r.class}</td>
                    <td style={td}>{r.foundation}</td>
                    <td style={td}>{r.program}</td>
                    <td style={td}>{r.group}</td>
                    <td style={td}>{r.section}</td>
                    <td style={td}>{r.num_students}</td>
                    <td style={td}>
                      <button type="button" onClick={() => removeClassRow(idx)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ===== Teachers builder (depends on classes above) ===== */}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
        <h4 style={{ margin: '0 0 8px' }}>Teachers (add manually)</h4>

        {classOptionsFromClasses.length === 0 ? (
          <p style={{ margin: 0, color: '#666' }}>Add at least one Class above to choose Class/Section for teachers.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1.6fr 1fr 1fr 1fr auto', gap: 8, alignItems: 'end' }}>
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
              <div>
                <label>Subject</label>
                <select value={tSubject} onChange={e => setTSubject(e.target.value)}>
                  {SUBJECT_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label>Class</label>
                <select
                  value={tClass}
                  onChange={e => { setTClass(e.target.value); setTSection('') }}
                >
                  <option value='' disabled>Select Class</option>
                  {classOptionsFromClasses.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label>Section</label>
                <select
                  value={tSection}
                  onChange={e => setTSection(e.target.value)}
                  disabled={!tClass}
                >
                  <option value='' disabled>{tClass ? 'Select Section' : 'Pick Class first'}</option>
                  {teacherSectionOptions.map(sec => <option key={sec} value={sec}>{sec}</option>)}
                </select>
              </div>
              <div>
                <button type="button" onClick={addTeacherRow}>Add Teacher</button>
              </div>
            </div>

            <div style={{ marginTop: 10, overflow: 'auto', border: '1px solid #e2e8f0', borderRadius: 12 }}>
              {teachers.length === 0 ? (
                <p style={{ padding: 10, margin: 0, color: '#666' }}>No teachers added yet.</p>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f7fafc' }}>
                      <th style={th}>NAME</th>
                      <th style={th}>CONTACT</th>
                      <th style={th}>EMAIL</th>
                      <th style={th}>SUBJECT</th>
                      <th style={th}>CLASS</th>
                      <th style={th}>SECTION</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((t, idx) => (
                      <tr key={idx}>
                        <td style={td}>{t.name}</td>
                        <td style={td}>{t.contact}</td>
                        <td style={td}>{t.email}</td>
                        <td style={td}>{t.subject}</td>
                        <td style={td}>{t.class}</td>
                        <td style={td}>{t.section}</td>
                        <td style={td}>
                          <button type="button" onClick={() => removeTeacherRow(idx)}>Remove</button>
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

      {/* submit everything */}
      <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
        <button type='submit'>Add to List</button>
      </div>

      <p style={{ fontSize: 12, color: '#555', marginTop: 8 }}>
        SCHOOL_ID format: <b>STATE_ABBR + YY + NN</b> (e.g., TS + 25 + 01 → <b>TS2501</b>).<br />
        Classes drive the Class/Section options shown in Teachers.
      </p>
    </form>
  )
}

const th = { padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: 13 }
const td = { padding: '8px 12px', borderBottom: '1px solid #edf2f7', fontSize: 14 }

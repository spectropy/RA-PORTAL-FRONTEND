import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient';

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

function yy(ay) {
  if (!ay) return ''
  const start = ay.split('-')[0] || ''
  return start.slice(-2)
}

export default function SchoolForm({ onSubmit, existingSchools = [] }) {
  // ===== School fields =====
  const [name, setName] = useState('')
  const [state, setState] = useState('')
  const [ay, setAy] = useState(ACADEMIC_YEARS[0])
  const [area, setArea] = useState('')
  const [district, setDistrict] = useState('')
  const [schoolNum, setSchoolNum] = useState('') // NN (01–99)
  const [logoFile, setLogoFile] = useState(null);

  const abbr = STATES[state] || ''
  const num2 = (() => {
    const onlyDigits = (schoolNum || '').replace(/\D/g, '').slice(0, 2)
    if (!onlyDigits) return ''
    const v = parseInt(onlyDigits, 10)
    if (!Number.isFinite(v) || v < 1 || v > 99) return ''
    return String(v).padStart(2, '0')
  })()
  const schoolId = (abbr && yy(ay) && num2) ? `${abbr}${yy(ay)}${num2}` : ''

  // ===== Submit =====
  async function handleSubmit(e) {
  e.preventDefault();

  if (!name || !state || !ay || !num2 || !schoolId) {
    return alert('Please fill School Name, State, Academic Year, and a valid 2-digit School Number (01–99).');
  }

  if (existingSchools.some(school => school.school_id === schoolId)) {
    return alert(`A school with SCHOOL_ID "${schoolId}" already exists.`);
  }

  let logoUrl = null;

  // ✅ If logo file is selected, upload it
  if (logoFile) {
    try {
      // Generate safe file extension
      const fileExt = logoFile.name.split('.').pop()?.toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt)) {
        return alert('Please upload a valid image (jpg, png, gif, webp).');
      }

      // Construct path: school_logos/TS2501_logo.jpg
      const fileName = `${schoolId}_logo.${fileExt}`;
      const filePath = `school_logos/${fileName}`; // matches your existing pattern

      // Upload to 'logos' bucket
      const { error: uploadError } = await supabase.storage
        .from('logos') // ← your bucket name
        .upload(filePath, logoFile, { upsert: true }); // overwrite if exists

      if (uploadError) {
        console.error('Supabase upload error:', uploadError);
        return alert('Failed to upload logo. Please try again.');
      }

      // Get public URL (matches your sample URL format)
      const { data } = supabase.storage.from('logos').getPublicUrl(filePath);
      logoUrl = data.publicUrl;
    } catch (err) {
      console.error('Unexpected upload error:', err);
      return alert('An unexpected error occurred during upload.');
    }
  }

  // ✅ Call onSubmit with logo_url included
  onSubmit?.({
    school_name: name,
    state,
    academic_year: ay,
    area,
    district,
    school_number_2d: num2,
    school_id: schoolId,
    logo_url: logoUrl, // ← this will be null or a full public URL
    classes: [],
    teachers: []
  });

  // Reset form
  setName('');
  setArea('');
  setDistrict('');
  setSchoolNum('');
  setLogoFile(null);
}

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
      
      <div style={{ marginTop: 8 }}>
  <label>School Logo (optional)</label>
  <input
    type="file"
    accept="image/*"
    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
  />
  {logoFile && <p className="help">Selected: {logoFile.name}</p>}
</div>

      {/* submit */}
      <div className="row" style={{ marginTop: 24 }}>
        <button className="btn btn-primary" type='submit'>Add to List</button>
        <button className="btn btn-outline" type='button'
          onClick={()=>window.scrollTo({ top:0, behavior:'smooth' })}>
          Back to Top
        </button>
      </div>

      <p className="help" style={{ marginTop: 8 }}>
        SCHOOL_ID format: <b>STATE_ABBR + YY + NN</b> (e.g., TS + 25 + 01 → <b>TS2501</b>).
      </p>
    </form>
  )
}
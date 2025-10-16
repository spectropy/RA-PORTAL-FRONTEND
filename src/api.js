const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5173';

// ========================
// 🏫 SCHOOL MANAGEMENT
// ========================

export async function getSchools() {
  const r = await fetch(`${API_BASE}/api/schools`);
  if (!r.ok) throw new Error(`GET /api/schools failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.data || [];
}

export async function createSchool(payload) {
  const r = await fetch(`${API_BASE}/api/schools`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`POST /api/schools failed: ${r.status} ${t}`);
  }
  return r.json();
}

export async function getSchoolById(schoolId) {
  const r = await fetch(`${API_BASE}/api/schools/${schoolId}`);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET /api/schools/${schoolId} failed: ${r.status} ${t}`);
  }
  const j = await r.json();
  return j;
}

// ========================
// 👩‍🏫 CLASS & TEACHER REGISTRATION
// ========================

export async function createClass(payload) {
  const r = await fetch(`${API_BASE}/api/classes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`POST /api/classes failed: ${r.status} ${t}`);
  }
  return r.json();
}

export async function createTeacher(payload) {
  const r = await fetch(`${API_BASE}/api/teachers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`POST /api/teachers failed: ${r.status} ${t}`);
  }
  return r.json();
}

export async function assignTeacherToClass(payload) {
  const r = await fetch(`${API_BASE}/api/teacher-assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`POST /api/teacher-assignments failed: ${r.status} ${t}`);
  }
  return r.json();
}

// ========================
// 🎓 STUDENT REGISTRATION
// ========================

/**
 * Upload students via FormData (file + class_section)
 * @param {string} schoolId
 * @param {FormData} formData - Must include: file (Blob), class_section (string)
 */
export const uploadStudents = async (schoolId, formData) => {
  const res = await fetch(`${API_BASE}/api/schools/${schoolId}/students/upload`, {
    method: 'POST',
    body: formData
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`POST /api/schools/${schoolId}/students/upload failed: ${res.status} ${errorText}`);
  }

  // Try to parse JSON, fallback to text
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  } else {
    return { message: await res.text() };
  }
};

export const getStudentsByClassSection = async (schoolId, classValue, sectionValue) => {
  const url = new URL(`${API_BASE}/api/schools/${schoolId}/students`);
  url.searchParams.append('class', classValue);
  url.searchParams.append('section', sectionValue);

  const res = await fetch(url, {
    method: 'GET'
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GET ${url} failed: ${res.status} ${errorText}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  } else {
    throw new Error('Expected JSON response');
  }
};

// ========================
// 📝 EXAM REGISTRATION
// ========================

export async function getFoundations() {
  const r = await fetch(`${API_BASE}/api/foundations`);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET /api/foundations failed: ${r.status} ${t}`);
  }
  const j = await r.json();
  return j;
}

export async function getPrograms() {
  const r = await fetch(`${API_BASE}/api/programs`);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET /api/programs failed: ${r.status} ${t}`);
  }
  const j = await r.json();
  return j;
}

export async function createExam(payload) {
  const r = await fetch(`${API_BASE}/api/exams`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  // ✅ CRITICAL FIX: Extract error message from backend JSON response
  if (!r.ok) {
    let errorData;
    try {
      errorData = await r.json(); // Try to parse as JSON
    } catch (e) {
      errorData = { error: await r.text() }; // Fallback: raw text if not JSON
    }

    const errorMessage = errorData.error || 'Unknown error creating exam';
    throw new Error(errorMessage); // 👈 This shows REAL backend error!
  }

  // ✅ Success: Return the raw exam object (backend returns direct object, NOT { data: ... })
  return await r.json();
}

// ========================
// 🗓️ ACADEMIC YEARS (MOCK)
// ========================

export async function getAcademicYears() {
  const currentYear = new Date().getFullYear();
  const years = [];
  
  for (let i = -1; i < 4; i++) {
    const startYear = currentYear + i;
    const endYear = startYear + 1;
    years.push({
      id: `${startYear}-${endYear}`,
      name: `${startYear}-${endYear}`
    });
  }
  
  return years;
}
// ========================
// 📝 EXAM REGISTRATION
// ========================

// ... your existing getFoundations, getPrograms, createExam ...

// 👇 ADD THIS FUNCTION
export async function getExams() {
  const r = await fetch(`${API_BASE}/api/exams`);
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET /api/exams failed: ${r.status} ${t}`);
  }
  const j = await r.json();
  return j;
}

// Delete class by ID
export const deleteClassById = async (id) => {
  const res = await fetch(`/api/classes/${id}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete class');
  return data;
};

// Delete teacher assignment by ID
export const deleteAssignmentById = async (id) => {
  const res = await fetch(`/api/teacher-assignments/${id}`, {
    method: 'DELETE'
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Failed to delete assignment');
  return data;
};

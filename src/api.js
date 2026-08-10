const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000";

/**
 * Parses and formats backend API error responses into clean, user-friendly messages.
 */
async function parseAndFormatError(r) {
  let text = "";
  try {
    text = await r.text();
  } catch (e) {
    return `Request failed with status ${r.status}`;
  }

  try {
    const json = JSON.parse(text);

    // 1. PostgreSQL 23505 Duplicate Key Error
    if (
      json.details?.code === "23505" ||
      (json.error && json.error.includes("duplicate key"))
    ) {
      const match = json.details?.details?.match(
        /Key \((.*?)\)=\((.*?)\) already exists/,
      );
      if (match) {
        const [, field, val] = match;
        const fieldLabel =
          field === "student_id" ? "Roll Number / Student ID" : field;
        return `Student with ${fieldLabel} "${val}" already exists in the database. Please check your Excel/CSV file for duplicates.`;
      }
      if (json.details?.details) {
        return json.details.details;
      }
    }

    return json.error || json.message || text;
  } catch (e) {
    return text || `Request failed with status ${r.status}`;
  }
}

// ========================
// 🏫 SCHOOL MANAGEMENT
// ========================

export async function getSchools() {
  const r = await fetch(`${API_BASE}/api/schools`);
  if (!r.ok) throw new Error(await parseAndFormatError(r));
  const j = await r.json();
  return j.data || [];
}

export async function createSchool(payload) {
  const r = await fetch(`${API_BASE}/api/schools`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await parseAndFormatError(r));
  return r.json();
}

export async function getSchoolById(schoolId) {
  const r = await fetch(`${API_BASE}/api/schools/${schoolId}`);
  if (!r.ok) throw new Error(await parseAndFormatError(r));
  const j = await r.json();
  return j;
}

// ========================
// 👩‍🏫 CLASS & TEACHER REGISTRATION
// ========================

export async function createClass(payload) {
  const r = await fetch(`${API_BASE}/api/classes`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await parseAndFormatError(r));
  return r.json();
}

export async function createTeacher(payload) {
  const r = await fetch(`${API_BASE}/api/teachers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await parseAndFormatError(r));
  return r.json();
}

export async function assignTeacherToClass(payload) {
  const r = await fetch(`${API_BASE}/api/teacher-assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!r.ok) throw new Error(await parseAndFormatError(r));
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
  const res = await fetch(
    `${API_BASE}/api/schools/${schoolId}/students/upload`,
    {
      method: "POST",
      body: formData,
    },
  );

  if (!res.ok) {
    throw new Error(await parseAndFormatError(res));
  }

  // Try to parse JSON, fallback to text
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  } else {
    return { message: await res.text() };
  }
};

export const getStudentsByClassSection = async (
  schoolId,
  classValue,
  sectionValue,
) => {
  const query = new URLSearchParams({
    class: classValue,
    section: sectionValue,
  }).toString();
  const res = await fetch(
    `${API_BASE}/api/schools/${schoolId}/students?${query}`,
    {
      method: "GET",
    },
  );

  if (res.status === 404) {
    return [];
  }

  if (!res.ok) {
    throw new Error(await parseAndFormatError(res));
  }

  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return res.json();
  } else {
    return [];
  }
};

export const deleteStudent = async (schoolId, id) => {
  const res = await fetch(`${API_BASE}/api/schools/${schoolId}/students/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(await parseAndFormatError(res));
  }

  return res.json();
};

export const deleteStudentsByClassSection = async (
  schoolId,
  classValue,
  sectionValue,
) => {
  const query = new URLSearchParams({
    class: classValue,
    section: sectionValue,
  }).toString();

  const res = await fetch(`${API_BASE}/api/schools/${schoolId}/students?${query}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw new Error(await parseAndFormatError(res));
  }

  return res.json();
};

// ========================
// 📝 EXAM REGISTRATION
// ========================

export async function getFoundations() {
  const r = await fetch(`${API_BASE}/api/foundations`);
  if (!r.ok) throw new Error(await parseAndFormatError(r));
  const j = await r.json();
  return j;
}

export async function getPrograms() {
  const r = await fetch(`${API_BASE}/api/programs`);
  if (!r.ok) throw new Error(await parseAndFormatError(r));
  const j = await r.json();
  return j;
}

export async function createExam(payload) {
  const r = await fetch(`${API_BASE}/api/exams`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    throw new Error(await parseAndFormatError(r));
  }

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
      name: `${startYear}-${endYear}`,
    });
  }

  return years;
}

export async function getExams() {
  const r = await fetch(`${API_BASE}/api/exams`);
  if (!r.ok) throw new Error(await parseAndFormatError(r));
  const j = await r.json();
  return j;
}

// Delete class by ID
export const deleteClassById = async (id) => {
  const res = await fetch(`${API_BASE}/api/classes/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await parseAndFormatError(res));
  return res.json();
};

// Delete teacher by database row ID
export const deleteTeacherById = async (id) => {
  const res = await fetch(`${API_BASE}/api/teachers/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await parseAndFormatError(res));
  return res.json();
};

// Delete teacher assignment by ID
export const deleteAssignmentById = async (id) => {
  const res = await fetch(`${API_BASE}/api/teacher-assignments/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await parseAndFormatError(res));
  return res.json();
};

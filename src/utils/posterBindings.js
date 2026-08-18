export function resolveBinding(data, binding) {
  if (!binding) return "";

  if (binding === "class.name") {
    return data?.className ? String(data.className).toUpperCase() : "";
  }

  const value = String(binding)
    .split(".")
    .reduce((current, key) => {
      if (current == null) return "";
      if (/^\d+$/.test(key)) return current[Number(key)];
      return current[key];
    }, data);

  if (binding === "school.name" || /^students\.\d+\.name$/.test(binding)) {
    return String(value || "").toUpperCase();
  }

  return value;
}

export function buildPosterData({ school, className, sectionName, students }) {
  return {
    school: {
      school_id: school?.school_id || school?.id || "",
      name: school?.school_name || school?.name || "",
      logo: school?.logo_url || school?.logo || "",
    },
    className: className || "",
    sectionName: sectionName || "",
    students: Array.isArray(students) ? students.slice(0, 5) : [],
  };
}

export function normalizeTopStudentsResponse(data) {
  if (!data) return null;
  if (data.school && Array.isArray(data.students)) return data;
  return buildPosterData(data);
}

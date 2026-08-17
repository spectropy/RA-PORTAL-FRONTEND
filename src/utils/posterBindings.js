export function resolveBinding(data, binding) {
  if (!binding) return "";

  if (binding === "class.name") {
    return data?.className ? `Class ${data.className}` : "";
  }

  return String(binding)
    .split(".")
    .reduce((value, key) => {
      if (value == null) return "";
      if (/^\d+$/.test(key)) return value[Number(key)];
      return value[key];
    }, data);
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

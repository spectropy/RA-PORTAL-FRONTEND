export function buildTopStudentsMessage({
  className = "",
  section = "",
  schoolName = "",
  schoolArea = "",
} = {}) {
  return `🎉 **Celebrating Excellence!** 🎉

Congratulations to **our students** for securing **top ranks** in **${className} – ${section}**! 🏆

📍 **${schoolName}**
📌 **${schoolArea}**

Your dedication, hard work, and commitment to learning have made this achievement possible. 🌟

Let's celebrate this wonderful accomplishment and inspire many more students to aim higher! 🚀

**Powered by SPECTROPY**

#Top5Students #StudentAchievement #AcademicExcellence #StudentSuccess #SPECTROPY
#PoweredBySPECTROPY #SPECTROPYEducation #SPECTROPYResults #SPECTROPYAnalytics #SPECTROPYSuccess #SPECTROPYSchools
#SPECTROPYAchievers #SPECTROPYTopStudents #SPECTROPYExcellence #Top5Students #StudentAchievement #AcademicExcellence
#StudentSuccess #SchoolExcellence`;
}

export function downloadTextFile(text, filename) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

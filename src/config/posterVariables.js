const SCHOOL_VARIABLES = [
  {
    label: "School Logo",
    binding: "school.logo",
    type: "image",
    sample: "",
  },
  {
    label: "School Name",
    binding: "school.name",
    type: "text",
    sample: "SPECTROPY PUBLIC SCHOOL",
  },
  {
    label: "Class",
    binding: "class.name",
    type: "text",
    sample: "CLASS 9",
  },
  {
    label: "Section",
    binding: "sectionName",
    type: "text",
    sample: "A",
  },
];

const STUDENT_NAME_VARIABLES = [0, 1, 2, 3, 4].map((index) => ({
  label: `Student Name ${index + 1}`,
  binding: `students.${index}.name`,
  type: "text",
  sample: `Student ${index + 1} Name`,
}));

export const CUMULATIVE_POSTER_VARIABLES = [
  ...SCHOOL_VARIABLES,
  ...STUDENT_NAME_VARIABLES,
  ...[0, 1, 2, 3, 4].map((index) => ({
    label: `Cumulative Percentage ${index + 1}`,
    binding: `students.${index}.cumulative_percentage`,
    type: "text",
    sample: `${index + 1} cumulative percentage`,
  })),
];

export const EXAM_WISE_POSTER_VARIABLES = [
  ...SCHOOL_VARIABLES,
  { label: "Exam", binding: "exam.name", type: "text", sample: "UNIT TEST 1" },
  ...STUDENT_NAME_VARIABLES,
  ...[0, 1, 2, 3, 4].map((index) => ({
    label: `Percentage ${index + 1}`,
    binding: `students.${index}.percentage`,
    type: "text",
    sample: `${index + 1} percentage`,
  })),
];

export const POSTER_VARIABLES = CUMULATIVE_POSTER_VARIABLES;

export const getPosterVariables = (type = "cumulative") =>
  type === "exam_wise" ? EXAM_WISE_POSTER_VARIABLES : CUMULATIVE_POSTER_VARIABLES;

export const getVariableByBinding = (binding) =>
  [...CUMULATIVE_POSTER_VARIABLES, ...EXAM_WISE_POSTER_VARIABLES].find(
    (variable) => variable.binding === binding,
  );

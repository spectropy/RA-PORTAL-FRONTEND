export const POSTER_VARIABLES = [
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
  {
    label: "Topper 1 Name",
    binding: "students.0.name",
    type: "text",
    sample: "Topper 1 Name",
  },
  {
    label: "Topper 1 Cumulative",
    binding: "students.0.cumulative_percentage",
    type: "text",
    sample: "cp1",
  },
  {
    label: "Topper 2 Name",
    binding: "students.1.name",
    type: "text",
    sample: "Topper 2 Name",
  },
  {
    label: "Topper 2 Cumulative",
    binding: "students.1.cumulative_percentage",
    type: "text",
    sample: "cp2",
  },
  {
    label: "Topper 3 Name",
    binding: "students.2.name",
    type: "text",
    sample: "Topper 3 Name",
  },
  {
    label: "Topper 3 Cumulative",
    binding: "students.2.cumulative_percentage",
    type: "text",
    sample: "cp3",
  },
  {
    label: "Topper 4 Name",
    binding: "students.3.name",
    type: "text",
    sample: "Topper 4 Name",
  },
  {
    label: "Topper 4 Cumulative",
    binding: "students.3.cumulative_percentage",
    type: "text",
    sample: "cp4",
  },
  {
    label: "Topper 5 Name",
    binding: "students.4.name",
    type: "text",
    sample: "Topper 5 Name",
  },
  {
    label: "Topper 5 Cumulative",
    binding: "students.4.cumulative_percentage",
    type: "text",
    sample: "cp5",
  },
];

export const getVariableByBinding = (binding) =>
  POSTER_VARIABLES.find((variable) => variable.binding === binding);

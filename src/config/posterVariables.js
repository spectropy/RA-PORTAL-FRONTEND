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
    label: "Topper 1 Name",
    binding: "students.0.name",
    type: "text",
    sample: "Topper 1 Name",
  },
  {
    label: "Topper 2 Name",
    binding: "students.1.name",
    type: "text",
    sample: "Topper 2 Name",
  },
  {
    label: "Topper 3 Name",
    binding: "students.2.name",
    type: "text",
    sample: "Topper 3 Name",
  },
  {
    label: "Topper 4 Name",
    binding: "students.3.name",
    type: "text",
    sample: "Topper 4 Name",
  },
  {
    label: "Topper 5 Name",
    binding: "students.4.name",
    type: "text",
    sample: "Topper 5 Name",
  },
];

export const getVariableByBinding = (binding) =>
  POSTER_VARIABLES.find((variable) => variable.binding === binding);

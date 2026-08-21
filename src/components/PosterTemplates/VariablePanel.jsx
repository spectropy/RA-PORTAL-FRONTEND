import React from "react";
import { Image, Type } from "lucide-react";
import { getPosterVariables } from "../../config/posterVariables.js";

export default function VariablePanel({ onAddVariable, type = "cumulative" }) {
  const variables = getPosterVariables(type);
  return (
    <aside className="poster-side-panel">
      <h3>{type === "exam_wise" ? "Exam-wise Variables" : "Cumulative Variables"}</h3>
      <div className="poster-variable-list">
        {variables.map((variable) => {
          const Icon = variable.type === "image" ? Image : Type;
          return (
            <button
              key={variable.binding}
              type="button"
              onClick={() => onAddVariable(variable)}
            >
              <Icon size={15} />
              <span>{variable.label}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}


import React from "react";
import { Image, Type } from "lucide-react";
import { POSTER_VARIABLES } from "../../config/posterVariables.js";

export default function VariablePanel({ onAddVariable }) {
  return (
    <aside className="poster-side-panel">
      <h3>Variables</h3>
      <div className="poster-variable-list">
        {POSTER_VARIABLES.map((variable) => {
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


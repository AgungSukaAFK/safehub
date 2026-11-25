"use client";

import { useState } from "react";
import { ROLES } from "./content";

export function RoleSwitcher() {
  const [active, setActive] = useState(0);
  const role = ROLES[active];
  return (
    <div className="lp-roles" data-role={active}>
      <div className="lp-role-list" role="group" aria-label="Pilih peran">
        {ROLES.map((r, i) => (
          <button key={r.name} type="button" aria-pressed={i === active} onClick={() => setActive(i)}>
            {r.name}
          </button>
        ))}
      </div>
      <div className="lp-role-view">
        <div className="lp-morph" aria-hidden="true" />
        <div className="lp-morph lp-morph-2" aria-hidden="true" />
        <div className="lp-glass lp-role-card" aria-live="polite">
          <div key={role.name} className="lp-swap">
            <h3>{role.name}</h3>
            <p>{role.lead}</p>
            <ul>
              {role.does.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

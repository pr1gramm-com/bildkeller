"use client";
import { useState } from "react";
import { FLAGS, useFlags, writeFlags } from "@/lib/client/flags";

export default function FlagFilter() {
  const flags = useFlags() ?? 1;
  const [open, setOpen] = useState(false);
  return (
    <div className="flagfilter">
      <button className="link flaglabel" onClick={() => setOpen(!open)} aria-expanded={open} title="Filter">
        {FLAGS.filter((f) => flags & f.bit).map((f) => f.label.toLowerCase()).join("+")}
      </button>
      {open && (
        <div className="flagpop">
          {FLAGS.map((f) => (
            <label key={f.bit} style={{ color: f.color }}>
              <input type="checkbox" checked={(flags & f.bit) !== 0} onChange={() => writeFlags(flags ^ f.bit)} />
              {f.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

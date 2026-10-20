"use client";
import { useState, useEffect } from "react";
import { FLAGS, useFlags, writeFlags } from "@/lib/client/flags";
import Icon from "./Icon";

const DESC: Record<string, string> = {
  SFW: "Safe for work",
  NSFW: "Beinhaltet nackte Haut, Pornos und leicht offensiven Kram.",
  NSFL: "Alles. Gewalt, ekliger Scheiß.",
  NSFP: "Politische, news-lastige und wirtschaftliche Inhalte.",
  POL: "Politik, Wirtschaft, Kriminalität, Konflikte.",
};

export default function FlagFilter() {
  const flags = useFlags() ?? 1;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(flags);

  useEffect(() => {
    if (open) setDraft(flags);
  }, [open, flags]);

  const selected = FLAGS.filter((f) => flags & f.bit)
    .map((f) => f.label.toLowerCase())
    .join("+");

  function toggle(bit: number) {
    setDraft((d) => {
      const next = d ^ bit;
      return next === 0 ? d : next; // never empty
    });
  }

  function save() {
    writeFlags(draft);
    setOpen(false);
  }

  return (
    <div className="flagfilter">
      <span id="filter-link" role="button" tabIndex={0} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="filter-ico"><Icon name="filter" size={18} /></span>
        <span id="filter-link-flag">f</span>
        <span id="filter-link-name">{selected}</span>
      </span>
      {open && (
        <div id="filter-menu">
          <div className="filter-setting-list">
            {FLAGS.map((f) => (
              <div
                key={f.bit}
                className={`filter-setting ${draft & f.bit ? "active" : ""}`}
                onClick={() => toggle(f.bit)}
              >
                <span className="filter-name">
                  <span className="filter-check" />
                  {f.label.toLowerCase()}
                </span>
                <span className="filter-desc">{DESC[f.label] ?? ""}</span>
              </div>
            ))}
          </div>
          <button id="filter-save" onClick={save}>
            Speichern
          </button>
        </div>
      )}
    </div>
  );
}
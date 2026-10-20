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

export default function FlagFilter({ variant = "classic" }: { variant?: "classic" | "app" }) {
  const flags = useFlags() ?? 1;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(flags);
  const prefix = variant === "app" ? "app-filter" : "filter";

  useEffect(() => {
    if (open) setDraft(flags);
  }, [open, flags]);

  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);

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
      <button id={`${prefix}-link`} className="filter-link iconbtn" aria-label="Inhaltsfilter" aria-controls={`${prefix}-menu`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="filter-ico"><Icon name="filter" size={18} /></span>
        <span className="filter-link-flag">f</span>
        <span className="filter-link-name">{selected}</span>
      </button>
      {open && (
        <div id={`${prefix}-menu`} className="filter-menu">
          <div className="filter-setting-list">
            {FLAGS.map((f) => (
              <label
                key={f.bit}
                className={`filter-setting ${draft & f.bit ? "active" : ""}`}
              >
                <span className="filter-name">
                  <input className="filter-check" type="checkbox" checked={Boolean(draft & f.bit)} onChange={() => toggle(f.bit)} />
                  {f.label.toLowerCase()}
                </span>
                <span className="filter-desc">{DESC[f.label] ?? ""}</span>
              </label>
            ))}
          </div>
          <button className="filter-save" onClick={save}>
            Speichern
          </button>
        </div>
      )}
    </div>
  );
}

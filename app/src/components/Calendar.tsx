"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Month overview of the upload activity; every day links to its posts. */
export default function Calendar({ year, month }: { year: number; month: number }) {
  const [days, setDays] = useState<Record<string, number>>({});
  const [cursor, setCursor] = useState({ year, month });

  useEffect(() => {
    api.get("items/calendar", { year: cursor.year, month: cursor.month })
      .then((r) => setDays(Object.fromEntries((r.days ?? []).map((d: { day: string; count: number }) => [d.day, d.count]))))
      .catch(() => setDays({}));
  }, [cursor]);

  const first = new Date(Date.UTC(cursor.year, cursor.month - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(Date.UTC(cursor.year, cursor.month, 0)).getUTCDate();
  const shift = (delta: number) => {
    const d = new Date(Date.UTC(cursor.year, cursor.month - 1 + delta, 1));
    setCursor({ year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 });
  };
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <>
      <h1 className="pane-head">Kalender</h1>
      <div className="pane">
        <div className="calendar-head">
          <button onClick={() => shift(-1)} aria-label="Voriger Monat">‹</button>
          <strong>{MONTHS[cursor.month - 1]} {cursor.year}</strong>
          <button onClick={() => shift(1)} aria-label="Nächster Monat">›</button>
        </div>
        <table className="calendar">
          <thead>
            <tr>{WEEKDAYS.map((d) => <th key={d}>{d}</th>)}</tr>
          </thead>
          <tbody>
            {Array.from({ length: Math.ceil((offset + daysInMonth) / 7) }, (_, week) => (
              <tr key={week}>
                {Array.from({ length: 7 }, (_, i) => {
                  const day = week * 7 + i - offset + 1;
                  if (day < 1 || day > daysInMonth) return <td key={i} />;
                  const key = `${cursor.year}-${pad(cursor.month)}-${pad(day)}`;
                  const count = days[key] ?? 0;
                  return (
                    <td key={i} className={count ? "has" : ""}>
                      <Link href={`/calendar/${key}`}>{day}</Link>
                      {count > 0 && <span className="calendar-count">{count}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

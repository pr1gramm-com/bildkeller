"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, SESSION_EVENT } from "@/lib/client/api";

export default function AuthForm({ mode, inviteRequired = true }: { mode: "login" | "register"; inviteRequired?: boolean }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", password: "", email: "", invite: "", age: false });
  const [error, setError] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: k === "age" ? e.target.checked : e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      if (mode === "login") await api.post("user/login", { name: f.name, password: f.password });
      else
        await api.post("user/joinwithinvite", {
          name: f.name, password: f.password, email: f.email, invite: f.invite, ageVerified: f.age ? 1 : 0,
        });
      window.dispatchEvent(new Event(SESSION_EVENT));
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    }
  }

  return (
    <div className="overlay-box">
      <form className="overlay-content" onSubmit={submit}>
        <h2>{mode === "login" ? "Anmelden" : "Neu registrieren"}</h2>
        <div className="form-row"><label>Benutzername:</label><input name="name" placeholder="Name" value={f.name} onChange={set("name")} required autoFocus /></div>
        <div className="form-row"><label>Passwort:</label><input name="password" type="password" placeholder="Passwort" minLength={8} value={f.password} onChange={set("password")} required /></div>
        {mode === "register" && (
          <>
            <div className="form-row"><label>E-Mail (optional):</label><input name="email" type="email" placeholder="E-Mail" value={f.email} onChange={set("email")} /></div>
            {inviteRequired && <div className="form-row"><label>Einladungscode (leer beim ersten Account):</label><input name="invite" placeholder="Einladungscode" value={f.invite} onChange={set("invite")} /></div>}
            {!inviteRequired && <p>Die Registrierung ist offen. Du brauchst keinen Einladungscode und kannst direkt posten.</p>}
            <label className="age"><input type="checkbox" checked={f.age} onChange={set("age")} /> <span>Ich bin mindestens 18 (schaltet NSFW/NSFL frei)</span></label>
          </>
        )}
        {error && <p className="err">{error}</p>}
        <div className="form-row"><button className="primary">{mode === "login" ? "Anmelden" : "Konto erstellen"}</button></div>
        <p className="dim">Eigenständiges Projekt, nicht mit pr0gramm.com verbunden.</p>
      </form>
      <div className="overlay-content">
        <h2>{mode === "login" ? "Neu registrieren" : "Anmelden"}</h2>
        <p>{mode === "login" ? "Wenn du noch kein Konto hast, kannst du dir hier eins erstellen." : "Du hast schon ein Konto?"}</p>
        <div className="form-row"><Link href={mode === "login" ? "/register" : "/login"} className="btn-primary cta">{mode === "login" ? "Konto erstellen" : "Zum Login"}</Link></div>
      </div>
    </div>
  );
}

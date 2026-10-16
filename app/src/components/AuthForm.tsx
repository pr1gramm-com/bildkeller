"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/client/api";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
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
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler");
    }
  }

  return (
    <div className="overlay-box">
      <form className="overlay-content" onSubmit={submit}>
        <h2>{mode === "login" ? "Login" : "Registrieren"}</h2>
        <div className="form-row"><label>Name</label><input value={f.name} onChange={set("name")} required autoFocus /></div>
        <div className="form-row"><label>Passwort</label><input type="password" minLength={8} value={f.password} onChange={set("password")} required /></div>
        {mode === "register" && (
          <>
            <div className="form-row"><label>E-Mail (optional)</label><input type="email" value={f.email} onChange={set("email")} /></div>
            <div className="form-row"><label>Einladungscode (leer beim ersten Account)</label><input value={f.invite} onChange={set("invite")} /></div>
            <label className="row"><input type="checkbox" checked={f.age} onChange={set("age")} /> Ich bin mindestens 18 (schaltet NSFW/NSFL frei)</label>
          </>
        )}
        {error && <p className="err">{error}</p>}
        <div className="form-row"><button className="primary">{mode === "login" ? "Einloggen" : "Konto erstellen"}</button></div>
        <p className="dim">Eigenständiges Projekt, nicht mit pr0gramm.com verbunden.</p>
      </form>
      <div className="overlay-content">
        <h2>{mode === "login" ? "Registrieren" : "Login"}</h2>
        <p>{mode === "login" ? "Noch kein Konto? Mit einem Einladungscode bist du in einer Minute dabei." : "Du hast schon ein Konto?"}</p>
        <div className="form-row"><Link href={mode === "login" ? "/register" : "/login"} className="btn-primary cta">{mode === "login" ? "Konto erstellen" : "Zum Login"}</Link></div>
      </div>
    </div>
  );
}

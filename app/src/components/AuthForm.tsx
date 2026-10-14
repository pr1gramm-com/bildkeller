"use client";
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
    <form className="stack panel" onSubmit={submit}>
      <h2>{mode === "login" ? "Login" : "Registrieren"}</h2>
      <input placeholder="Name" value={f.name} onChange={set("name")} required autoFocus />
      <input type="password" placeholder="Passwort (min. 8 Zeichen)" value={f.password} onChange={set("password")} required />
      {mode === "register" && (
        <>
          <input type="email" placeholder="E-Mail (optional)" value={f.email} onChange={set("email")} />
          <input placeholder="Einladungscode (leer beim ersten Account)" value={f.invite} onChange={set("invite")} />
          <label className="row"><input type="checkbox" checked={f.age} onChange={set("age")} /> Ich bin mindestens 18 (schaltet NSFW/NSFL frei)</label>
        </>
      )}
      {error && <span className="err">{error}</span>}
      <button className="primary">{mode === "login" ? "Einloggen" : "Konto erstellen"}</button>
      <span className="dim">Eigenständiges Projekt, nicht mit pr0gramm.com verbunden.</span>
    </form>
  );
}

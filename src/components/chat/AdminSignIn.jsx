import { useState } from "react";

export default function AdminSignIn({ language, isLoading, onSignIn, onCancel }) {
  const [error, setError] = useState("");
  const sl = language === "sl";

  async function handleSubmit(event) {
    event.preventDefault();
    if (isLoading) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setError("");
    const message = await onSignIn(String(fields.get("email")).trim(), String(fields.get("password")));
    if (message) {
      form.querySelector("input[type=password]")?.focus();
      setError(message);
    }
  }

  return (
    <form onSubmit={handleSubmit} onChange={() => setError("")} className="k-panel" style={{ maxWidth: "none" }}>
      <h1 className="k-dlghead" style={{ margin: 0 }}>{sl ? "Skrbniška prijava" : "Administrator sign-in"}</h1>
      <div className="k-dlgbody">
        <div className="k-field">
          <label htmlFor="admin-email">{sl ? "E-pošta" : "Email"}</label>
          <input id="admin-email" name="email" type="email" autoComplete="username" className="k-inp" required readOnly={isLoading} />
        </div>
        <div className="k-field">
          <label htmlFor="admin-password">{sl ? "Geslo" : "Password"}</label>
          <input id="admin-password" name="password" type="password" autoComplete="current-password" className="k-inp" required readOnly={isLoading} />
        </div>
        {error && <p className="k-err" role="alert">{error}</p>}
      </div>
      <div className="k-dlgfoot">
        <button type="button" className="k-btn" onClick={onCancel} disabled={isLoading}>{sl ? "Nazaj" : "Back"}</button>
        <button type="submit" className="k-btn k-pri" disabled={isLoading}>
          {isLoading ? (sl ? "Prijavljam …" : "Signing in …") : (sl ? "Prijava" : "Sign in")}
        </button>
      </div>
    </form>
  );
}

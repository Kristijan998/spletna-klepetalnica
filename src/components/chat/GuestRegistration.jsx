import { useState } from "react";
import { t } from "@/components/utils/translations";

export default function GuestRegistration({ onRegister, isLoading, language }) {
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");
  const isSlovenian = language === "sl";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (isLoading) return;
    setError("");
    const message = await onRegister(nickname);
    if (message) setError(message);
  };

  return (
    <form onSubmit={handleSubmit} className="k-panel" style={{ maxWidth: "none" }}>
      <h1 className="k-dlghead" style={{ fontSize: 13, margin: 0 }}>
        {isSlovenian ? "Vstopi v klepet" : "Join the chat"}
      </h1>
      <div className="k-dlgbody">
        <div className="k-field">
          <label htmlFor="guest-nickname">{isSlovenian ? "Vzdevek" : "Nickname"}</label>
          <input
            id="guest-nickname"
            name="nickname"
            autoComplete="off"
            className="k-inp"
            placeholder={isSlovenian ? "Tvoj vzdevek" : "Your nickname"}
            value={nickname}
            onChange={(event) => {
              setNickname(event.target.value);
              setError("");
            }}
            maxLength={15}
            required
            readOnly={isLoading}
            aria-describedby={error ? "guest-entry-error" : undefined}
          />
        </div>
        {error && (
          <p id="guest-entry-error" role="alert" className="k-err" style={{ margin: 0 }}>
            {error}
          </p>
        )}
      </div>
      <div className="k-dlgfoot">
        <button type="submit" className="k-btn k-pri" disabled={isLoading}>
          {isLoading ? t("register.loading", language) : isSlovenian ? "Vstopi" : "Join"}
        </button>
      </div>
    </form>
  );
}

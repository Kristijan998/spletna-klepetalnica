import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { t } from "@/components/utils/translations";

export default function GuestRegistration({ onRegister, isLoading, language, darkMode }) {
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
    <form
      onSubmit={handleSubmit}
      className={`space-y-4 rounded-2xl border p-6 shadow-lg ${
        darkMode ? "border-gray-700 bg-gray-800 shadow-gray-900/50" : "border-gray-100 bg-white shadow-violet-100/50"
      }`}
    >
      <h1 className={`text-2xl font-bold tracking-tight ${darkMode ? "text-white" : "text-gray-900"}`}>
        {isSlovenian ? "Vstopi v klepet" : "Join the chat"}
      </h1>
      <div className="space-y-1.5">
        <Label htmlFor="guest-nickname" className={darkMode ? "text-gray-300" : "text-gray-700"}>
          {isSlovenian ? "Vzdevek" : "Nickname"}
        </Label>
        <Input
          id="guest-nickname"
          name="nickname"
          autoComplete="nickname"
          placeholder={isSlovenian ? "Tvoj vzdevek" : "Your nickname"}
          value={nickname}
          onChange={(event) => {
            setNickname(event.target.value);
            setError("");
          }}
          className={`h-10 rounded-lg text-base focus:border-violet-400 focus:ring-violet-400/20 sm:text-sm ${
            darkMode ? "border-gray-600 bg-gray-900 text-white" : "border-gray-200 text-gray-900"
          }`}
          maxLength={15}
          required
          readOnly={isLoading}
          aria-describedby={error ? "guest-entry-error" : undefined}
        />
      </div>

      {error && (
        <p id="guest-entry-error" role="alert" className={`text-sm ${darkMode ? "text-red-400" : "text-red-600"}`}>
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="h-10 w-full rounded-lg bg-gradient-to-br from-violet-600 to-indigo-700 text-white hover:from-violet-700 hover:to-indigo-800 focus-visible:ring-violet-500"
      >
        {isLoading ? t("register.loading", language) : (isSlovenian ? "Vstopi" : "Join")}
      </Button>
    </form>
  );
}

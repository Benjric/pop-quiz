"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PinForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const digits = pin.replace(/\D/g, "");
        if (digits.length !== 6) {
          setError("The game PIN has 6 digits. It's on the big screen.");
          return;
        }
        router.push(`/play?pin=${digits}`);
      }}
    >
      <label htmlFor="pin" className="text-lg font-bold">
        Game PIN
      </label>
      <input
        id="pin"
        inputMode="numeric"
        autoComplete="off"
        placeholder="000 000"
        maxLength={7}
        value={pin}
        onChange={(e) => {
          setError(null);
          setPin(e.target.value);
        }}
        className="field h-16 text-center font-display text-3xl font-extrabold tracking-[0.12em]"
      />
      {error ? (
        <p role="alert" className="text-sm font-semibold text-danger">
          {error}
        </p>
      ) : null}
      <button type="submit" className="btn btn-dark h-14 text-xl">
        Enter
      </button>
    </form>
  );
}

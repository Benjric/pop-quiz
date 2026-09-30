"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";

/** A phone-sized window onto a page, so it renders at real phone size. */
export function PhoneFrame({ src, label }: { src: string; label?: string }) {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col items-center gap-4 sm:items-start">
      {label ? <p className="font-display text-lg font-extrabold">{label}</p> : null}
      <div className="rounded-[52px] bg-ink p-3 shadow-[0_24px_60px_-20px_rgba(30,27,58,0.6)]">
        <iframe
          key={run}
          src={src}
          title="Phone preview"
          className="block h-[min(844px,80dvh)] w-97.5 max-w-[calc(100vw-56px)] rounded-[40px] bg-brand"
        />
      </div>
      <button type="button" onClick={() => setRun((r) => r + 1)} className="btn btn-outline">
        <RotateCcw size={18} /> Replay
      </button>
    </div>
  );
}

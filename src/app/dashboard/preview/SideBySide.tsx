"use client";

import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { REPLAY_MESSAGE } from "@/app/host/preview/previewData";

const PROJECTOR = { w: 1280, h: 720 };
const PHONE = { w: 390, h: 844, scale: 0.72 };

const STUDENTS = [
  { id: "sofia", label: "Sofia · 5th", src: "/host/preview/phone" },
  { id: "mia", label: "Mia · 1st", src: "/host/preview/phone?as=winner" },
] as const;

/**
 * The projector's finale and a student's phone, side by side and in step.
 * Both are the real screens with made-up players, drawn at their true size
 * and scaled down to fit.
 */
export function SideBySide() {
  const projector = useRef<HTMLIFrameElement>(null);
  const phone = useRef<HTMLIFrameElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const [student, setStudent] = useState<(typeof STUDENTS)[number]>(STUDENTS[0]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setScale(entry.contentRect.width / PROJECTOR.w));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const replay = () => {
    for (const frame of [projector.current, phone.current]) {
      frame?.contentWindow?.postMessage(REPLAY_MESSAGE, window.location.origin);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={replay} className="btn btn-primary">
          <RotateCcw size={18} /> Replay both
        </button>
        <span className="text-sm font-bold text-muted">Phone:</span>
        {STUDENTS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={student.id === s.id}
            onClick={() => setStudent(s)}
            className={`btn btn-sm ${student.id === s.id ? "bg-brand text-white" : "btn-outline"}`}
          >
            {s.label}
          </button>
        ))}
        <span className="text-sm text-muted">Click the big screen once to hear the drum roll.</span>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[1_1_560px] flex-col gap-2">
          <h2 className="font-display text-lg font-extrabold">Big screen</h2>
          <div
            ref={box}
            className="relative w-full overflow-hidden rounded-2xl border-4 border-ink bg-ivory"
            style={{ aspectRatio: `${PROJECTOR.w} / ${PROJECTOR.h}` }}
          >
            <iframe
              ref={projector}
              src="/host/preview/projector"
              title="Big screen preview"
              className="absolute top-0 left-0 border-0"
              style={{ width: PROJECTOR.w, height: PROJECTOR.h, transform: `scale(${scale})`, transformOrigin: "0 0" }}
            />
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-extrabold">{student.label.replace(" · ", "'s phone · ")}</h2>
          <div
            className="relative overflow-hidden rounded-[40px] border-[10px] border-ink bg-brand"
            style={{ width: PHONE.w * PHONE.scale + 20, height: PHONE.h * PHONE.scale + 20 }}
          >
            <iframe
              key={student.id}
              ref={phone}
              src={student.src}
              title="Phone preview"
              // A new student reloads the phone; restart both so they match.
              onLoad={replay}
              className="absolute top-0 left-0 border-0"
              style={{ width: PHONE.w, height: PHONE.h, transform: `scale(${PHONE.scale})`, transformOrigin: "0 0" }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

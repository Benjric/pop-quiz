import { PhoneFrame } from "./PhoneFrame";

export const metadata = { title: "Preview the ending" };

export default function PreviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">What students see at the end</h1>
        <p className="mt-1 max-w-2xl text-muted">
          A made-up game where this phone is &ldquo;Sofia&rdquo;, who finished 5th of 10. The phone counts down 10th to
          4th with the projector, waits while the podium plays, then shows her place and points. The top 3 are only
          shown on the big screen.
        </p>
      </div>
      <PhoneFrame src="/host/preview/phone" />
    </div>
  );
}

import { PhoneFrame } from "./PhoneFrame";

export const metadata = { title: "Preview the ending" };

export default function PreviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">What students see at the end</h1>
        <p className="mt-1 max-w-2xl text-muted">
          A made-up game where this phone is &ldquo;Ava&rdquo;, who finished 3rd of 10. First the phone waits while the
          projector counts down 10th to 4th and plays the podium, then it shows the place and the top 10.
        </p>
      </div>
      <PhoneFrame src="/host/preview/phone" />
    </div>
  );
}

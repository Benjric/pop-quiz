import { PhoneFrame } from "./PhoneFrame";

export const metadata = { title: "Preview the ending" };

export default function PreviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">What students see at the end</h1>
        <p className="mt-1 max-w-2xl text-muted">
          A made-up game with 10 players. Phones count down 10th to 4th with the projector, then show one final screen.
          A top-3 student sees &ldquo;Top 3!&rdquo; until the podium on the big screen has revealed the winner, then
          their place.
        </p>
      </div>
      <div className="flex flex-wrap gap-8">
        <PhoneFrame src="/host/preview/phone" label="Sofia · finished 5th" />
        <PhoneFrame src="/host/preview/phone?as=winner" label="Mia · finished 1st" />
      </div>
    </div>
  );
}

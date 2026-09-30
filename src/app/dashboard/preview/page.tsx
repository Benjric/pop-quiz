import { SideBySide } from "./SideBySide";

export const metadata = { title: "Preview the ending" };

export default function PreviewPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold">Preview the ending</h1>
        <p className="mt-1 max-w-3xl text-muted">
          The big screen and a student&apos;s phone at the end of a made-up game with 10 players, playing together.
          Places 10th to 4th count down on both; the top 3 are only revealed on the big screen.
        </p>
      </div>
      <SideBySide />
    </div>
  );
}

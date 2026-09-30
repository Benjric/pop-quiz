import { PhoneEndingPreview } from "./PhoneEndingPreview";

export const metadata = { title: "Phone ending preview" };

/** Teacher-only (under /host): the phone's end-of-game screens with made-up players. */
export default function PhonePreviewPage() {
  return <PhoneEndingPreview />;
}

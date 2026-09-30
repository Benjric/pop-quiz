import { PhoneEndingPreview } from "./PhoneEndingPreview";

export const metadata = { title: "Phone ending preview" };

/**
 * Teacher-only (under /host): the phone's end-of-game screen with made-up
 * players. `?as=winner` plays it as the 1st-place student.
 */
export default async function PhonePreviewPage(props: PageProps<"/host/preview/phone">) {
  const { as } = await props.searchParams;
  return <PhoneEndingPreview winner={as === "winner"} />;
}

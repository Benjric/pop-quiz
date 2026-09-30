import { PlayClient } from "./PlayClient";

export const metadata = { title: "Play" };

export default async function PlayPage(props: PageProps<"/play">) {
  const { pin } = await props.searchParams;
  const initialPin = typeof pin === "string" ? pin.replace(/\D/g, "").slice(0, 6) : "";
  return <PlayClient initialPin={initialPin} />;
}

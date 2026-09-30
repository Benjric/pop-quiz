import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacherId } from "@/lib/session";
import { HostScreen } from "./HostScreen";

export const metadata = { title: "Projector" };

export default async function HostPage(props: PageProps<"/host/[gameId]">) {
  const teacherId = await requireTeacherId();
  const { gameId } = await props.params;
  const game = await prisma.game.findFirst({ where: { id: gameId, quiz: { teacherId } }, select: { id: true } });
  if (!game) notFound();
  return <HostScreen gameId={game.id} />;
}

import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireTeacherId } from "@/lib/session";
import { Monitor } from "./Monitor";

export const metadata = { title: "Monitor" };

export default async function MonitorPage(props: PageProps<"/dashboard/games/[gameId]/monitor">) {
  const teacherId = await requireTeacherId();
  const { gameId } = await props.params;
  const game = await prisma.game.findFirst({ where: { id: gameId, quiz: { teacherId } }, select: { id: true } });
  if (!game) notFound();
  return <Monitor gameId={game.id} />;
}

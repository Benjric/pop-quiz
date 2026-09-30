import { ProjectorFinalePreview } from "./ProjectorFinalePreview";

export const metadata = { title: "Projector ending preview" };

/** Teacher-only (under /host): the projector's finale with made-up players. */
export default function ProjectorPreviewPage() {
  return <ProjectorFinalePreview />;
}

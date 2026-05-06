import type { ProfileRow } from "../../lib/api";
import { PaletteCard } from "./PaletteCard";
import { SourcePdfCard } from "./SourcePdfCard";
import { VersionTimeline } from "./VersionTimeline";

interface Props {
  brandId: string;
  current: ProfileRow | null;
  versions: ProfileRow[];
}

export function Sidebar({ brandId, current, versions }: Props) {
  return (
    <aside className="bd-side">
      {current?.sourcePdfFilename && (
        <SourcePdfCard
          filename={current.sourcePdfFilename}
          sizeBytes={current.sourcePdfSizeBytes ?? 0}
          s3Key={current.sourcePdfS3Key}
        />
      )}
      {current?.profile?.visual.palette && <PaletteCard palette={current.profile.visual.palette} />}
      <VersionTimeline brandId={brandId} versions={versions} />
    </aside>
  );
}

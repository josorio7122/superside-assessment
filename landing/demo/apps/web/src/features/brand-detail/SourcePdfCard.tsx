interface Props {
  filename: string;
  sizeBytes: number;
  s3Key: string | null;
}

function formatSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

export function SourcePdfCard({ filename, sizeBytes, s3Key }: Props) {
  const inner = (
    <>
      <div className="source-icon" aria-hidden="true">
        <svg width="22" height="28" viewBox="0 0 22 28" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M3 1.5 H15 L20 6.5 V26.5 H3 Z" />
          <path d="M15 1.5 V6.5 H20" />
          <path d="M6 12 H17 M6 16 H17 M6 20 H13" strokeWidth="1.2" />
        </svg>
      </div>
      <div className="source-meta">
        <p className="source-name">{filename}</p>
        <p className="source-sub">{formatSize(sizeBytes)}</p>
      </div>
      <span className="source-arrow" aria-hidden="true">
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M2 9 L9 2 M4 2 L9 2 L9 7" />
        </svg>
      </span>
    </>
  );

  if (!s3Key) {
    return <div className="source-card">{inner}</div>;
  }

  const href = `/api/_storage/${s3Key}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="source-card source-card-link"
      aria-label={`Download ${filename}`}
    >
      {inner}
    </a>
  );
}

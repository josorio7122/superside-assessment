import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";

interface Props {
  brandId: string;
}

export function ReplaceWithPdfCard({ brandId }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (f: File) => api.profiles.upload(brandId, f),
    onMutate: () => setStatus("Uploading…"),
    onSuccess: () => {
      setStatus("Queued for extraction");
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
    onError: (e) => setStatus(`Error: ${(e as Error).message}`),
  });

  return (
    <section className="replace-card">
      <header>
        <p className="eyebrow">guideline</p>
        <h2>Replace with new PDF</h2>
      </header>
      <p className="replace-card-body">
        Upload a new brand-guideline PDF. The current version stays current until extraction
        succeeds.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload.mutate(f);
        }}
      />
      <div className="replace-card-actions">
        <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? "Uploading…" : "Upload PDF"}
        </Button>
      </div>
      {status && <p className="replace-card-status mono">{status}</p>}
    </section>
  );
}

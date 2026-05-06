import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Button } from "../../components/ui/button";
import { api } from "../../lib/api";

interface Props {
  brandId: string;
}

export function UploadCard({ brandId }: Props) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: (f: File) => api.profiles.upload(brandId, f),
    onMutate: () => setStatus("uploading…"),
    onSuccess: () => {
      setStatus("queued for extraction");
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
    onError: (e) => setStatus(`error: ${(e as Error).message}`),
  });

  const handAuthor = useMutation({
    mutationFn: () => api.profiles.handAuthor(brandId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      qc.invalidateQueries({ queryKey: ["brand", brandId, "profiles"] });
    },
  });

  return (
    <div className="upload-card">
      <p className="lbl">guideline</p>
      <h2>No profile yet</h2>
      <p>
        Upload a brand-guideline PDF to extract a structured profile, or hand-author one from scratch. Extraction runs
        through OpenRouter and typically completes in 30–60s.
      </p>
      <div className="upload-actions">
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
        <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? "Uploading…" : "Upload PDF"}
        </Button>
        <Button variant="outline" onClick={() => handAuthor.mutate()} disabled={handAuthor.isPending}>
          {handAuthor.isPending ? "Creating…" : "Hand-author"}
        </Button>
      </div>
      {status && <p className="upload-status">{status}</p>}
    </div>
  );
}

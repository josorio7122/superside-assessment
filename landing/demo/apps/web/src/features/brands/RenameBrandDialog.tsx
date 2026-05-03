import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { api } from "../../lib/api";

interface Props {
  brandId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameBrandDialog({ brandId, currentName, open, onOpenChange }: Props) {
  const [name, setName] = useState(currentName);
  const qc = useQueryClient();

  useEffect(() => {
    if (open) setName(currentName);
  }, [open, currentName]);

  const m = useMutation({
    mutationFn: (newName: string) => api.brands.rename(brandId, newName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      qc.invalidateQueries({ queryKey: ["brand", brandId] });
      onOpenChange(false);
    },
  });

  const trimmed = name.trim();
  const disabled = trimmed.length === 0 || trimmed === currentName || m.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename brand</DialogTitle>
          <DialogDescription>
            Pick a new name for <strong>{currentName}</strong>.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!disabled) m.mutate(trimmed);
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="rename-brand-name">Brand name</Label>
            <Input id="rename-brand-name" value={name} autoFocus onChange={(e) => setName(e.target.value)} />
          </div>
          {m.isError && <p className="text-[0.8125rem] text-[oklch(50%_0.13_25)]">{(m.error as Error).message}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={disabled}>
              {m.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

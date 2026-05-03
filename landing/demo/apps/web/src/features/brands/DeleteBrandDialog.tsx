import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";
import { api } from "../../lib/api";

interface Props {
  brandId: string;
  brandName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteBrandDialog({ brandId, brandName, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api.brands.archive(brandId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete {brandName}?</DialogTitle>
          <DialogDescription>
            The brand and its guideline history will be hidden from the list. Generations and usage rows for audit
            purposes are kept.
          </DialogDescription>
        </DialogHeader>
        {m.isError && <p className="text-[0.8125rem] text-[oklch(50%_0.13_25)]">{(m.error as Error).message}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={m.isPending} onClick={() => m.mutate()}>
            {m.isPending ? "Deleting…" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

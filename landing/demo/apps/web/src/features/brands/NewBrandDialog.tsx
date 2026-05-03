import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { api } from "../../lib/api";

export function NewBrandDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const qc = useQueryClient();

  const create = useMutation({
    mutationFn: () => api.brands.create(name.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["brands"] });
      setOpen(false);
      setName("");
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setName("");
          create.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <button type="button" className="head-btn primary">
          + New brand
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New brand</DialogTitle>
          <DialogDescription>
            Create a brand workspace. You can upload a guideline PDF or hand-author a profile next.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) create.mutate();
          }}
          className="flex flex-col gap-3"
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="brand-name">Brand name</Label>
            <Input
              id="brand-name"
              placeholder="e.g. Patagonia"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
              maxLength={80}
            />
          </div>
          {create.isError && (
            <p className="text-[0.75rem] text-[oklch(45%_0.16_25)]">
              {(create.error as Error).message}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={create.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

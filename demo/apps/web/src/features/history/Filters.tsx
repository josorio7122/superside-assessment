import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../../components/ui/select";
import { api } from "../../lib/api";

export interface HistoryFilters {
  brandId?: string;
  type?: "copy_variant" | "translate" | "image";
  status?: "pending" | "running" | "done" | "failed";
  userId?: string;
}

interface Props {
  value: HistoryFilters;
  onChange: (next: HistoryFilters) => void;
}

const ANY = "__any__";

export function Filters({ value, onChange }: Props) {
  const brands = useQuery({ queryKey: ["brands"], queryFn: api.brands.list });
  const users = useQuery({ queryKey: ["users"], queryFn: api.users.list });

  const set = <K extends keyof HistoryFilters>(k: K, v: HistoryFilters[K]) => onChange({ ...value, [k]: v });

  const dirty = !!(value.brandId || value.type || value.status || value.userId);

  return (
    <div className="hist-filters">
      <span className="lbl">filter</span>

      <Select value={value.brandId ?? ANY} onValueChange={(v) => set("brandId", v === ANY ? undefined : v)}>
        <SelectTrigger aria-label="Brand filter" style={{ minWidth: "9rem" }}>
          <SelectValue placeholder="Brand" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All brands</SelectItem>
          {brands.data?.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={value.type ?? ANY}
        onValueChange={(v) => set("type", v === ANY ? undefined : (v as HistoryFilters["type"]))}
      >
        <SelectTrigger aria-label="Type filter" style={{ minWidth: "9rem" }}>
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All types</SelectItem>
          <SelectItem value="copy_variant">Copy variant</SelectItem>
          <SelectItem value="translate">Translate</SelectItem>
          <SelectItem value="image">Image</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={value.status ?? ANY}
        onValueChange={(v) => set("status", v === ANY ? undefined : (v as HistoryFilters["status"]))}
      >
        <SelectTrigger aria-label="Status filter" style={{ minWidth: "9rem" }}>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>Any status</SelectItem>
          <SelectItem value="done">Done</SelectItem>
          <SelectItem value="running">Running</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
        </SelectContent>
      </Select>

      <Select value={value.userId ?? ANY} onValueChange={(v) => set("userId", v === ANY ? undefined : v)}>
        <SelectTrigger aria-label="User filter" style={{ minWidth: "9rem" }}>
          <SelectValue placeholder="User" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>All users</SelectItem>
          {users.data?.map((u) => (
            <SelectItem key={u.id} value={u.id}>
              {u.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {dirty && (
        <button type="button" className="reset-btn" onClick={() => onChange({})}>
          Reset
        </button>
      )}
    </div>
  );
}

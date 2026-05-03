import type { BrandProfile } from "@studio/schemas";

const BASE = "/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init?.body && !isForm ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(body?.error?.message ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ============================================================================
// DTOs (mirrors apps/api responses)
// ============================================================================

export interface Brand {
  id: string;
  orgId: string;
  name: string;
  deletedAt: string | null;
  createdAt: string;
}

export interface BrandWithStats extends Brand {
  genCount30d: number;
  lastActivityAt: string | null;
  profileStatus: "processing" | "ready" | "failed" | null;
}

export interface BrandDetailResponse {
  brand: Brand;
  currentProfile: ProfileRow | null;
  stats: { genCount30d: number; lastActivityAt: string | null };
}

export interface ProfileRow {
  id: string;
  orgId: string;
  brandId: string;
  version: number;
  status: "processing" | "ready" | "failed";
  profile: BrandProfile | null;
  sourcePdfS3Key: string | null;
  sourcePdfFilename: string | null;
  sourcePdfSizeBytes: number | null;
  ingestError: string | null;
  isCurrent: boolean;
  createdBy: string | null;
  createdAt: string;
}

export interface GenerationRow {
  id: string;
  orgId: string;
  brandId: string;
  userId: string;
  type: "copy_variant" | "translate" | "image";
  status: "pending" | "running" | "done" | "failed";
  input: unknown;
  output: unknown;
  error: string | null;
  figmaFileKey: string | null;
  figmaNodeId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface UsageRollupRow {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  avgLatencyMs: number;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
}

// ============================================================================
// API client
// ============================================================================

export const api = {
  me: () => req<{ orgId: string; userId: string }>("/me"),

  users: {
    list: () => req<UserRow[]>("/users"),
  },

  brands: {
    list: () => req<BrandWithStats[]>("/brands"),
    create: (name: string) =>
      req<Brand>("/brands", {
        method: "POST",
        body: JSON.stringify({ name }),
      }),
    detail: (id: string) => req<BrandDetailResponse>(`/brands/${id}`),
    rename: (id: string, name: string) =>
      req<Brand>(`/brands/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      }),
    archive: (id: string) =>
      req<Brand>(`/brands/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ archived: true }),
      }),
  },

  profiles: {
    listForBrand: (brandId: string) => req<ProfileRow[]>(`/brands/${brandId}/profiles`),
    get: (id: string) => req<ProfileRow>(`/profiles/${id}`),
    upload: (brandId: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return req<ProfileRow>(`/brands/${brandId}/profiles`, {
        method: "POST",
        body: fd,
      });
    },
    handAuthor: (brandId: string, profile?: BrandProfile) =>
      req<ProfileRow>(`/brands/${brandId}/profiles`, {
        method: "POST",
        body: JSON.stringify(profile ? { profile } : {}),
      }),
    edit: (id: string, profile: BrandProfile) =>
      req<ProfileRow>(`/profiles/${id}`, {
        method: "PUT",
        body: JSON.stringify({ profile }),
      }),
    retry: (id: string) => req<ProfileRow>(`/profiles/${id}/retry`, { method: "POST" }),
    setCurrent: (id: string) => req<ProfileRow>(`/profiles/${id}/set-current`, { method: "POST" }),
    eventsUrl: (id: string) => `/api/profiles/${id}/events`,
  },

  generations: {
    list: (q: Record<string, string | number | undefined>) => {
      const usp = new URLSearchParams();
      for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "") usp.set(k, String(v));
      return req<{ items: GenerationRow[]; nextCursor: string | null }>(`/generations?${usp}`);
    },
    get: (id: string) => req<GenerationRow>(`/generations/${id}`),
  },

  usage: {
    rollup: (groupBy: "user" | "brand" | "day" | "feature", days: number) =>
      req<UsageRollupRow[]>(`/usage?groupBy=${groupBy}&days=${days}`),
  },
};

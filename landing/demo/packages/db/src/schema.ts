import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  numeric,
  pgEnum,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { BrandProfile } from "@studio/schemas";

export const profileStatus = pgEnum("brand_profile_status", ["processing", "ready", "failed"]);
export const generationType = pgEnum("generation_type", ["copy_variant", "translate", "image"]);
export const generationStatus = pgEnum("generation_status", [
  "pending",
  "running",
  "done",
  "failed",
]);
export const usageFeature = pgEnum("usage_feature", [
  "copy_variant",
  "translate",
  "image",
  "extract",
]);

export const orgs = pgTable("org", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable(
  "user",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    email: text("email").notNull(),
    name: text("name").notNull(),
    role: text("role").notNull().default("designer"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index("user_org_idx").on(t.orgId) }),
);

export const brands = pgTable(
  "brand",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    name: text("name").notNull(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({ orgIdx: index("brand_org_idx").on(t.orgId) }),
);

export const brandProfiles = pgTable(
  "brand_profile",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id),
    version: integer("version").notNull(),
    profile: jsonb("profile").$type<BrandProfile | null>(),
    sourcePdfS3Key: text("source_pdf_s3_key"),
    sourcePdfFilename: text("source_pdf_filename"),
    sourcePdfSizeBytes: integer("source_pdf_size_bytes"),
    status: profileStatus("status").notNull(),
    ingestError: text("ingest_error"),
    isCurrent: boolean("is_current").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("bp_org_idx").on(t.orgId),
    versionIdx: index("bp_brand_version_idx").on(t.orgId, t.brandId, t.version),
    currentUnique: uniqueIndex("bp_brand_current_unique")
      .on(t.brandId)
      .where(sql`${t.isCurrent} = true`),
    statusIdx: index("bp_status_idx")
      .on(t.orgId, t.status)
      .where(sql`${t.status} IN ('processing','failed')`),
  }),
);

export const generations = pgTable(
  "generation",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    type: generationType("type").notNull(),
    status: generationStatus("status").notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output"),
    error: text("error"),
    figmaFileKey: text("figma_file_key"),
    figmaNodeId: text("figma_node_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("gen_org_idx").on(t.orgId),
    userTimeIdx: index("gen_user_time_idx").on(t.orgId, t.userId, t.createdAt),
    activeIdx: index("gen_active_idx")
      .on(t.orgId, t.status)
      .where(sql`${t.status} IN ('pending','running')`),
    nodeLockIdx: uniqueIndex("gen_node_lock_idx")
      .on(t.orgId, t.figmaFileKey, t.figmaNodeId)
      .where(sql`${t.type} = 'image' AND ${t.status} IN ('pending','running')`),
  }),
);

export const usageEvents = pgTable(
  "usage_event",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => orgs.id),
    brandId: uuid("brand_id").references(() => brands.id),
    userId: uuid("user_id").references(() => users.id),
    generationId: uuid("generation_id").references(() => generations.id),
    feature: usageFeature("feature").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    costUsd: numeric("cost_usd", { precision: 10, scale: 6 }).notNull(),
    latencyMs: integer("latency_ms").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    orgIdx: index("ue_org_idx").on(t.orgId),
    timeIdx: index("ue_time_idx").on(t.orgId, t.createdAt),
    userTimeIdx: index("ue_user_time_idx").on(t.orgId, t.userId, t.createdAt),
    brandTimeIdx: index("ue_brand_time_idx").on(t.orgId, t.brandId, t.createdAt),
  }),
);

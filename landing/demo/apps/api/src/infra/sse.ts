import type { Context } from "hono";
import { GENERATION_EVENTS_CHANNEL, PROFILE_EVENTS_CHANNEL, redisSub } from "./redis.js";

export type ProfileEvent = {
  profileId: string;
  event: "ready" | "failed";
  error?: string;
};

let subscribed = false;
const subscribers = new Map<string, Set<(e: ProfileEvent) => void>>();

async function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  await redisSub.subscribe(PROFILE_EVENTS_CHANNEL);
  redisSub.on("message", (channel, message) => {
    if (channel !== PROFILE_EVENTS_CHANNEL) return;
    try {
      const parsed = JSON.parse(message) as ProfileEvent;
      const set = subscribers.get(parsed.profileId);
      if (set) for (const cb of set) cb(parsed);
    } catch {}
  });
}

export async function streamProfileEvents(c: Context, profileId: string) {
  await ensureSubscribed();

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("open", { profileId });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      const cb = (e: ProfileEvent) => send(e.event, e);
      const set = subscribers.get(profileId) ?? new Set();
      set.add(cb);
      subscribers.set(profileId, set);

      const abort = () => {
        clearInterval(heartbeat);
        const s = subscribers.get(profileId);
        if (s) {
          s.delete(cb);
          if (s.size === 0) subscribers.delete(profileId);
        }
        try {
          controller.close();
        } catch {}
      };
      c.req.raw.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export type GenerationEvent =
  | { generationId: string; event: "variant_ready"; index: number; s3Key: string; size: string }
  | { generationId: string; event: "done"; output: unknown }
  | { generationId: string; event: "failed"; error: string };

let genSubscribed = false;
const genSubscribers = new Map<string, Set<(e: GenerationEvent) => void>>();

async function ensureGenSubscribed() {
  if (genSubscribed) return;
  genSubscribed = true;
  await redisSub.subscribe(GENERATION_EVENTS_CHANNEL);
  redisSub.on("message", (channel, message) => {
    if (channel !== GENERATION_EVENTS_CHANNEL) return;
    try {
      const parsed = JSON.parse(message) as GenerationEvent;
      const set = genSubscribers.get(parsed.generationId);
      if (set) for (const cb of set) cb(parsed);
    } catch {}
  });
}

export async function streamGenerationEvents(c: Context, generationId: string) {
  await ensureGenSubscribed();

  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));

      send("open", { generationId });

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: keepalive\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 25_000);

      const cb = (e: GenerationEvent) => send(e.event, e);
      const set = genSubscribers.get(generationId) ?? new Set();
      set.add(cb);
      genSubscribers.set(generationId, set);

      const abort = () => {
        clearInterval(heartbeat);
        const s = genSubscribers.get(generationId);
        if (s) {
          s.delete(cb);
          if (s.size === 0) genSubscribers.delete(generationId);
        }
        try {
          controller.close();
        } catch {}
      };
      c.req.raw.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

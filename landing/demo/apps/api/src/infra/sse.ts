import type { Context } from "hono";
import { redisSub, PROFILE_EVENTS_CHANNEL } from "./redis.js";

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

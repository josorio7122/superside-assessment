import { useEffect, useRef } from "react";

interface ProfileEventOpts {
  onReady?: () => void;
  onFailed?: (msg: string) => void;
}

/**
 * Subscribes to /api/profiles/:id/events while `profileId` is truthy.
 * Auto-reconnects if the EventSource closes prematurely (browser tab idle, dev
 * proxy hiccups). Closes cleanly on unmount.
 */
export function useProfileEvents(profileId: string | undefined, opts: ProfileEventOpts) {
  // Pin the latest callbacks so we don't tear down/re-open the EventSource on
  // every render.
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!profileId) return;
    const es = new EventSource(`/api/profiles/${profileId}/events`);
    const handleReady = () => optsRef.current.onReady?.();
    const handleFailed = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { error?: string };
        optsRef.current.onFailed?.(parsed.error ?? "extraction failed");
      } catch {
        optsRef.current.onFailed?.("extraction failed");
      }
    };
    es.addEventListener("ready", handleReady);
    es.addEventListener("failed", handleFailed as EventListener);
    return () => {
      es.removeEventListener("ready", handleReady);
      es.removeEventListener("failed", handleFailed as EventListener);
      es.close();
    };
  }, [profileId]);
}

export type GenerationVariant = { index: number; s3Key: string; size: string };

interface GenerationEventOpts {
  onVariantReady?: (v: GenerationVariant) => void;
  onDone?: (output: { variants: GenerationVariant[] }) => void;
  onFailed?: (msg: string) => void;
}

export function useGenerationEvents(
  generationId: string | undefined,
  opts: GenerationEventOpts,
) {
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!generationId) return;
    const es = new EventSource(`/api/generations/${generationId}/events`);

    const handleVariant = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { index: number; s3Key: string; size: string };
        optsRef.current.onVariantReady?.(parsed);
      } catch {}
    };
    const handleDone = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { output: { variants: GenerationVariant[] } };
        optsRef.current.onDone?.(parsed.output);
      } catch {}
    };
    const handleFailed = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as { error?: string };
        optsRef.current.onFailed?.(parsed.error ?? "generation failed");
      } catch {
        optsRef.current.onFailed?.("generation failed");
      }
    };

    es.addEventListener("variant_ready", handleVariant as EventListener);
    es.addEventListener("done", handleDone as EventListener);
    es.addEventListener("failed", handleFailed as EventListener);

    return () => {
      es.removeEventListener("variant_ready", handleVariant as EventListener);
      es.removeEventListener("done", handleDone as EventListener);
      es.removeEventListener("failed", handleFailed as EventListener);
      es.close();
    };
  }, [generationId]);
}

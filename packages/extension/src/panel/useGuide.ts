import { useEffect, useState } from 'react';
import { ApiError, streamGuide, type ServerConfig } from '../lib/api';
import { applyStream, EMPTY, type Conversation } from '../lib/conversation';

export type GuideState = Conversation & { streamError?: string };

/**
 * Follows a guide session for as long as the panel shows it. Every connection
 * starts with a full snapshot, so a dropped stream just reconnects (backing
 * off to 10 s); a 401 or 404 won't get better by retrying.
 */
export function useGuide(server: ServerConfig | null | undefined, sessionID: string | undefined): GuideState {
  const [conv, setConv] = useState<Conversation>(EMPTY);
  const [streamError, setStreamError] = useState<string>();
  const origin = server?.origin;
  const token = server?.token;

  useEffect(() => {
    setConv(EMPTY);
    setStreamError(undefined);
    if (!origin || !token || !sessionID) return;
    const cfg = { origin, token };
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const run = async () => {
      try {
        await streamGuide(
          cfg,
          sessionID,
          (m) => {
            attempt = 0;
            setStreamError(undefined);
            setConv((c) => applyStream(c, m));
          },
          ctrl.signal,
        );
      } catch (e) {
        if (ctrl.signal.aborted) return;
        setStreamError(e instanceof Error ? e.message : String(e));
        if (e instanceof ApiError && (e.status === 401 || e.status === 404)) return;
      }
      if (ctrl.signal.aborted) return;
      timer = setTimeout(() => void run(), Math.min(10_000, 1000 * 2 ** attempt++));
    };
    void run();
    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [origin, token, sessionID]);

  return { ...conv, streamError };
}

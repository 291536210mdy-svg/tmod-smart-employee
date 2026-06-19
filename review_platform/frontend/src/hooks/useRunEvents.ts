import { fetchEventSource } from "@microsoft/fetch-event-source";
import { useEffect, useMemo, useState } from "react";

import { API_BASE, getEvents } from "../api/client";
import type { RunEvent, RunStatus } from "../api/types";
import { isTerminalStatus } from "../components/StatusBadge";

export function useRunEvents({
  runId,
  token,
  enabled,
  onTerminal
}: {
  runId: string | undefined;
  token: string;
  enabled: boolean;
  onTerminal?: () => void;
}) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [error, setError] = useState("");
  const lastId = useMemo(() => events.reduce((max, event) => Math.max(max, event.id), 0), [events]);

  useEffect(() => {
    if (!runId || !enabled || !token) {
      return;
    }

    let cancelled = false;
    const activeRunId = runId;
    const controller = new AbortController();

    const appendEvents = (incoming: RunEvent[]) => {
      setEvents((current) => {
        const byId = new Map<number, RunEvent>();
        for (const event of current) {
          byId.set(event.id, event);
        }
        for (const event of incoming) {
          byId.set(event.id, event);
        }
        return Array.from(byId.values()).sort((left, right) => left.id - right.id);
      });
    };

    async function connect() {
      try {
        const initial = await getEvents(activeRunId);
        if (cancelled) {
          return;
        }
        appendEvents(initial);
        const afterId = initial.reduce((max, event) => Math.max(max, event.id), 0);

        await fetchEventSource(`${API_BASE}/api/runs/${activeRunId}/events/stream?after_id=${afterId}`, {
          signal: controller.signal,
          headers: {
            Authorization: `Bearer ${token}`
          },
          onmessage(message) {
            if (!message.data) {
              return;
            }
            const event = JSON.parse(message.data) as RunEvent;
            appendEvents([event]);
            const status = event.payload?.status;
            if (typeof status === "string" && isTerminalStatus(status as RunStatus)) {
              onTerminal?.();
            }
          },
          onerror(err) {
            setError(err instanceof Error ? err.message : "事件连接中断");
            throw err;
          }
        });
      } catch (err) {
        if (!controller.signal.aborted && !cancelled) {
          setError(err instanceof Error ? err.message : "事件连接失败");
        }
      }
    }

    void connect();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [enabled, onTerminal, runId, token]);

  return { events, error, lastId };
}

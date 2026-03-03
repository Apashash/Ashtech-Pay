import { useEffect, useRef, useState, useCallback } from "react";

export interface SSEEvent {
  type: string;
  data: Record<string, unknown>;
}

export function useSSE(onEvent?: (event: SSEEvent) => void) {
  const [onlineIds, setOnlineIds] = useState<string[]>([]);
  const esRef = useRef<EventSource | null>(null);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const es = new EventSource("/api/sse");
    esRef.current = es;

    const handle = (eventName: string) => (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data);
        if (eventName === "online_status") {
          setOnlineIds(data.onlineIds || []);
        }
        onEventRef.current?.({ type: eventName, data });
      } catch {}
    };

    const events = ["new_message", "typing", "messages_read", "online_status"];
    events.forEach((ev) => es.addEventListener(ev, handle(ev)));

    es.onerror = () => {
      // SSE will auto-reconnect
    };

    return () => {
      events.forEach((ev) => es.removeEventListener(ev, handle(ev) as EventListener));
      es.close();
      esRef.current = null;
    };
  }, []);

  const isOnline = useCallback((userId: string) => onlineIds.includes(userId), [onlineIds]);

  return { onlineIds, isOnline };
}

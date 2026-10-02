import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { api, authHeaders } from './api';

export interface TripAlert {
  tripId: string;
  title: string;
  message: string;
  /** true when the trip no longer works and needs replanning. */
  broken: boolean;
}

interface AlertsState {
  alerts: TripAlert[];
  refresh: () => void;
  dismiss: (tripId: string) => void;
}

const AlertsContext = createContext<AlertsState | null>(null);

/**
 * Minimal Server-Sent Events client. React Native has no EventSource, but its XHR delivers
 * the response incrementally when a readystatechange handler is set before send().
 */
function subscribe(url: string, onEvent: (event: string, data: string) => void): () => void {
  let xhr: XMLHttpRequest | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const connect = () => {
    let seen = 0;
    let buffer = '';
    xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.setRequestHeader('Accept', 'text/event-stream');
    for (const [k, v] of Object.entries(authHeaders())) xhr.setRequestHeader(k, v);
    xhr.onreadystatechange = () => {
      if (!xhr) return;
      if (xhr.readyState === 3 || xhr.readyState === 4) {
        buffer += xhr.responseText.slice(seen);
        seen = xhr.responseText.length;
        let idx;
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          let event = 'message';
          const data: string[] = [];
          for (const line of block.split('\n')) {
            if (line.startsWith('event: ')) event = line.slice(7);
            else if (line.startsWith('data: ')) data.push(line.slice(6));
          }
          if (data.length) onEvent(event, data.join('\n'));
        }
      }
      if (xhr.readyState === 4 && !closed) retry = setTimeout(connect, 3000);
    };
    xhr.send();
  };

  connect();
  return () => {
    closed = true;
    if (retry) clearTimeout(retry);
    xhr?.abort();
  };
}

export function AlertsProvider({ children }: { children: ReactNode }) {
  const [alerts, setAlerts] = useState<TripAlert[]>([]);

  const refresh = useCallback(() => {
    api
      .activeAlerts()
      .then(setAlerts)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    refresh();
    const stop = subscribe(`${api.baseUrl}/api/alerts/stream`, (event, data) => {
      if (event !== 'disruption') return;
      const alert = JSON.parse(data) as TripAlert;
      setAlerts((prev) => [alert, ...prev.filter((a) => a.tripId !== alert.tripId)]);
    });
    // Safety net: if the stream drops, a slow poll still catches alerts.
    const poll = setInterval(refresh, 20_000);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      stop();
      clearInterval(poll);
      sub.remove();
    };
  }, [refresh]);

  const dismiss = useCallback((tripId: string) => {
    setAlerts((prev) => prev.filter((a) => a.tripId !== tripId));
    api.dismissAlert(tripId).catch(() => undefined);
  }, []);

  return (
    <AlertsContext.Provider value={{ alerts, refresh, dismiss }}>{children}</AlertsContext.Provider>
  );
}

export function useAlerts(): AlertsState {
  const ctx = useContext(AlertsContext);
  if (!ctx) throw new Error('useAlerts must be used inside <AlertsProvider>');
  return ctx;
}

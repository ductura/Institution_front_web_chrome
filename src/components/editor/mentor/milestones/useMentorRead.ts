import { useEffect, useState } from "react";

type Read<T> = { ok: true; body: T } | { ok: false; status: number };

export type MentorAccess = {
  documentId: string;
  current: () => boolean;
  onSessionEnd: () => void;
};

export function useMentorRead<T>(
  read: (documentId: string) => Promise<Read<T>>, { documentId, current, onSessionEnd }: MentorAccess,
) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable" | "notFound">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!current()) return;
      const result = await read(documentId).catch(() => ({ ok: false, status: 0 } as const));
      if (!active || !current()) return;
      if (result.ok) {
        setData(result.body);
        setStatus("ready");
      } else if (result.status === 401) {
        onSessionEnd();
      } else {
        setStatus(result.status === 404 ? "notFound" : "unavailable");
      }
    };
    void load();
    return () => { active = false; };
  }, [read, documentId, attempt, current, onSessionEnd]);

  return {
    data, setData, status,
    retry: () => {
      setStatus("loading");
      setAttempt((count) => count + 1);
    },
  };
}

import { useEffect, useState } from "react";
import { SESSION_EVENT } from "./api";
import { syncOnce, type Inbox } from "./votes";

export const INBOX_READ_EVENT = "bildkeller:inbox-read";

export const unreadTotal = (i: Inbox | null) => (i ? i.messages + i.notifications : 0);

/** Comments first, then private messages; anything else (follows, system) is listed under "all". */
export function inboxHref(i: Inbox | null): string {
  if (i && i.comments + i.mentions > 0) return "/inbox/comments";
  if (i && i.messages > 0) return "/inbox/messages";
  return "/inbox/all";
}

/** Tells every header to refetch its counter after the inbox marked something as read. */
export const inboxRead = () => window.dispatchEvent(new Event(INBOX_READ_EVENT));

/** Unread counters for the header envelope: polled every minute, refreshed on navigation, login and reading. */
export function useInbox(section: string): Inbox | null {
  const [inbox, setInbox] = useState<Inbox | null>(null);
  useEffect(() => {
    let alive = true;
    const load = (fresh: boolean) =>
      syncOnce(fresh)
        .then((i) => alive && setInbox(i))
        .catch(() => undefined);
    const poll = () => void load(false);
    const refresh = () => void load(true);
    poll();
    const t = setInterval(poll, 60_000);
    window.addEventListener(INBOX_READ_EVENT, refresh);
    window.addEventListener(SESSION_EVENT, refresh);
    return () => {
      alive = false;
      clearInterval(t);
      window.removeEventListener(INBOX_READ_EVENT, refresh);
      window.removeEventListener(SESSION_EVENT, refresh);
    };
  }, [section]);
  return inbox;
}

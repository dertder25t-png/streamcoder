import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const NameContext = createContext<string | null>(null);
const CountContext = createContext<number | null>(null);
type Actions = { incrementUnread: () => void; setUserName: (name: string) => void };
const ActionsContext = createContext<Actions | null>(null);

export function SplitStoreProvider({
  children,
  initialUserName = "",
  initialUnreadCount = 0,
}: {
  children: ReactNode;
  initialUserName?: string;
  initialUnreadCount?: number;
}) {
  const [userName, setUserName] = useState(initialUserName);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const actions = useMemo<Actions>(
    () => ({
      incrementUnread: () => setUnreadCount((c) => c + 1),
      setUserName: (name: string) => setUserName(name),
    }),
    [],
  );
  return (
    <ActionsContext.Provider value={actions}>
      <NameContext.Provider value={userName}>
        <CountContext.Provider value={unreadCount}>{children}</CountContext.Provider>
      </NameContext.Provider>
    </ActionsContext.Provider>
  );
}

function need<T>(v: T | null): T {
  if (v === null) throw new Error("Store hooks must be used inside <SplitStoreProvider>");
  return v;
}

export function useUserName(): string {
  return need(useContext(NameContext));
}
export function useUnreadCount(): number {
  return need(useContext(CountContext));
}
export function useStoreActions(): Actions {
  return need(useContext(ActionsContext));
}

import { createContext, useContext, useState, type ReactNode, type Dispatch, type SetStateAction } from "react";

type Store = {
  userName: string;
  unreadCount: number;
  incrementUnread: Dispatch<SetStateAction<number>>;
  setUserName: Dispatch<SetStateAction<string>>;
};

const StoreContext = createContext<Store | null>(null);

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

  const value: Store = {
    userName,
    unreadCount,
    incrementUnread: setUnreadCount,
    setUserName,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("Store hooks must be used inside <SplitStoreProvider>");
  return ctx;
}

export function useUserName(): string {
  return useStore().userName;
}

export function useUnreadCount(): number {
  return useStore().unreadCount;
}

export function useStoreActions(): { incrementUnread: Dispatch<SetStateAction<number>>; setUserName: Dispatch<SetStateAction<string>> } {
  const { incrementUnread, setUserName } = useStore();
  return { incrementUnread, setUserName };
}

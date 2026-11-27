import { createContext, useContext, useState, type ReactNode, useRef } from "react";

type Store = {
  userName: string;
  unreadCount: number;
  incrementUnread: () => void;
  setUserName: (name: string) => void;
};

const StoreContext = createContext<Store | null>(null);

const useStore = (): Store => {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("Store hooks must be used inside <SplitStoreProvider>");
  return ctx;
};

export const SplitStoreProvider = ({
  children,
  initialUserName = "",
  initialUnreadCount = 0,
}: {
  children: ReactNode;
  initialUserName?: string;
  initialUnreadCount?: number;
}) => {
  const [userName, setUserName] = useState(initialUserName);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);

  const value: Store = {
    userName,
    unreadCount,
    incrementUnread: () => setUnreadCount((c) => c + 1),
    setUserName: (name: string) => setUserName(name),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useUserName = (): string => {
  const { userName } = useStore();
  return userName;
};

export const useUnreadCount = (): number => {
  const { unreadCount } = useStore();
  return unreadCount;
};

export const useStoreActions = (): { incrementUnread: () => void; setUserName: (name: string) => void } => {
  const { incrementUnread, setUserName } = useStore();
  return { incrementUnread, setUserName };
};

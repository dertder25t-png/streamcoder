import { createContext, useContext, useState, type ReactNode, useReducer } from "react";

type Store = {
  userName: string;
  unreadCount: number;
};

type Action = 
  | { type: "SET_USERNAME"; payload: string }
  | { type: "INCREMENT_UNREAD" };

const StoreContext = createContext<Store | null>(null);

const reducer = (state: Store, action: Action): Store => {
  switch (action.type) {
    case "SET_USERNAME":
      return { ...state, userName: action.payload };
    case "INCREMENT_UNREAD":
      return { ...state, unreadCount: state.unreadCount + 1 };
    default:
      throw new Error("Unhandled action type");
  }
};

export function SplitStoreProvider({
  children,
  initialUserName = "",
  initialUnreadCount = 0,
}: {
  children: ReactNode;
  initialUserName?: string;
  initialUnreadCount?: number;
}) {
  const [state, dispatch] = useReducer(reducer, { userName: initialUserName, unreadCount: initialUnreadCount });

  const value: Store = state;

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("Store hooks must be used inside <SplitStoreProvider>");
  return ctx;
}

export function useUserName(): string {
  const { userName } = useStore();
  return userName;
}

export function useUnreadCount(): number {
  const { unreadCount } = useStore();
  return unreadCount;
}

export function useStoreActions(): { incrementUnread: () => void; setUserName: (name: string) => void } {
  const { dispatch } = useStore();

  const incrementUnread = () => dispatch({ type: "INCREMENT_UNREAD" });
  const setUserName = (name: string) => dispatch({ type: "SET_USERNAME", payload: name });

  return { incrementUnread, setUserName };
}

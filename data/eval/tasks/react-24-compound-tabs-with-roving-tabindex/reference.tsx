import { createContext, useContext, useId, useState, type ReactNode, type KeyboardEvent } from "react";

type Ctx = { value: string; select: (v: string) => void; base: string; disabled: Set<string>; order: string[] };
const C = createContext<Ctx | null>(null);
const use = () => {
  const c = useContext(C);
  if (!c) throw new Error("Tabs parts must be inside <Tabs>");
  return c;
};

export function Tabs({ defaultValue, children }: { defaultValue: string; children: ReactNode }) {
  const [value, setValue] = useState(defaultValue);
  const base = useId();
  return <C.Provider value={{ value, select: setValue, base, disabled: new Set(), order: [] }}>{children}</C.Provider>;
}

export function TabList({ children, ...rest }: { children: ReactNode; "aria-label"?: string }) {
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const tabs = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])'));
    if (tabs.length === 0) return;
    const idx = tabs.indexOf(document.activeElement as HTMLElement);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (idx - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    else return;
    e.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  };
  return (
    <div role="tablist" onKeyDown={onKeyDown} {...rest}>
      {children}
    </div>
  );
}

export function Tab({ value, disabled, children }: { value: string; disabled?: boolean; children: ReactNode }) {
  const c = use();
  const active = c.value === value;
  return (
    <button
      type="button"
      role="tab"
      id={`${c.base}-tab-${value}`}
      aria-controls={`${c.base}-panel-${value}`}
      aria-selected={active}
      tabIndex={active ? 0 : -1}
      disabled={disabled}
      onClick={() => c.select(value)}
    >
      {children}
    </button>
  );
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  const c = use();
  return (
    <div role="tabpanel" id={`${c.base}-panel-${value}`} aria-labelledby={`${c.base}-tab-${value}`} hidden={c.value !== value}>
      {children}
    </div>
  );
}

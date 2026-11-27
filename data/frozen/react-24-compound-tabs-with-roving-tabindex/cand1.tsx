import React, { forwardRef, useState, useRef, useEffect, createContext, useContext } from 'react';

type TabId = string;

interface TabsProps {
  defaultValue?: TabId;
  children: React.ReactNode;
}

interface TabListProps {
  'aria-label': string;
  children: React.ReactNode;
}

interface TabProps {
  value: TabId;
  disabled?: boolean;
  children: React.ReactNode;
}

interface TabPanelProps {
  value: TabId;
  children: React.ReactNode;
}

const TabContext = createContext<{ selectedId: TabId; onSelect: (id: TabId) => void } | null>(null);

const Tabs = forwardRef<HTMLDivElement, TabsProps>((props, ref) => {
  const { defaultValue = 'one', children } = props;
  const [selectedId, setSelectedId] = useState<TabId>(defaultValue);

  return (
    <div ref={ref}>
      <TabContext.Provider value={{ selectedId, onSelect: setSelectedId }}>
        {children}
      </TabContext.Provider>
    </div>
  );
});

const TabList = forwardRef<HTMLDivElement, TabListProps>((props, ref) => {
  const { 'aria-label': ariaLabel, children } = props;
  return (
    <div role="tablist" aria-label={ariaLabel} ref={ref}>
      {children}
    </div>
  );
});

const Tab = forwardRef<HTMLButtonElement, TabProps>((props, ref) => {
  const { value, disabled = false, children } = props;
  const tabRef = useRef<HTMLButtonElement | null>(null);
  const { selectedId, onSelect } = useContext(TabContext)!;

  useEffect(() => {
    if (tabRef.current && value === selectedId) {
      tabRef.current.focus();
    }
  }, [value, selectedId]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('button[role="tab"]'));
    const currentIndex = tabs.findIndex((tab) => tab.value === value);
    const nextIndex = (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;

    if (tabs[nextIndex].disabled) {
      if (event.key === 'ArrowRight') {
        for (let i = nextIndex + 1; i < tabs.length; i++) {
          if (!tabs[i].disabled) {
            tabs[i].focus();
            onSelect(tabs[i].value);
            break;
          }
        }
      } else {
        for (let i = nextIndex - 1; i >= 0; i--) {
          if (!tabs[i].disabled) {
            tabs[i].focus();
            onSelect(tabs[i].value);
            break;
          }
        }
      }
    } else {
      tabs[nextIndex].focus();
      onSelect(tabs[nextIndex].value);
    }
  };

  return (
    <button
      ref={mergeRefs(ref, tabRef)}
      role="tab"
      aria-selected={value === selectedId}
      tabIndex={value === selectedId ? 0 : -1}
      value={value}
      onKeyDown={handleKeyDown}
      disabled={disabled}
    >
      {children}
    </button>
  );
});

const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>((props, ref) => {
  const { value, children } = props;
  const { selectedId } = useContext(TabContext)!;

  return (
    selectedId === value ? (
      <div
        ref={ref}
        role="tabpanel"
        id={value}
        aria-labelledby={value}
        aria-controls={value}
      >
        {children}
      </div>
    ) : null
  );
});

const mergeRefs = <T extends HTMLElement>(ref1: React.Ref<T>, ref2: React.Ref<T>): React.Ref<T> => {
  if (typeof ref1 === 'function' && typeof ref2 === 'function') {
    return (el: T) => {
      ref1(el);
      ref2(el);
    };
  } else if (typeof ref1 === 'function') {
    return (el: T) => {
      ref1(el);
      if (ref2) {
        (ref2 as React.RefCallback<T>)(el);
      }
    };
  } else if (typeof ref2 === 'function') {
    return (el: T) => {
      if (ref1) {
        (ref1 as React.RefCallback<T>)(el);
      }
      ref2(el);
    };
  } else {
    return (el: T | null) => {
      if (ref1) {
        (ref1 as React.RefObject<T>).current = el;
      }
      if (ref2) {
        (ref2 as React.RefObject<T>).current = el;
      }
    };
  }
};

export { Tabs, TabList, Tab, TabPanel };

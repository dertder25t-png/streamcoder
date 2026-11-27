import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface TabsProps {
  defaultValue?: string;
  children: React.ReactNode;
}

interface TabListProps {
  'aria-label': string;
  children: React.ReactNode;
}

interface TabProps {
  value: string;
  disabled?: boolean;
  children: React.ReactNode;
}

interface TabPanelProps {
  value: string;
  children: React.ReactNode;
}

const Tabs = forwardRef<HTMLDivElement, TabsProps>((props, ref) => {
  const { defaultValue, children } = props;
  const [activeTab, setActiveTab] = useState(defaultValue || '');
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    setActiveTab(defaultValue || '');
  }, [defaultValue]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, value: string) => {
    const tabs = Object.values(tabRefs.current).filter(tab => tab && !tab.disabled);
    const currentIndex = tabs.findIndex(tab => tab && tab.value === value);
    let nextIndex = currentIndex;

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabs.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabs.length - 1;
        break;
      default:
        return;
    }

    const nextTab = tabs[nextIndex];
    if (nextTab) {
      nextTab.focus();
      setActiveTab(nextTab.value);
    }
  };

  useImperativeHandle(ref, () => ({
    focusTab: (value: string) => {
      const tab = tabRefs.current[value];
      if (tab) {
        tab.focus();
        setActiveTab(value);
      }
    }
  }));

  return (
    <div ref={ref}>
      {children}
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
  tabRefs.current[value] = tabRef.current;

  useEffect(() => {
    if (tabRef.current && tabRef.current.value === activeTab) {
      tabRef.current.focus();
    }
  }, [activeTab]);

  const handleClick = () => {
    if (!disabled) {
      setActiveTab(value);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    handleKeyDown(event, value);
  };

  return (
    <button
      role="tab"
      aria-selected={value === activeTab}
      tabIndex={value === activeTab ? 0 : -1}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      ref={tabRef}
      disabled={disabled}
    >
      {children}
    </button>
  );
});

const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>((props, ref) => {
  const { value, children } = props;

  return (
    <div
      role="tabpanel"
      id={`tabpanel-${value}`}
      aria-labelledby={`tab-${value}`}
      aria-controls={`tab-${value}`}
      ref={ref}
      hidden={value !== activeTab}
    >
      {children}
    </div>
  );
});

export { Tabs, TabList, Tab, TabPanel };

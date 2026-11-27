import React, { useState, useRef, useEffect, forwardRef, ReactNode } from 'react';

interface TabsProps {
  defaultValue?: string;
  children: ReactNode;
}

interface TabListProps {
  'aria-label': string;
  children: ReactNode;
}

interface TabProps {
  value: string;
  disabled?: boolean;
  children: ReactNode;
}

interface TabPanelProps {
  value: string;
  children: ReactNode;
}

const Tabs = forwardRef<HTMLDivElement, TabsProps>(({ defaultValue, children }, ref) => {
  const [activeTab, setActiveTab] = useState(defaultValue || '');
  const tabs = useRef<HTMLButtonElement[]>([]);

  useEffect(() => {
    if (defaultValue) {
      setActiveTab(defaultValue);
    }
  }, [defaultValue]);

  return (
    <div ref={ref} role="tablist" aria-label="demo">
      {children}
    </div>
  );
});

const TabList = forwardRef<HTMLDivElement, TabListProps>(({ 'aria-label': ariaLabel, children }, ref) => (
  <div ref={ref} role="tablist" aria-label={ariaLabel}>
    {children}
  </div>
));

const Tab = forwardRef<HTMLButtonElement, TabProps>(({ value, disabled = false, children }, ref) => {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (isActive) {
      ref.current?.focus();
    }
  }, [isActive, ref]);

  const handleClick = () => {
    if (!disabled) {
      setIsActive(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    const tabsArray = tabs.current.filter(tab => !tab.disabled);
    const currentIndex = tabsArray.indexOf(e.currentTarget);
    let nextIndex = currentIndex;

    switch (e.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % tabsArray.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + tabsArray.length) % tabsArray.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = tabsArray.length - 1;
        break;
      default:
        return;
    }

    tabsArray[nextIndex]?.focus();
    tabsArray[nextIndex]?.click();
  };

  return (
    <button
      ref={(el) => {
        if (el) tabs.current.push(el);
      }}
      role="tab"
      tabIndex={isActive ? 0 : -1}
      aria-selected={isActive}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      id={`tab-${value}`}
      aria-controls={`panel-${value}`}
      disabled={disabled}
    >
      {children}
    </button>
  );
});

const TabPanel = forwardRef<HTMLDivElement, TabPanelProps>(({ value, children }, ref) => {
  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`panel-${value}`}
      aria-labelledby={`tab-${value}`}
      hidden={!value || value !== value}
    >
      {children}
    </div>
  );
});

export { Tabs, TabList, Tab, TabPanel };

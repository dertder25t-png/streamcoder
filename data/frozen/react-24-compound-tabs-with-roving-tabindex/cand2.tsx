import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

interface TabPanelProps {
  value: string;
}

const TabPanel: React.FC<TabPanelProps> = ({ value, children }) => {
  return (
    <div role="tabpanel" id={`tabpanel-${value}`} aria-labelledby={`tab-${value}`}>
      {children}
    </div>
  );
};

export { TabPanel };

interface TabProps {
  value: string;
  disabled?: boolean;
}

const Tab = forwardRef<HTMLButtonElement, TabProps>(({ value, disabled = false }, ref) => {
  const tabRef = useRef<HTMLButtonElement>(null);
  useImperativeHandle(ref, () => tabRef.current);

  return (
    <button
      ref={tabRef}
      role="tab"
      tabIndex={disabled ? -1 : 0}
      aria-selected={value === 'one'}
      aria-controls={`tabpanel-${value}`}
      id={`tab-${value}`}
      disabled={disabled}
    >
      {value}
    </button>
  );
});

export { Tab };

interface TabListProps {
  children: React.ReactNode;
  'aria-label': string;
}

const TabList = forwardRef<HTMLDivElement, TabListProps>(({ children, 'aria-label': ariaLabel }, ref) => {
  return (
    <div role="tablist" aria-label={ariaLabel} ref={ref}>
      {children}
    </div>
  );
});

export { TabList };

interface TabsProps {
  defaultValue: string;
  children: React.ReactNode;
}

const Tabs: React.FC<TabsProps> = ({ defaultValue, children }) => {
  const [activeTab, setActiveTab] = useState(defaultValue);
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const tabs = Object.values(tabRefs.current).filter(tab => tab && !tab.disabled);
      const currentIndex = tabs.findIndex(tab => tab && tab.value === activeTab);
      let newIndex = currentIndex;

      switch (event.key) {
        case 'ArrowRight':
          newIndex = (currentIndex + 1) % tabs.length;
          break;
        case 'ArrowLeft':
          newIndex = (currentIndex - 1 + tabs.length) % tabs.length;
          break;
        case 'Home':
          newIndex = 0;
          break;
        case 'End':
          newIndex = tabs.length - 1;
          break;
        default:
          return;
      }

      const newTab = tabs[newIndex];
      if (newTab) {
        setActiveTab(newTab.value);
        newTab.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, tabs]);

  const renderChildren = React.Children.map(children, child => {
    if (React.isValidElement(child) && child.type === TabList) {
      return React.cloneElement(child, { ref: tabRefs });
    }
    if (React.isValidElement(child) && child.type === Tab) {
      return React.cloneElement(child, { ref: (el: HTMLButtonElement | null) => (tabRefs.current[child.props.value] = el) });
    }
    if (React.isValidElement(child) && child.type === TabPanel) {
      return child.props.value === activeTab ? child : null;
    }
    return child;
  });

  return <div>{renderChildren}</div>;
};

export { Tabs };

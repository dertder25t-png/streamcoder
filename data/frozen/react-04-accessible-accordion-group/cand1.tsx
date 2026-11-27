import React, { useState, useEffect, useRef } from 'react';

interface AccordionItem {
  id: string;
  title: string;
  content: React.ReactNode;
}

interface AccordionGroupProps {
  items: AccordionItem[];
  allowMultiple?: boolean;
}

const AccordionGroup: React.FC<AccordionGroupProps> = ({ items, allowMultiple = false }) => {
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const toggleItem = (id: string) => {
    if (allowMultiple) {
      setExpandedIds(prevIds => (prevIds.includes(id) ? prevIds.filter(i => i !== id) : [...prevIds, id]));
    } else {
      setExpandedIds(prevIds => (prevIds.includes(id) ? [] : [id]));
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        const target = event.target as HTMLElement;
        if (target.tagName === 'BUTTON') {
          const id = target.getAttribute('aria-controls') || '';
          toggleItem(id);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [toggleItem]);

  return (
    <div>
      {items.map(item => (
        <div key={item.id} className="accordion-item">
          <button
            className="accordion-header"
            onClick={() => toggleItem(item.id)}
            aria-expanded={expandedIds.includes(item.id)}
            aria-controls={item.id}
          >
            {item.title}
          </button>
          <div
            id={item.id}
            className="accordion-content"
            hidden={!expandedIds.includes(item.id)}
            role="region"
            aria-labelledby={item.id}
          >
            {item.content}
          </div>
        </div>
      ))}
    </div>
  );
};

export { AccordionGroup };

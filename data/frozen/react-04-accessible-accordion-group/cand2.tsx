import React, { useState } from 'react';

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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleToggle = (id: string) => {
    if (allowMultiple) {
      if (expandedIds.has(id)) {
        setExpandedIds(new Set([...expandedIds].filter((item) => item !== id)));
      } else {
        setExpandedIds(new Set([...expandedIds, id]));
      }
    } else {
      setExpandedIds(new Set([id]));
    }
  };

  return (
    <div>
      {items.map((item) => (
        <div key={item.id} className="accordion-item">
          <button
            className="accordion-header"
            aria-expanded={expandedIds.has(item.id) ? 'true' : 'false'}
            aria-controls={item.id}
            onClick={() => handleToggle(item.id)}
          >
            {item.title}
          </button>
          <div
            id={item.id}
            className="accordion-content"
            style={{ display: expandedIds.has(item.id) ? 'block' : 'none' }}
          >
            {item.content}
          </div>
        </div>
      ))}
    </div>
  );
};

export { AccordionGroup };

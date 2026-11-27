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
  const [expandedIds, setExpandedIds] = useState<string[]>([]);

  const toggleItem = (id: string) => {
    if (allowMultiple) {
      setExpandedIds(prev => {
        if (prev.includes(id)) {
          return prev.filter(item => item !== id);
        } else {
          return [...prev, id];
        }
      });
    } else {
      setExpandedIds(prev => (prev.includes(id) ? [] : [id]));
    }
  };

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
            style={{ display: expandedIds.includes(item.id) ? 'block' : 'none' }}
          >
            {item.content}
          </div>
        </div>
      ))}
    </div>
  );
};

export { AccordionGroup };

import React, { useState, useEffect, useRef } from 'react';

interface Item {
  id: string;
  label: string;
}

interface DeferredActionListProps {
  items: Item[];
  onCommitDelete: (id: string) => void;
  graceMs?: number;
}

const DeferredActionList: React.FC<DeferredActionListProps> = ({ items, onCommitDelete, graceMs = 3000 }) => {
  const [pendingItems, setPendingItems] = useState<{ [id: string]: number | null }>({});
  const timeoutRefs = useRef<{ [id: string]: NodeJS.Timeout | null }>({});

  useEffect(() => {
    return () => {
      for (const id in timeoutRefs.current) {
        if (timeoutRefs.current[id]) {
          clearTimeout(timeoutRefs.current[id]);
        }
      }
    };
  }, []);

  const startDeletionTimer = (id: string) => {
    timeoutRefs.current[id] = setTimeout(() => {
      onCommitDelete(id);
      delete pendingItems[id];
      setPendingItems({ ...pendingItems });
    }, graceMs);
  };

  const handleDelete = (id: string) => {
    if (pendingItems[id]) {
      clearTimeout(timeoutRefs.current[id]);
      delete pendingItems[id];
      setPendingItems({ ...pendingItems });
    } else {
      startDeletionTimer(id);
      setPendingItems({ ...pendingItems, [id]: null });
    }
  };

  const handleUndo = (id: string) => {
    if (pendingItems[id]) {
      startDeletionTimer(id);
      setPendingItems({ ...pendingItems, [id]: null });
    }
  };

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>
          {pendingItems[item.id] ? (
            <span>
              Deleting...{' '}
              <button onClick={() => handleUndo(item.id)} aria-label={`Undo Delete ${item.label}`}>
                Undo
              </button>
            </span>
          ) : (
            <button onClick={() => handleDelete(item.id)} aria-label={`Delete ${item.label}`}>
              Delete
            </button>
          )}
        </div>
      ))}
    </div>
  );
};

export { DeferredActionList };

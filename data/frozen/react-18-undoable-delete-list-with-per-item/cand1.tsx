import React, { useEffect, useRef, useState } from 'react';

interface DeferredActionListProps {
  items: { id: string; label: string }[];
  onCommitDelete: (id: string) => void;
  graceMs?: number;
}

const DeferredActionList: React.FC<DeferredActionListProps> = ({ items, onCommitDelete, graceMs = 3000 }) => {
  const [pendingDeletions, setPendingDeletions] = useState<{ id: string; timer: NodeJS.Timeout }[]>([]);
  const onCommitDeleteRef = useRef(onCommitDelete);

  useEffect(() => {
    onCommitDeleteRef.current = onCommitDelete;
  }, [onCommitDelete]);

  useEffect(() => {
    return () => {
      pendingDeletions.forEach(({ timer }) => clearTimeout(timer));
    };
  }, [pendingDeletions]);

  const handleDelete = (id: string) => {
    const timer = setTimeout(() => {
      onCommitDeleteRef.current(id);
      setPendingDeletions(prev => prev.filter(item => item.id !== id));
    }, graceMs);

    setPendingDeletions(prev => [...prev, { id, timer }]);
  };

  const handleUndo = (id: string) => {
    const index = pendingDeletions.findIndex(item => item.id === id);
    if (index !== -1) {
      clearTimeout(pendingDeletions[index].timer);
      setPendingDeletions(prev => prev.filter((_, i) => i !== index));
    }
  };

  return (
    <ul>
      {items.map(item => (
        <li key={item.id}>
          {pendingDeletions.some(pending => pending.id === item.id) ? (
            <button onClick={() => handleUndo(item.id)} disabled>
              Undo Deleting...
            </button>
          ) : (
            <button onClick={() => handleDelete(item.id)} aria-label={`Delete ${item.label}`}>
              Delete
            </button>
          )}
        </li>
      ))}
    </ul>
  );
};

export { DeferredActionList };

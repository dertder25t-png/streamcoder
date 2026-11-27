import React, { useState, useEffect, useRef } from 'react';

interface Toast {
  id: string;
  message: string;
  durationMs?: number;
}

interface ToastListProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  defaultDurationMs?: number;
}

const ToastList: React.FC<ToastListProps> = ({ toasts, onDismiss, defaultDurationMs = 4000 }) => {
  const [toastStates, setToastStates] = useState<{ [id: string]: { timer: NodeJS.Timeout | null; remaining: number } }>({});

  useEffect(() => {
    toasts.forEach(toast => {
      if (!toastStates[toast.id]) {
        setToastStates(prev => ({
          ...prev,
          [toast.id]: { timer: null, remaining: toast.durationMs ?? defaultDurationMs }
        }));
      }
    });

    return () => {
      Object.keys(toastStates).forEach(id => {
        if (toastStates[id].timer) {
          clearTimeout(toastStates[id].timer);
        }
      });
    };
  }, [toasts, defaultDurationMs, toastStates]);

  useEffect(() => {
    toasts.forEach(toast => {
      if (toastStates[toast.id] && toastStates[toast.id].remaining > 0) {
        const timer = setTimeout(() => {
          onDismiss(toast.id);
          setToastStates(prev => {
            const newState = { ...prev };
            delete newState[toast.id];
            return newState;
          });
        }, toastStates[toast.id].remaining);
        setToastStates(prev => ({
          ...prev,
          [toast.id]: { ...prev[toast.id], timer }
        }));
      }
    });
  }, [toasts, onDismiss, toastStates]);

  const handleMouseEnter = (id: string) => {
    if (toastStates[id] && toastStates[id].timer) {
      clearTimeout(toastStates[id].timer);
      setToastStates(prev => ({
        ...prev,
        [id]: { ...prev[id], timer: null }
      }));
    }
  };

  const handleMouseLeave = (id: string) => {
    if (toastStates[id] && toastStates[id].remaining > 0) {
      const timer = setTimeout(() => {
        onDismiss(id);
        setToastStates(prev => {
          const newState = { ...prev };
          delete newState[id];
          return newState;
        });
      }, toastStates[id].remaining);
      setToastStates(prev => ({
        ...prev,
        [id]: { ...prev[id], timer }
      }));
    }
  };

  const handleDismissClick = (id: string) => {
    onDismiss(id);
    setToastStates(prev => {
      const newState = { ...prev };
      delete newState[id];
      return newState;
    });
  };

  return (
    <div>
      {toasts.map(toast => (
        <div
          key={toast.id}
          onMouseEnter={() => handleMouseEnter(toast.id)}
          onMouseLeave={() => handleMouseLeave(toast.id)}
          style={{
            position: 'relative',
            padding: '10px',
            border: '1px solid #ccc',
            marginBottom: '10px',
            cursor: 'pointer'
          }}
        >
          <p>{toast.message}</p>
          <button
            onClick={() => handleDismissClick(toast.id)}
            style={{
              position: 'absolute',
              top: '50%',
              right: '10px',
              transform: 'translateY(-50%)',
              cursor: 'pointer'
            }}
          >
            X
          </button>
        </div>
      ))}
    </div>
  );
};

export { ToastList };

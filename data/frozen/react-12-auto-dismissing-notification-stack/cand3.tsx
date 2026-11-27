import React, { useState, useEffect, useRef } from 'react';

export interface Toast {
  id: string;
  message: string;
  durationMs?: number;
}

export interface ToastListProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
  defaultDurationMs?: number;
}

const ToastList: React.FC<ToastListProps> = ({ toasts, onDismiss, defaultDurationMs = 4000 }) => {
  const [toastStates, setToastStates] = useState<{ [id: string]: { timer: NodeJS.Timeout | null; remainingTime: number } }>({});

  useEffect(() => {
    toasts.forEach(toast => {
      if (!toastStates[toast.id] && toast.durationMs !== 0) {
        setToastStates(prev => ({
          ...prev,
          [toast.id]: {
            timer: null,
            remainingTime: toast.durationMs ?? defaultDurationMs
          }
        }));
        startTimer(toast.id);
      }
    });

    return () => {
      toasts.forEach(toast => {
        if (toastStates[toast.id]) {
          stopTimer(toast.id);
        }
      });
    };
  }, [toasts, onDismiss, defaultDurationMs, toastStates]);

  const startTimer = (id: string) => {
    if (toastStates[id]) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, toastStates[id].remainingTime);
      setToastStates(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          timer
        }
      }));
    }
  };

  const stopTimer = (id: string) => {
    if (toastStates[id]) {
      if (toastStates[id].timer) {
        clearTimeout(toastStates[id].timer);
      }
      setToastStates(prev => ({
        ...prev,
        [id]: {
          ...prev[id],
          timer: null
        }
      }));
    }
  };

  const handleMouseEnter = (id: string) => {
    if (toastStates[id]) {
      stopTimer(id);
    }
  };

  const handleMouseLeave = (id: string) => {
    if (toastStates[id]) {
      startTimer(id);
    }
  };

  const handleDismissClick = (id: string) => {
    onDismiss(id);
    stopTimer(id);
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
            marginBottom: '10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>{toast.message}</span>
          <button onClick={() => handleDismissClick(toast.id)}>X</button>
        </div>
      ))}
    </div>
  );
};

export default ToastList;

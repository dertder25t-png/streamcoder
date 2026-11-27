import React, { useRef, useEffect, forwardRef, Ref } from 'react';
import { useFocusTrap } from 'react-focus-lock';

interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const AccessibleModal = forwardRef<HTMLDivElement, AccessibleModalProps>(
  ({ isOpen, onClose, title, children }, ref) => {
    const modalRef = useRef<HTMLDivElement | null>(null);
    const triggerRef = useRef<HTMLButtonElement | null>(null);
    const { focusTrapRef } = useFocusTrap(modalRef, {
      initialFocus: true,
      returnFocus: true,
    });

    useEffect(() => {
      if (isOpen) {
        modalRef.current?.addEventListener('keydown', handleKeyDown);
        triggerRef.current?.blur();
        modalRef.current?.focus();
      } else {
        modalRef.current?.removeEventListener('keydown', handleKeyDown);
      }

      return () => {
        modalRef.current?.removeEventListener('keydown', handleKeyDown);
      };
    }, [isOpen]);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    return (
      <div
        ref={mergeRefs(modalRef, ref)}
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen ? 'true' : undefined}
        aria-labelledby={isOpen ? 'modal-title' : undefined}
        style={{
          display: isOpen ? 'block' : 'none',
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <div
          ref={mergeRefs(focusTrapRef, triggerRef)}
          style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '8px',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h2 id="modal-title">{title}</h2>
          <div>{children}</div>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }
);

const mergeRefs = <T extends unknown>(...refs: (T | null | undefined)[]) => (node: T | null) => {
  refs.forEach(ref => {
    if (ref) {
      (ref as React.RefObject<T>).current = node;
    }
  });
};

export { AccessibleModal };

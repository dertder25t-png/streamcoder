import React, { useRef, useEffect, useState } from 'react';

type AccessibleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
};

const AccessibleModal: React.FC<AccessibleModalProps> = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const [focusableElements, setFocusableElements] = useState<HTMLElement[]>([]);
  const [initialFocusRef, setInitialFocusRef] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (modalRef.current) {
      const focusable = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;
      setFocusableElements(Array.from(focusable));
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      const firstFocusable = focusableElements[0];
      if (firstFocusable) {
        setInitialFocusRef(document.activeElement as HTMLElement);
        firstFocusable.focus();
      }
    } else if (initialFocusRef && document.body.contains(initialFocusRef)) {
      initialFocusRef.focus();
    }
  }, [isOpen, focusableElements, initialFocusRef]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        event.preventDefault();
        const isShift = event.shiftKey;
        const nextIndex = isShift ? focusableElements.length - 1 : 0;
        focusableElements[nextIndex].focus();
      } else if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, focusableElements, onClose]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as HTMLElement)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('click', handleOutsideClick);
      return () => {
        document.removeEventListener('click', handleOutsideClick);
      };
    }
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title}
      tabIndex={-1}
      onClick={(event) => event.stopPropagation()}
    >
      <h2 id={title}>{title}</h2>
      <div>{children}</div>
    </div>
  );
};

export { AccessibleModal };

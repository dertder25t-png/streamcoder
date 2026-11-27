import React, { useEffect, useRef, useState } from 'react';

interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const AccessibleModal: React.FC<AccessibleModalProps> = ({ isOpen, onClose, title, children }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const [wasFocusedBeforeOpen, setWasFocusedBeforeOpen] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setWasFocusedBeforeOpen(document.activeElement as HTMLElement);
      modalRef.current?.focus();
    } else {
      wasFocusedBeforeOpen?.focus();
    }
  }, [isOpen, wasFocusedBeforeOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    const handleFocusOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as HTMLElement)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleFocusOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleFocusOutside);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const focusFirstElement = () => {
      const focusableElements = modalRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') as NodeListOf<HTMLElement>;
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }
    };

    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab') {
        const focusableElements = modalRef.current?.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') as NodeListOf<HTMLElement>;
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    };

    focusFirstElement();
    modalRef.current?.addEventListener('keydown', handleTabKey);

    return () => {
      modalRef.current?.removeEventListener('keydown', handleTabKey);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      ref={modalRef}
      tabIndex={-1}
    >
      <h2 id="modal-title">{title}</h2>
      <div>
        {children}
      </div>
    </div>
  );
};

export { AccessibleModal };

"use client";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-base-200/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-base-100 rounded-lg shadow-xl w-full max-w-md">
        {children}
      </div>
    </div>
  );
}

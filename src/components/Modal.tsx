"use client";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function Modal({ isOpen, onClose, children }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center md:p-4">
      <div
        className="fixed inset-0 bg-black/50 md:bg-base-200/80 md:backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-base-100 md:bg-base-100 rounded-t-2xl md:rounded-xl shadow-xl w-full max-w-md animate-in slide-in-from-bottom md:slide-in-from-bottom-0 duration-300">
        {children}
      </div>
    </div>
  );
}

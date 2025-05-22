"use client";

export function UniswapModal({
  isOpen,
  onClose,
  tokenAddress,
  onAfterClose,
}: {
  isOpen: boolean;
  onClose: () => void;
  tokenAddress: string;
  symbol: string;
  onAfterClose?: () => void;
}) {
  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    onAfterClose?.();
  };

  const uniswapUrl = `https://app.uniswap.org/swap?outputCurrency=${tokenAddress}&chain=base`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-base-100 w-full max-w-2xl mx-4 shadow-xl border border-black/[.1] dark:border-white/[.1] h-[80vh]">
        <iframe
          src={uniswapUrl}
          className="w-full h-full"
          allow="clipboard-write"
        />

        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <a
            href={uniswapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            title="Open in new tab"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="w-4 h-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25"
              />
            </svg>
          </a>
          <button onClick={handleClose} className="btn btn-ghost btn-sm">
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

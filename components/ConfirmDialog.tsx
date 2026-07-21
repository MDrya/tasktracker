"use client";

/** Lightweight in-app confirm dialog (replaces window.confirm). */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-neutral-500">{message}</p>
        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="min-h-11 flex-1 rounded-xl bg-neutral-100 px-4 text-sm font-medium text-neutral-700 active:bg-neutral-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="min-h-11 flex-1 rounded-xl bg-red-600 px-4 text-sm font-medium text-white active:bg-red-700"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

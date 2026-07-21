"use client";

import { useState } from "react";

/**
 * "Who am I" modal: asks for a display name on first visit (no password —
 * v1 identity is just a localStorage name). Also reused for changing the
 * name later, in which case it can be dismissed.
 */
export default function NamePicker({
  currentName,
  onSave,
  onCancel,
}: {
  currentName: string | null;
  onSave: (name: string) => void;
  /** Present only when changing an existing name (makes the modal dismissable). */
  onCancel?: () => void;
}) {
  const [value, setValue] = useState(currentName ?? "");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSave(value);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-white p-5"
      >
        <h2 className="text-base font-semibold">
          {currentName ? "Change your name" : "Welcome! Who are you?"}
        </h2>
        <p className="mt-1 text-sm text-neutral-500">
          Your name is shown on tasks you create. No password needed.
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Priya"
          maxLength={40}
          className="mt-3 w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-base outline-none focus:border-indigo-400"
        />
        <div className="mt-4 flex gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-11 flex-1 rounded-xl bg-neutral-100 px-4 text-sm font-medium text-neutral-700 active:bg-neutral-200"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!value.trim()}
            className="min-h-11 flex-1 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white active:bg-indigo-700 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

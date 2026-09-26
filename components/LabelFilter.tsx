"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Label } from "@/lib/types";
import ConfirmDialog from "./ConfirmDialog";

/**
 * One "Filter" button instead of a tab per label, so the bar stays a single
 * line however many labels exist. Tapping it opens a list grouped into
 * production stages and products. With a label selected, rename and
 * delete actions appear underneath.
 */
export default function LabelFilter({
  stages,
  products,
  activeLabelId,
  onSelect,
  onRename,
  onDelete,
}: {
  stages: Label[];
  products: Label[];
  activeLabelId: string | null;
  onSelect: (labelId: string | null) => void;
  onRename: (labelId: string, newName: string) => void;
  onDelete: (labelId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const active =
    [...stages, ...products].find((l) => l.id === activeLabelId) ?? null;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const select = (id: string | null) => {
    setRenaming(false);
    setConfirmingDelete(false);
    setOpen(false);
    onSelect(id);
  };

  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    const name = renameValue.trim();
    if (active && name && name !== active.name) onRename(active.id, name);
    setRenaming(false);
  };

  const option = (label: Label | null) => {
    const selected = (label?.id ?? null) === activeLabelId;
    return (
      <li key={label?.id ?? "all"}>
        <button
          onClick={() => select(label?.id ?? null)}
          className={`flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-sm font-medium ${
            selected ? "bg-indigo-50 text-indigo-700" : "text-neutral-700 active:bg-neutral-100"
          }`}
        >
          <span className="truncate">{label?.name ?? "All orders"}</span>
          {selected && <span aria-hidden>✓</span>}
        </button>
      </li>
    );
  };

  return (
    <div>
      <div className="flex gap-2 py-1">
        <button
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={`flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 rounded-full px-4 text-sm font-medium ${
            active ? "bg-indigo-600 text-white" : "bg-white text-neutral-700 active:bg-neutral-100"
          }`}
        >
          <span className="truncate">
            {active ? `Filter: ${active.name}` : "Filter: All orders"}
          </span>
          <span aria-hidden>▾</span>
        </button>
        {active && (
          <button
            onClick={() => select(null)}
            aria-label="Clear filter"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white text-neutral-500 active:bg-neutral-100"
          >
            ✕
          </button>
        )}
      </div>

      {active && (
        <div className="mt-1 flex items-center gap-2">
          {renaming ? (
            <form onSubmit={submitRename} className="flex flex-1 gap-2">
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-base outline-none focus:border-indigo-400"
                aria-label="New label name"
              />
              <button
                type="submit"
                className="min-h-11 rounded-xl bg-indigo-600 px-4 text-sm font-medium text-white active:bg-indigo-700"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setRenaming(false)}
                className="min-h-11 rounded-xl bg-neutral-100 px-4 text-sm font-medium text-neutral-700"
              >
                Cancel
              </button>
            </form>
          ) : (
            <>
              <button
                onClick={() => {
                  setRenameValue(active.name);
                  setRenaming(true);
                }}
                className="min-h-11 rounded-xl px-3 text-sm font-medium text-indigo-600 active:bg-indigo-50"
              >
                Rename “{active.name}”
              </button>
              <button
                onClick={() => setConfirmingDelete(true)}
                className="min-h-11 rounded-xl px-3 text-sm font-medium text-red-600 active:bg-red-50"
              >
                Delete label
              </button>
            </>
          )}
        </div>
      )}

      {/* Portalled for the same reason as ConfirmDialog: this component
          sits inside the blurred sticky bar. */}
      {open &&
        createPortal(
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 sm:items-center sm:p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Filter orders"
        >
          <div
            className="flex max-h-[75vh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <h2 className="text-base font-semibold">Show orders for</h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-neutral-400 active:bg-neutral-100"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-2 pb-4">
              <ul>{option(null)}</ul>
              {stages.length > 0 && (
                <>
                  <h3 className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Stages
                  </h3>
                  <ul>{stages.map(option)}</ul>
                </>
              )}
              {products.length > 0 && (
                <>
                  <h3 className="px-3 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Products
                  </h3>
                  <ul>{products.map(option)}</ul>
                </>
              )}
            </div>
          </div>
        </div>,
          document.body
        )}

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete label “${active?.name ?? ""}”?`}
        message="The label is removed from every task and subtask. Tasks themselves are not deleted."
        onConfirm={() => {
          setConfirmingDelete(false);
          if (active) {
            onDelete(active.id);
            select(null);
          }
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

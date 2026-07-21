"use client";

import { useState } from "react";
import type { Label } from "@/lib/types";
import ConfirmDialog from "./ConfirmDialog";

/**
 * Horizontal scrollable "workspace" tab bar: All + one tab per label in
 * use. When a label tab is selected, a slim manage bar appears below it
 * with rename (inline input) and delete actions.
 */
export default function LabelTabs({
  labels,
  activeLabelId,
  onSelect,
  onRename,
  onDelete,
}: {
  labels: Label[];
  activeLabelId: string | null;
  onSelect: (labelId: string | null) => void;
  onRename: (labelId: string, newName: string) => void;
  onDelete: (labelId: string) => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const active = labels.find((l) => l.id === activeLabelId) ?? null;

  const select = (id: string | null) => {
    setRenaming(false);
    setConfirmingDelete(false);
    onSelect(id);
  };

  const submitRename = (e: React.FormEvent) => {
    e.preventDefault();
    const name = renameValue.trim();
    if (active && name && name !== active.name) onRename(active.id, name);
    setRenaming(false);
  };

  const tabClass = (isActive: boolean) =>
    `min-h-11 shrink-0 rounded-full px-4 text-sm font-medium transition-colors ${
      isActive
        ? "bg-indigo-600 text-white"
        : "bg-white text-neutral-600 active:bg-neutral-100"
    }`;

  return (
    <div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto py-1">
        <button className={tabClass(activeLabelId === null)} onClick={() => select(null)}>
          All
        </button>
        {labels.map((l) => (
          <button
            key={l.id}
            className={tabClass(l.id === activeLabelId)}
            onClick={() => select(l.id)}
          >
            {l.name}
          </button>
        ))}
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

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete label “${active?.name ?? ""}”?`}
        message="The label is removed from every task and subtask. Tasks themselves are not deleted."
        onConfirm={() => {
          setConfirmingDelete(false);
          if (active) {
            onDelete(active.id);
            onSelect(null);
          }
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

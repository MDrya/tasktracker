"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "tasktracker:displayName";

/**
 * Lightweight identity: a display name kept in localStorage.
 * `loaded` distinguishes "still reading storage" from "no name yet"
 * so the name-picker modal doesn't flash on returning visitors.
 */
export function useDisplayName() {
  const [name, setNameState] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setNameState(localStorage.getItem(STORAGE_KEY));
    setLoaded(true);
  }, []);

  const setName = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    localStorage.setItem(STORAGE_KEY, trimmed);
    setNameState(trimmed);
  };

  return { name, loaded, setName };
}

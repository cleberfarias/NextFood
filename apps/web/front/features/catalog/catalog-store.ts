import { useSyncExternalStore } from "react";
import { validateCatalog, type Catalog } from "@/back/domain/catalog/catalog";
import { CATALOG } from "./catalog-mocks";

export const CATALOG_STORAGE_KEY = "nextfood:catalog:v1";

const listeners = new Set<() => void>();
let snapshot: Catalog | null = null;

/** The saved catalog, or the sample one when nothing valid is saved. Never overwrites what is stored. */
export function loadCatalog(): Catalog {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(CATALOG_STORAGE_KEY);
  } catch {
    return CATALOG;
  }
  if (raw === null) return CATALOG;
  try {
    const parsed = JSON.parse(raw) as Catalog;
    return validateCatalog(parsed).length === 0 ? parsed : CATALOG;
  } catch {
    // Corrupt JSON or a shape validateCatalog cannot walk.
    return CATALOG;
  }
}

function getSnapshot(): Catalog {
  snapshot ??= loadCatalog();
  return snapshot;
}

// The server never sees localStorage: it and the first client render show the sample catalog.
function getServerSnapshot(): Catalog {
  return CATALOG;
}

function publish(next: Catalog) {
  snapshot = next;
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if (event.key === CATALOG_STORAGE_KEY || event.key === null) publish(loadCatalog());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener("storage", onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** Only call with a catalog that already passed validation (an ok EditResult). */
export function saveCatalog(next: Catalog) {
  try {
    window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable (private mode, blocked): keep the change in memory only.
  }
  publish(next);
}

export function resetCatalog() {
  try {
    window.localStorage.removeItem(CATALOG_STORAGE_KEY);
  } catch {
    // Storage unavailable: there is nothing saved to remove.
  }
  publish(CATALOG);
}

export function useCatalog(): Catalog {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const keys = new WeakMap<Catalog, number>();
let nextKey = 0;

/** Stable number per catalog object; as a React key it remounts a screen when the catalog is replaced. */
export function catalogKey(catalog: Catalog): number {
  let key = keys.get(catalog);
  if (key === undefined) {
    key = nextKey++;
    keys.set(catalog, key);
  }
  return key;
}

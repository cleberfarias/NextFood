import { useSyncExternalStore } from "react";
import { validateCatalog, type Catalog } from "@/back/domain/catalog/catalog";
import { CATALOG } from "./catalog-mocks";

export const CATALOG_STORAGE_KEY = "nextfood:catalog:v1";

const listeners = new Set<() => void>();
let snapshot: Catalog | null = null;
// The stored string the snapshot was built from, so a returning screen can tell whether it is stale.
let snapshotRaw: string | null = null;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(CATALOG_STORAGE_KEY);
  } catch {
    return null;
  }
}

function parseRaw(raw: string | null): Catalog {
  if (raw === null) return CATALOG;
  try {
    const parsed = JSON.parse(raw) as Catalog;
    return validateCatalog(parsed).length === 0 ? parsed : CATALOG;
  } catch {
    // Corrupt JSON or a shape validateCatalog cannot walk.
    return CATALOG;
  }
}

/** The saved catalog, or the sample one when nothing valid is saved. Never overwrites what is stored. */
export function loadCatalog(): Catalog {
  return parseRaw(readRaw());
}

/** Rebuilds the snapshot when storage changed since it was built; true when it did. */
function refresh(): boolean {
  const raw = readRaw();
  if (snapshot !== null && raw === snapshotRaw) return false;
  snapshotRaw = raw;
  snapshot = parseRaw(raw);
  return true;
}

function getSnapshot(): Catalog {
  if (snapshot === null) refresh();
  return snapshot ?? CATALOG;
}

// The server never sees localStorage: it and the first client render show the sample catalog.
function getServerSnapshot(): Catalog {
  return CATALOG;
}

function notify() {
  for (const listener of listeners) listener();
}

function onStorage(event: StorageEvent) {
  if ((event.key === CATALOG_STORAGE_KEY || event.key === null) && refresh()) notify();
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) {
    window.addEventListener("storage", onStorage);
    // Nobody listened for storage events while no screen was mounted (e.g. the till tab was on
    // the home page); catch up with any change another tab saved meanwhile.
    refresh();
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/** Only call with a catalog that already passed validation (an ok EditResult). */
export function saveCatalog(next: Catalog) {
  const raw = JSON.stringify(next);
  try {
    window.localStorage.setItem(CATALOG_STORAGE_KEY, raw);
    snapshotRaw = raw;
  } catch {
    // Storage unavailable (private mode, blocked, full): keep the change in memory only.
    snapshotRaw = readRaw();
  }
  snapshot = next;
  notify();
}

export function resetCatalog() {
  try {
    window.localStorage.removeItem(CATALOG_STORAGE_KEY);
  } catch {
    // Storage unavailable: there is nothing saved to remove.
  }
  snapshotRaw = readRaw();
  snapshot = CATALOG;
  notify();
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

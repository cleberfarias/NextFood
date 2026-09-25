import '@testing-library/jest-dom/vitest';
import { beforeEach } from 'vitest';
import { resetCatalog } from './front/features/catalog/catalog-store';

// Every test starts from the sample catalog with nothing saved in the browser.
beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.clear();
  resetCatalog();
});

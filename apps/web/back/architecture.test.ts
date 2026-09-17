// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const DOMAIN_DIR = join(__dirname, "domain");
const FORBIDDEN_IMPORTS = [/from\s+["']firebase-admin/, /from\s+["']next(\/|["'])/, /from\s+["']react(\/|["'])/];

function listTsFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listTsFiles(path);
    return entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path] : [];
  });
}

describe("back/domain dependency direction", () => {
  it("never imports firebase-admin, next, or react", () => {
    const domainFiles = listTsFiles(DOMAIN_DIR);
    expect(domainFiles.length).toBeGreaterThan(0);

    const violations = domainFiles.flatMap((file) => {
      const content = readFileSync(file, "utf8");
      return FORBIDDEN_IMPORTS.filter((pattern) => pattern.test(content)).map(
        (pattern) => `${file} matches forbidden import pattern ${pattern}`,
      );
    });

    expect(violations).toEqual([]);
  });
});

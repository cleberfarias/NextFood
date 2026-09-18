import { describe, expect, it } from "vitest";
import { computeDodge, MAX_DODGES } from "./compute-dodge";

const containerRect = { x: 0, y: 0, width: 400, height: 400 };
const buttonRect = { x: 150, y: 300, width: 100, height: 40 };
const farCursor = { x: 0, y: 0 };
const closeCursor = { x: 200, y: 320 };

describe("computeDodge", () => {
  it("never dodges when fields are filled in, even if the cursor is right on top of the button", () => {
    const result = computeDodge({
      cursor: closeCursor,
      buttonRect,
      containerRect,
      dodgeCount: 0,
      fieldsEmpty: false,
    });
    expect(result.shouldDodge).toBe(false);
  });

  it("does not dodge when the cursor is far away", () => {
    const result = computeDodge({
      cursor: farCursor,
      buttonRect,
      containerRect,
      dodgeCount: 0,
      fieldsEmpty: true,
    });
    expect(result.shouldDodge).toBe(false);
  });

  it("dodges when the cursor gets close and fields are empty", () => {
    const result = computeDodge({
      cursor: closeCursor,
      buttonRect,
      containerRect,
      dodgeCount: 0,
      fieldsEmpty: true,
    });
    expect(result.shouldDodge).toBe(true);
    expect(result.nextPosition).toBeDefined();
  });

  it("stops dodging after MAX_DODGES", () => {
    const result = computeDodge({
      cursor: closeCursor,
      buttonRect,
      containerRect,
      dodgeCount: MAX_DODGES,
      fieldsEmpty: true,
    });
    expect(result.shouldDodge).toBe(false);
  });

  it("keeps the escape position within the container bounds", () => {
    const cornerButton = { x: 0, y: 0, width: 100, height: 40 };
    const result = computeDodge({
      cursor: { x: 50, y: 20 },
      buttonRect: cornerButton,
      containerRect,
      dodgeCount: 0,
      fieldsEmpty: true,
    });
    expect(result.shouldDodge).toBe(true);
    expect(result.nextPosition!.x).toBeGreaterThanOrEqual(0);
    expect(result.nextPosition!.y).toBeGreaterThanOrEqual(0);
    expect(result.nextPosition!.x).toBeLessThanOrEqual(containerRect.width - cornerButton.width);
    expect(result.nextPosition!.y).toBeLessThanOrEqual(containerRect.height - cornerButton.height);
  });

  it("is deterministic for the same inputs", () => {
    const a = computeDodge({ cursor: closeCursor, buttonRect, containerRect, dodgeCount: 0, fieldsEmpty: true });
    const b = computeDodge({ cursor: closeCursor, buttonRect, containerRect, dodgeCount: 0, fieldsEmpty: true });
    expect(a).toEqual(b);
  });
});

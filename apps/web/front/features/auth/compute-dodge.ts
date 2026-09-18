export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; width: number; height: number };

export const DODGE_DISTANCE_THRESHOLD = 70;
export const MAX_DODGES = 2;
const JUMP_DISTANCE = 140;

/**
 * Pure logic for the "Entrar" button's escape micro-interaction. Deliberately
 * has no knowledge of DOM events -- it only reacts to a cursor *position*,
 * so it can never be triggered by keyboard navigation (Tab/Enter never
 * produce a cursor position here).
 */
export function computeDodge(params: {
  cursor: Point;
  buttonRect: Rect;
  containerRect: Rect;
  dodgeCount: number;
  fieldsEmpty: boolean;
}): { shouldDodge: boolean; nextPosition?: Point } {
  if (!params.fieldsEmpty) return { shouldDodge: false };
  if (params.dodgeCount >= MAX_DODGES) return { shouldDodge: false };

  const buttonCenter = {
    x: params.buttonRect.x + params.buttonRect.width / 2,
    y: params.buttonRect.y + params.buttonRect.height / 2,
  };
  const distance = Math.hypot(params.cursor.x - buttonCenter.x, params.cursor.y - buttonCenter.y);

  if (distance > DODGE_DISTANCE_THRESHOLD) return { shouldDodge: false };

  return { shouldDodge: true, nextPosition: pickEscapePosition(params.cursor, params.containerRect, params.buttonRect) };
}

/** Deterministic: jumps the button away from the cursor, clamped to the container. */
export function pickEscapePosition(cursor: Point, containerRect: Rect, buttonRect: Rect): Point {
  const buttonCenter = { x: buttonRect.x + buttonRect.width / 2, y: buttonRect.y + buttonRect.height / 2 };

  let dx = buttonCenter.x - cursor.x;
  let dy = buttonCenter.y - cursor.y;
  const length = Math.hypot(dx, dy);
  if (length < 1) {
    dx = 1;
    dy = -1;
  } else {
    dx /= length;
    dy /= length;
  }

  const targetCenterX = buttonCenter.x + dx * JUMP_DISTANCE;
  const targetCenterY = buttonCenter.y + dy * JUMP_DISTANCE;

  const minX = containerRect.x;
  const maxX = containerRect.x + containerRect.width - buttonRect.width;
  const minY = containerRect.y;
  const maxY = containerRect.y + containerRect.height - buttonRect.height;

  return {
    x: Math.min(Math.max(targetCenterX - buttonRect.width / 2, minX), maxX),
    y: Math.min(Math.max(targetCenterY - buttonRect.height / 2, minY), maxY),
  };
}

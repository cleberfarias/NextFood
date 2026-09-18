/**
 * The GLB (public/models/chef.glb) ships 4 AnimationClips. We never rename
 * clips inside the file -- this mapping is the seam between the raw clip
 * names (one of them a generated UUID) and the names the code uses.
 *
 * Inspected clips (2026-09-17): 1 mesh, 1 material, 1 texture, 1 skin/28
 * bones, animations: Running, Walking, 01a0b102-2b5d-7770-b034-48daf886b806
 * (the custom throw-the-login-card clip), restpose.
 */
export const ANIMATIONS = {
  idle: "restpose",
  walk: "Walking",
  run: "Running",
  throwLogin: "01a0b102-2b5d-7770-b034-48daf886b806",
} as const;

export type AnimationKey = keyof typeof ANIMATIONS;

/**
 * Seconds into the throwLogin clip at which the card should "leave" the
 * chef's hand. Calibrate this against the real clip once it's easy to
 * eyeball in a running app -- it is intentionally the one number you should
 * need to touch, instead of a scattered setTimeout.
 */
export const THROW_RELEASE_TIME = 0.6;

export const CHEF_MODEL_PATH = "/models/chef.glb";

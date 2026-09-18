/**
 * The GLB (public/models/chef.glb) ships 4 AnimationClips. We never rename
 * clips inside the file -- this mapping is the seam between the raw clip
 * names (one of them a generated UUID) and the names the code uses.
 *
 * Re-inspected (2026-09-18) after the asset was replaced: the chef now
 * walks toward the camera carrying the login card and stops -- not a throw
 * anymore. Real clip duration for `enter` (read from the GLB's own
 * accessor): ~5.03s. Material now has a real baseColorTexture (the
 * previous asset only had a normal map, which is why the model rendered
 * flat grey).
 */
export const ANIMATIONS = {
  idle: "restpose",
  walk: "Walking",
  run: "Running",
  enter: "01a0b4b5-2094-7105-8e3f-ca3feb45482a",
} as const;

export type AnimationKey = keyof typeof ANIMATIONS;

/**
 * Seconds into the `enter` clip at which the login card should be revealed
 * -- when the chef has arrived and stopped, not partway through a throw.
 * The clip is ~5.03s long; this is close to the end, calibrate by eye once
 * the walk's actual stopping point is easy to see in a running app.
 */
export const CARD_REVEAL_TIME = 4.5;

export const CHEF_MODEL_PATH = "/models/chef.glb";

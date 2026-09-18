/**
 * The GLB (public/models/chef.glb) ships several AnimationClips. We never
 * rename clips inside the file -- this mapping is the seam between the raw
 * clip names and the names the code uses.
 *
 * Re-inspected (2026-09-18) after the asset was replaced again: this export
 * has a properly *named* throw clip -- "Grip_and_Throw_Down" -- instead of
 * the generated-UUID clip earlier exports used. Real duration (read from
 * the GLB's own accessor): ~4.73s. Material has a real baseColorTexture.
 */
export const ANIMATIONS = {
  idle: "restpose",
  walk: "Walking",
  run: "Running",
  throwLogin: "Grip_and_Throw_Down",
} as const;

export type AnimationKey = keyof typeof ANIMATIONS;

/**
 * Seconds into the throwLogin clip at which the card should "leave" the
 * chef's hand. Clip is ~4.73s long; this is a starting guess (roughly
 * two-thirds through, after the wind-up/grip but before full follow-
 * through) -- calibrate by eye once it's easy to see in a running app.
 */
export const THROW_RELEASE_TIME = 3.2;

export const CHEF_MODEL_PATH = "/models/chef.glb";

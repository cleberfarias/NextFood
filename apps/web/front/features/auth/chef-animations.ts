/**
 * The GLB (public/models/chef.glb) ships several AnimationClips. We never
 * rename clips inside the file -- this mapping is the seam between the raw
 * clip names and the names the code uses.
 *
 * Re-inspected (2026-09-21) after the asset was replaced again: this export
 * has no `restpose` clip at all (idle is intentionally left unmapped --
 * ChefCharacter already no-ops gracefully when `actions[ANIMATIONS.idle]` is
 * undefined, freezing on the throw's last frame instead). The throw is back
 * to a generated-UUID clip name (duration read from the GLB's own accessor:
 * ~5.04s), same pattern as the export before "Grip_and_Throw_Down".
 */
export const ANIMATIONS = {
  idle: "restpose",
  walk: "Walking",
  run: "Running",
  throwLogin: "01a0c663-e4a3-7691-a838-413cbccc3135",
} as const;

export type AnimationKey = keyof typeof ANIMATIONS;

/**
 * Seconds into the throwLogin clip at which the card should "leave" the
 * chef's hand. Measured by instrumenting the hand bone's live screen
 * position against the clip's own clock in a running app (not guessed):
 * this clip raises both hands and holds near their highest point from
 * roughly 1.2s to 2.6s, then spends ~1.2s-4.4s bringing them back down.
 * 2.4s releases right near the top of that hold, before the hand starts
 * its real descent -- which is also what ChefCharacter's "hand is back
 * down" detection then measures against (see HAND_DESCENT_THRESHOLD_PX).
 */
export const THROW_RELEASE_TIME = 2.4;

/**
 * How far (screen pixels) the hand bone has to drop from the highest point
 * it reached before "the hand is back down" counts as true (see
 * login-sequence.tsx's "thrown" stage). There's no reliable fixed pose to
 * compare against in advance -- the model's pre-mixer bind pose turned out
 * to be a T-pose, nowhere near any position the clip actually reaches --
 * so ChefCharacter tracks the hand's live peak height itself and measures
 * the descent from that. This clip's observed excursion is roughly
 * 300px (peak to fully settled); 180px triggers noticeably before it's
 * fully settled, while the card is still visibly on its way down.
 */
export const HAND_DESCENT_THRESHOLD_PX = 180;

/**
 * How far above its resting position (screen pixels) the card is allowed to
 * follow the hand while "entering". This clip raises both hands well above
 * head height during the wind-up; letting the card track that literally put
 * it up by the chef's face at a tiny scale, which read as broken rather than
 * gripped. Clamping the rise keeps the card riding at roughly chest height
 * the whole time, even while the hand itself goes higher.
 */
export const MAX_CARD_RISE_PX = 70;

export const CHEF_MODEL_PATH = "/models/chef.glb";

/**
 * Mixamo-rig bone name for the hand that grips/throws the card. The raw GLB
 * node is named "mixamorig:RightHand" (colon included, confirmed by parsing
 * the GLB's own JSON chunk), but GLTFLoader strips ':' when it builds the
 * three.js scene graph -- verified by traversing the actually-loaded scene
 * in a running app, which names it "mixamorigRightHand". Always check the
 * loaded scene, not just the raw GLB JSON, when this next changes. Swap to
 * the Left variant if the throw turns out to use the other arm.
 */
export const THROW_HAND_BONE = "mixamorigRightHand";

/**
 * The chef's other hand. The throw clip raises both arms, and the card
 * should sit gripped between them, not off to one side tracking only the
 * hand that actually releases it -- so ChefCharacter averages this bone's
 * screen position with THROW_HAND_BONE's for where the card sits while
 * "entering". Same Mixamo naming pattern as THROW_HAND_BONE (raw GLB node
 * "mixamorig:LeftHand", ':' stripped by GLTFLoader); falls back to
 * THROW_HAND_BONE alone if this bone isn't found on the loaded scene.
 */
export const OFF_HAND_BONE = "mixamorigLeftHand";

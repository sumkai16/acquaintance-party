import Image from "next/image";
import type { Act } from "@/lib/config/battle";
import { actInitials } from "@/lib/votes/acts";

/**
 * Shown at 96px so a face is easy to tell apart on a phone. The photo is
 * requested at twice that (192) so next/image's own 1x/2x copies come out at
 * 192 and 384px: sharp on a 3x screen, still a few KB each.
 */
const INTRINSIC = 192;

/**
 * An act's photo, or a gradient badge with its initials until the photo is
 * added (`photo` in src/lib/config/battle.ts). The solo photos in
 * public/acts/ are already cropped square around the face — keep new ones the
 * same, since object-cover only trims, it can't find a face.
 *
 * Goes through next/image on purpose: hundreds of phones open this page in
 * the same minute, and it serves a small copy cached at the edge instead of
 * the original.
 */
export function ActAvatar({ act }: { act: Act }) {
  if (act.photo) {
    return (
      <Image
        src={act.photo}
        alt=""
        width={INTRINSIC}
        height={INTRINSIC}
        className="h-24 w-24 shrink-0 rounded-full object-cover ring-2 ring-ground/30"
      />
    );
  }

  return (
    <span
      aria-hidden
      className="grid h-24 w-24 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-4 font-display text-4xl text-white"
    >
      {actInitials(act.name)}
    </span>
  );
}

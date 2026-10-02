import Image from "next/image";
import type { Act } from "@/lib/config/battle";
import { actInitials } from "@/lib/votes/acts";

const SIZE = 64;

/**
 * An act's photo, or a gradient badge with its initials until the photo is
 * added (`photo` in src/lib/config/battle.ts).
 *
 * Goes through next/image on purpose: the photos are whatever size the acts
 * sent, and hundreds of phones open this page in the same minute. It serves a
 * 64px (and 2x) copy, cached at the edge, instead of the original.
 */
export function ActAvatar({ act }: { act: Act }) {
  if (act.photo) {
    return (
      <Image
        src={act.photo}
        alt=""
        width={SIZE}
        height={SIZE}
        className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-ground/25"
      />
    );
  }

  return (
    <span
      aria-hidden
      className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-4 font-display text-2xl text-white"
    >
      {actInitials(act.name)}
    </span>
  );
}

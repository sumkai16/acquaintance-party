"use server";

import { revalidatePath } from "next/cache";
import {
  deletePrizeById,
  insertPrize,
  movePrize as movePrizeQuery,
  renamePrizeById,
} from "@/lib/raffle/queries";
import type { RafflePrize } from "@/lib/raffle/types";
import { currentAdminId } from "@/lib/supabase/server";

export type PrizeActionResult =
  | { ok: true; prize: RafflePrize }
  | { ok: false; error: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function createPrize(name: string): Promise<PrizeActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the prize a name." };

  const result = await insertPrize(trimmed);
  if (!result.ok) return result;

  revalidatePath("/admin/raffle");
  return result;
}

export async function renamePrize(id: string, name: string): Promise<ActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Give the prize a name." };

  const result = await renamePrizeById(id, trimmed);
  if (result.ok) revalidatePath("/admin/raffle");
  return result;
}

export async function deletePrize(id: string): Promise<ActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const result = await deletePrizeById(id);
  if (result.ok) revalidatePath("/admin/raffle");
  return result;
}

export async function movePrize(
  id: string,
  direction: "up" | "down",
): Promise<ActionResult> {
  const adminId = await currentAdminId();
  if (!adminId) return { ok: false, error: "Sign in again." };

  const result = await movePrizeQuery(id, direction);
  if (result.ok) revalidatePath("/admin/raffle");
  return result;
}

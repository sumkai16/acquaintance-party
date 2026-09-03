"use client";

import { useState } from "react";
import type { RafflePrize } from "@/lib/raffle/types";
import { createPrize, deletePrize, movePrize, renamePrize } from "./prize-actions";

/**
 * Add, rename, reorder, and remove prizes right here — no code edit, no
 * redeploy. Deleting an already-drawn prize only removes it from this list;
 * its recorded result stays in raffle_draws either way.
 */
export function PrizeManager({
  prizes,
  onChange,
  hasDraw,
}: {
  prizes: RafflePrize[];
  onChange: (next: RafflePrize[]) => void;
  hasDraw: (prizeId: string) => boolean;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPending(true);
    setError(null);
    const result = await createPrize(trimmed);
    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setName("");
    onChange([...prizes, result.prize]);
  }

  async function handleRename(id: string) {
    const trimmed = editingValue.trim();
    if (!trimmed) {
      setEditingId(null);
      return;
    }
    const result = await renamePrize(id, trimmed);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChange(prizes.map((p) => (p.id === id ? { ...p, name: trimmed } : p)));
    setEditingId(null);
  }

  async function handleDelete(prize: RafflePrize) {
    if (
      hasDraw(prize.id) &&
      !window.confirm(
        `${prize.name} has already been drawn. Deleting it only removes it from this list — the recorded winner stays on file.`,
      )
    ) {
      return;
    }
    const result = await deletePrize(prize.id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onChange(prizes.filter((p) => p.id !== prize.id));
  }

  async function handleMove(id: string, direction: "up" | "down") {
    const index = prizes.findIndex((p) => p.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= prizes.length) return;

    const result = await movePrize(id, direction);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = [...prizes];
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    onChange(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ground/70">
        Prizes
      </h2>

      <ul className="flex flex-col gap-1.5">
        {prizes.map((prize, i) => (
          <li
            key={prize.id}
            className="flex items-center gap-2 rounded border border-ground/15 bg-deep/40 px-3 py-2"
          >
            {editingId === prize.id ? (
              <input
                autoFocus
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename(prize.id)}
                onBlur={() => handleRename(prize.id)}
                className="flex-1 rounded border border-accent-3 bg-deep px-2 py-1"
              />
            ) : (
              <button
                type="button"
                className="flex-1 text-left focus:outline-2 focus:outline-offset-2 focus:outline-accent-3"
                onClick={() => {
                  setEditingId(prize.id);
                  setEditingValue(prize.name);
                }}
              >
                {prize.name}
              </button>
            )}

            <button
              type="button"
              disabled={i === 0}
              onClick={() => handleMove(prize.id, "up")}
              className="rounded px-2 py-1 text-ground/60 hover:text-ground disabled:opacity-30"
              aria-label={`Move ${prize.name} up`}
            >
              ↑
            </button>
            <button
              type="button"
              disabled={i === prizes.length - 1}
              onClick={() => handleMove(prize.id, "down")}
              className="rounded px-2 py-1 text-ground/60 hover:text-ground disabled:opacity-30"
              aria-label={`Move ${prize.name} down`}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => handleDelete(prize)}
              className="rounded px-2 py-1 text-accent-2 hover:opacity-80"
              aria-label={`Delete ${prize.name}`}
            >
              ✕
            </button>
          </li>
        ))}
        {prizes.length === 0 ? (
          <li className="text-sm text-ground/50">No prizes yet — add one below.</li>
        ) : null}
      </ul>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Prize name"
          className="flex-1 rounded border border-ground/25 bg-deep px-3 py-2 focus:border-accent-3 focus:outline-2 focus:outline-offset-2 focus:outline-accent-3"
        />
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={handleAdd}
          className="rounded bg-accent px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Add
        </button>
      </div>

      {error ? <p className="text-sm text-accent-2">{error}</p> : null}
    </div>
  );
}

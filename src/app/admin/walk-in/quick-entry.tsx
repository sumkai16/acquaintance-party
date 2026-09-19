"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EVENT, formatPeso } from "@/lib/config/event";
import {
  normalizeStudentId,
  STUDENT_ID_INPUT_PATTERN,
  STUDENT_ID_PATTERN,
  STUDENT_ID_PLACEHOLDER,
  suggestEmail,
  walkInSchema,
  YEAR_LEVELS,
  type WalkInInput,
} from "@/lib/registrations/schema";
import { sectionsFor } from "@/lib/registrations/sections";
import {
  sanitizeDraftRows,
  type DraftRow,
  type WalkInDraft,
} from "@/lib/walk-in-drafts/sanitize";
import { useFlash } from "../flash";
import { saveWalkInDraftAction } from "./draft-actions";
import { confirmTypedWalkIns, findTicketedStudentIds } from "./import-actions";

/**
 * Two ways to enter a walk-in: the original one-at-a-time form (passed in as
 * `children`, untouched) and a typed list for copying a paper sign-in sheet.
 * The Excel import is a separate toggle in the page header and still works
 * next to either.
 */
export function WalkInModeSwitch({
  children,
  savedDraft,
}: {
  children: React.ReactNode;
  /** This staff member's list from the server. `null` = none, `undefined` = it couldn't be read. */
  savedDraft: WalkInDraft | null | undefined;
}) {
  const [chosen, setChosen] = useState<"single" | "list" | null>(null);
  const [listSeen, setListSeen] = useState(false);
  // Browser storage and "are we on the client" are read without a hydration
  // mismatch: the server snapshot says "no draft, not client yet", and React
  // swaps in the real values right after hydrating.
  const localRows = useSyncExternalStore(subscribeToDraft, savedRowCount, () => 0);
  const isClient = useSyncExternalStore(subscribeNever, () => true, () => false);
  const serverRows = savedDraft?.rows.length ?? 0;

  // Reopening the page with an unsent list should land on that list, not on
  // the other tab where it looks like the list was lost. Set once, during
  // render, so approving the last row later doesn't bounce anyone back out.
  // Client only: the list reads browser storage, so it must never be
  // server-rendered.
  if (chosen === null && isClient && Math.max(localRows, serverRows) > 0) {
    setChosen("list");
    setListSeen(true);
  }
  const mode = chosen ?? "single";
  // Once the list has been open, this phone's copy is the live count; before
  // that (a fresh phone) the server's list is what's waiting.
  const waiting = listSeen ? localRows : Math.max(localRows, serverRows);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-black/20 p-1" role="tablist">
        <ModeTab active={mode === "single"} onClick={() => setChosen("single")}>
          One at a time
        </ModeTab>
        <ModeTab
          active={mode === "list"}
          onClick={() => {
            setChosen("list");
            setListSeen(true);
          }}
        >
          Type a list{waiting > 0 ? ` · ${waiting} saved` : ""}
        </ModeTab>
      </div>
      {mode === "single" ? children : <QuickEntry savedDraft={savedDraft} />}
    </div>
  );
}

const subscribeNever = () => () => {};

function ModeTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-11 rounded-md px-3 text-sm font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 ${
        active ? "bg-accent-2 text-deep" : "text-ground/70 hover:text-ground"
      }`}
    >
      {children}
    </button>
  );
}

type Row = {
  id: string;
  fullName: string;
  studentId: string;
  yearLevel: string;
  section: string;
  email: string;
  open: boolean;
  /** Set when the server refused this row on approve; cleared on the next edit. */
  serverError?: string;
};

type Field = "fullName" | "studentId" | "yearLevel" | "section" | "email";

const FIELD_LABEL: Record<Field, string> = {
  fullName: "Name",
  studentId: "ID",
  yearLevel: "Year",
  section: "Section",
  email: "Email",
};

// This phone's copy of the list. The server holds the real one so it can be
// picked up on another phone (walk_in_drafts); this copy is what makes typing
// instant and keeps working with no signal at the door.
const DRAFT_KEY = "walk-in-quick-entry-draft-v1";

type LocalDraft = {
  rows: DraftRow[];
  /** True while there are edits the server hasn't confirmed. Decides who wins on reopen. */
  pending: boolean;
};

function blankRow(from?: Pick<Row, "yearLevel" | "section">): Row {
  return {
    id: crypto.randomUUID(),
    fullName: "",
    studentId: "",
    // A sheet is usually grouped by section, so the next person is most
    // likely in the same one.
    yearLevel: from?.yearLevel ?? "",
    section: from?.section ?? "",
    email: "",
    open: true,
  };
}

const DRAFT_EVENT = "walk-in-draft-change";

function readLocalDraft(): LocalDraft | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(DRAFT_KEY) ?? "null");
    // An older build stored a bare array — treat that as unsynced.
    const source = Array.isArray(parsed) ? { rows: parsed, pending: true } : parsed;
    if (typeof source !== "object" || source === null) return null;
    const { rows, pending } = source as { rows?: unknown; pending?: unknown };
    const clean = sanitizeDraftRows(rows);
    return clean.length > 0 ? { rows: clean, pending: pending !== false } : null;
  } catch {
    return null; // Blocked or corrupt storage.
  }
}

function writeLocalDraft(rows: DraftRow[], pending: boolean) {
  try {
    if (rows.length === 0) window.localStorage.removeItem(DRAFT_KEY);
    else window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ rows, pending }));
    window.dispatchEvent(new Event(DRAFT_EVENT));
  } catch {
    // Storage full or blocked — the server copy still holds the list.
  }
}

/** How many typed rows are waiting in this browser. */
function savedRowCount(): number {
  return readLocalDraft()?.rows.length ?? 0;
}

/**
 * The exact text that says "this is what the list contains" — used to tell
 * whether the server already has the current list without comparing rows
 * field by field. Blank rows and the UI-only `open` flag don't count.
 */
function contentOf(rows: ReadonlyArray<Omit<DraftRow, "id"> & { id: string }>): string {
  return JSON.stringify(sanitizeDraftRows(rows));
}

/**
 * Where the list starts. Unsynced edits on this phone win (they were typed
 * after the last save the server confirmed); otherwise the server's copy does,
 * so a second phone picks up where the first left off. A synced local copy
 * whose server copy is gone means the sheet was finished elsewhere — drop it,
 * unless the server couldn't be read, in which case keep it rather than lose it.
 */
function initialList(server: WalkInDraft | null | undefined): {
  rows: Row[];
  /** What the server is known to hold; null forces a save to push local edits. */
  synced: string | null;
} {
  const local = readLocalDraft();

  let source: DraftRow[] = [];
  let synced: string | null = "[]";
  if (local?.pending) {
    source = local.rows;
    synced = null;
  } else if (server) {
    source = server.rows;
    synced = contentOf(server.rows);
  } else if (server === undefined && local) {
    source = local.rows;
    synced = null;
  }

  const restored: Row[] = source.map((item) => ({
    ...item,
    id: item.id || crypto.randomUUID(),
    open: false,
  }));
  // Blank rows aren't kept in the draft, so pick up where they left off: a
  // fresh open card, year and section carried over from the last one.
  return {
    rows: restored.length > 0 ? [...restored, blankRow(restored[restored.length - 1])] : [blankRow()],
    synced,
  };
}

function subscribeToDraft(onChange: () => void): () => void {
  // "storage" covers another tab editing the same list; our own event covers
  // this tab, which the storage event never fires for.
  window.addEventListener("storage", onChange);
  window.addEventListener(DRAFT_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(DRAFT_EVENT, onChange);
  };
}

function isBlank(row: Row): boolean {
  return !row.fullName.trim() && !row.studentId.trim() && !row.email.trim();
}

type FieldErrors = Partial<Record<Field, string>>;

type Status = {
  tone: "ready" | "todo" | "bad";
  label: string;
  /** One message per field that has something typed in it and is wrong. */
  errors: FieldErrors;
  /** Why the server refused the row on approve — about the row, not one field. */
  rowError?: string;
};

/**
 * Checks every field, not just the first that fails — an unfilled year must
 * not hide a mistyped email further down the card. A field nobody has typed
 * in yet isn't an error, just unfinished, so it only sets the pill.
 */
function rowStatus(row: Row, all: Row[], ticketed: ReadonlySet<string>): Status {
  if (isBlank(row)) return { tone: "todo", label: "Empty", errors: {} };

  const errors: FieldErrors = {};
  let missing: Field | null = null;

  const parsed = walkInSchema.safeParse(row);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0]) as Field;
      if (!(row[field] ?? "").trim()) missing ??= field;
      else errors[field] ??= issue.message;
    }
  } else {
    const id = normalizeStudentId(row.studentId);
    const copies = all.filter((other) => normalizeStudentId(other.studentId) === id).length;
    if (copies > 1) errors.studentId = "This ID is in the list twice.";
    else if (ticketed.has(id)) errors.studentId = "This student already has a ticket.";
  }

  if (row.serverError) {
    return { tone: "bad", label: "Not saved", errors, rowError: row.serverError };
  }
  const firstBad = (Object.keys(errors) as Field[])[0];
  if (firstBad) {
    const label =
      errors.studentId === "This student already has a ticket."
        ? "Has ticket"
        : errors.studentId === "This ID is in the list twice."
          ? "Duplicate"
          : FIELD_LABEL[firstBad];
    return { tone: "bad", label, errors };
  }
  if (missing) return { tone: "todo", label: FIELD_LABEL[missing], errors };
  return { tone: "ready", label: "Ready", errors };
}

const inputClass =
  "w-full rounded border border-ground/25 bg-deep px-3 py-2.5 text-ground " +
  "placeholder:text-ground/40 focus:border-accent-2 focus:outline-2 " +
  "focus:outline-offset-2 focus:outline-accent-2 [color-scheme:dark]";

const pillClass = {
  ready: "bg-green-400/10 text-green-400",
  todo: "bg-amber-300/10 text-amber-300",
  bad: "bg-red-300/10 text-red-300",
} as const;

const PRICE = EVENT.ticketPriceCentavos;

/** How long typing has to pause before the list is sent to the server. */
const SAVE_DELAY_MS = 800;

type SyncNote = "idle" | "saving" | "saved" | "local";

function QuickEntry({ savedDraft }: { savedDraft: WalkInDraft | null | undefined }) {
  // Lazy init: this only mounts after the tab is chosen on the client (never
  // server rendered), so reading storage here can't cause a hydration mismatch.
  const [initial] = useState(() => initialList(savedDraft));
  const [rows, setRows] = useState<Row[]>(initial.rows);
  const [ticketed, setTicketed] = useState<ReadonlySet<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [syncNote, setSyncNote] = useState<SyncNote>("idle");
  const [retryTick, setRetryTick] = useState(0);
  const flash = useFlash();

  // What the server is known to hold. Saving only happens when the list
  // differs from this, so opening the tab on a stale phone never overwrites a
  // newer list from another one.
  const syncedRef = useRef<string | null>(initial.synced);
  const content = contentOf(rows);

  useEffect(() => {
    const payload: DraftRow[] = JSON.parse(content);
    const inSync = content === syncedRef.current;
    writeLocalDraft(payload, !inSync);
    if (inSync) return;

    let stale = false;
    const timer = setTimeout(async () => {
      setSyncNote("saving");
      const result = await saveWalkInDraftAction(payload).catch(() => ({ ok: false as const }));
      if (result.ok) syncedRef.current = content;
      // A newer edit already re-ran this effect and owns the status and this
      // phone's copy now.
      if (stale) return;
      if (result.ok) writeLocalDraft(payload, false);
      setSyncNote(result.ok ? "saved" : "local");
    }, SAVE_DELAY_MS);

    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [content, retryTick]);

  // Signal came back: try again now instead of waiting for the next keystroke.
  useEffect(() => {
    const retry = () => setRetryTick((tick) => tick + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  const statuses = rows.map((row) => rowStatus(row, rows, ticketed));
  const readyCount = statuses.filter((status) => status.tone === "ready").length;
  const problemCount = statuses.filter(
    (status, index) => status.tone !== "ready" && !isBlank(rows[index]),
  ).length;

  function update(id: string, patch: Partial<Row>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch, serverError: undefined } : row)),
    );
  }

  function toggle(id: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, open: !row.open } : row)),
    );
  }

  function remove(id: string) {
    setRows((current) => {
      const next = current.filter((row) => row.id !== id);
      return next.length > 0 ? next : [blankRow()];
    });
  }

  /** The one check the browser can't do: does this ID already hold a ticket? */
  async function checkTicketed(studentId: string) {
    const id = normalizeStudentId(studentId);
    if (!STUDENT_ID_PATTERN.test(id)) return;
    try {
      const found = await findTicketedStudentIds([id]);
      if (found.length > 0) setTicketed((current) => new Set([...current, ...found]));
    } catch {
      // Approve re-checks on the server anyway, so a failed lookup is harmless.
    }
  }

  function saveAndNext(row: Row) {
    setRows((current) => {
      const index = current.findIndex((other) => other.id === row.id);
      const collapsed = current.map((other) => ({ ...other, open: false }));
      const following = collapsed[index + 1];
      if (following) return collapsed.map((other) => ({ ...other, open: other.id === following.id }));
      return [...collapsed, blankRow(row)];
    });
    void checkTicketed(row.studentId);
  }

  function addAnother() {
    const last = rows[rows.length - 1];
    setRows((current) => [...current.map((row) => ({ ...row, open: false })), blankRow(last)]);
  }

  async function approve() {
    const ready = rows.filter((_, index) => statuses[index].tone === "ready");
    if (ready.length === 0) return;

    setBusy(true);
    let result;
    try {
      result = await confirmTypedWalkIns(ready.map(toInput));
    } catch {
      setBusy(false);
      flash("Could not reach the server. Your list is still here — try again.", "error");
      return;
    }
    setBusy(false);

    if (result.error) {
      flash(result.error, "error");
      return;
    }

    const failedById = new Map(
      result.failed.map((item) => [normalizeStudentId(item.row.studentId), item.error]),
    );
    const readyIds = new Set(ready.map((row) => row.id));

    setRows((current) => {
      const kept = current
        .filter((row) => !readyIds.has(row.id) || failedById.has(normalizeStudentId(row.studentId)))
        .map((row) => {
          const error = failedById.get(normalizeStudentId(row.studentId));
          return error ? { ...row, open: true, serverError: error } : row;
        });
      return kept.length > 0 ? kept : [blankRow()];
    });
    const nowTicketed = result.failed
      .filter((item) => item.error === "Already has a ticket.")
      .map((item) => normalizeStudentId(item.row.studentId));
    if (nowTicketed.length > 0) setTicketed((current) => new Set([...current, ...nowTicketed]));

    if (result.failed.length === 0) {
      flash(`Recorded ${result.created} walk-in sale${result.created === 1 ? "" : "s"}.`);
    } else {
      flash(
        `Recorded ${result.created}. ${result.failed.length} not saved — check the rows below.`,
        "error",
      );
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2.5">
        {rows.map((row, index) => (
          <RowCard
            key={row.id}
            index={index}
            row={row}
            status={statuses[index]}
            onChange={(patch) => update(row.id, patch)}
            onToggle={() => toggle(row.id)}
            onRemove={() => remove(row.id)}
            onSaveAndNext={() => saveAndNext(row)}
          />
        ))}
      </ul>

      <button
        type="button"
        onClick={addAnother}
        className="min-h-11 rounded-full border border-ground/25 px-5 font-semibold hover:border-ground/50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
      >
        + Add another
      </button>
      <p className="text-center text-sm text-ground/60">
        Year and section carry over from the row above.
      </p>

      <div className="sticky bottom-0 -mx-1 flex items-center gap-3 border-t border-ground/15 bg-deep px-1 pt-3 pb-3">
        <p className="flex-1 text-sm leading-snug text-ground/60">
          <span className="font-semibold text-ground">
            {readyCount} ready · {formatPeso(readyCount * PRICE)}
          </span>
          <br />
          {problemCount > 0 ? `${problemCount} need a look` : "Cash in hand, then approve"}
          <SyncLine note={syncNote} />
        </p>
        <button
          type="button"
          disabled={busy || readyCount === 0}
          onClick={approve}
          className="min-h-12 rounded-full bg-accent px-6 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
        >
          {busy ? "Recording…" : `Approve ${readyCount}`}
        </button>
      </div>
    </div>
  );
}

/** Whether the list is safe on the server — so nobody has to wonder. */
function SyncLine({ note }: { note: SyncNote }) {
  if (note === "idle") return null;
  const text = {
    saving: "Saving your list…",
    saved: "List saved to your account",
    local: "Kept on this phone only — will retry",
  }[note];
  return (
    <span
      role="status"
      className={`block text-xs ${note === "local" ? "text-amber-300" : "text-ground/50"}`}
    >
      {text}
    </span>
  );
}

function toInput(row: Row): WalkInInput {
  return {
    fullName: row.fullName,
    studentId: row.studentId,
    yearLevel: row.yearLevel as WalkInInput["yearLevel"],
    section: row.section,
    email: row.email,
  };
}

function RowCard({
  index,
  row,
  status,
  onChange,
  onToggle,
  onRemove,
  onSaveAndNext,
}: {
  index: number;
  row: Row;
  status: Status;
  onChange: (patch: Partial<Row>) => void;
  onToggle: () => void;
  onRemove: () => void;
  onSaveAndNext: () => void;
}) {
  const [focused, setFocused] = useState<Field | null>(null);
  const sections = sectionsFor(row.yearLevel);
  const emailFix = status.errors.email ? suggestEmail(row.email) : null;
  // An error stays quiet while someone is still typing in that box, so
  // "juan@g" isn't shouted at mid-word. A mistyped provider is the exception:
  // it only fires once the address looks complete, and the fix is one tap.
  const errorFor = (field: Field): string | undefined => {
    const message = status.errors[field];
    if (!message) return undefined;
    if (focused === field && !(field === "email" && emailFix)) return undefined;
    return message;
  };
  const firstError = Object.values(status.errors)[0] ?? status.rowError;
  const summary = [
    row.studentId.trim() || "No ID yet",
    row.yearLevel ? `${row.yearLevel.slice(0, 3)}${row.section ? ` ${row.section}` : ""}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <li
      className={`overflow-hidden rounded-lg border bg-black/20 ${
        status.tone === "bad" && !row.open ? "border-red-300/50" : "border-ground/20"
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={row.open}
        className="flex min-h-14 w-full items-center gap-3 px-3.5 py-3 text-left focus:outline-2 focus:outline-offset-[-2px] focus:outline-accent-2"
      >
        <span className="w-5 shrink-0 font-display text-lg text-accent-2">{index + 1}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{row.fullName.trim() || "New walk-in"}</span>
          <span className="block truncate text-sm text-ground/60">{summary}</span>
          {!row.open && firstError ? (
            <span className="mt-0.5 block text-sm font-medium text-red-300">{firstError}</span>
          ) : null}
        </span>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${pillClass[status.tone]}`}
        >
          {status.label}
        </span>
      </button>

      {row.open ? (
        <div className="flex flex-col gap-3.5 border-t border-ground/15 p-3.5">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Full name</span>
            <input
              autoFocus
              value={row.fullName}
              onChange={(event) => onChange({ fullName: event.target.value })}
              onFocus={() => setFocused("fullName")}
              onBlur={() => setFocused(null)}
              placeholder="Juan Dela Cruz"
              autoComplete="off"
              aria-invalid={errorFor("fullName") ? true : undefined}
              className={`${inputClass} ${invalidClass(errorFor("fullName"))}`}
            />
            <FieldError message={errorFor("fullName")} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Student ID</span>
            <input
              value={row.studentId}
              onChange={(event) => onChange({ studentId: event.target.value })}
              onFocus={() => setFocused("studentId")}
              onBlur={() => setFocused(null)}
              placeholder={STUDENT_ID_PLACEHOLDER}
              // Same treatment as the single form's ID field: caps as typed
              // (the schema uppercases it on save), no autocorrect.
              pattern={STUDENT_ID_INPUT_PATTERN}
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={errorFor("studentId") ? true : undefined}
              className={`${inputClass} uppercase ${invalidClass(errorFor("studentId"))}`}
            />
            <FieldError message={errorFor("studentId")} />
          </label>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold">Year level</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {YEAR_LEVELS.map((level) => (
                <ChoiceButton
                  key={level}
                  selected={row.yearLevel === level}
                  label={level}
                  // Changing the year clears the section: 4th year has no G,
                  // so a carried-over pick could be one that year lacks.
                  onClick={() =>
                    onChange(row.yearLevel === level ? {} : { yearLevel: level, section: "" })
                  }
                >
                  {level.slice(0, 3)}
                </ChoiceButton>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-sm font-semibold">Section</legend>
            {sections.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {sections.map((name) => (
                  <ChoiceButton
                    key={name}
                    selected={row.section === name}
                    label={`Section ${name}`}
                    onClick={() => onChange({ section: name })}
                  >
                    {name}
                  </ChoiceButton>
                ))}
              </div>
            ) : (
              <p className="text-sm text-ground/60">Pick a year level first.</p>
            )}
            <FieldError message={errorFor("section")} />
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Email</span>
            <input
              type="email"
              value={row.email}
              onChange={(event) => onChange({ email: event.target.value })}
              onFocus={() => setFocused("email")}
              onBlur={() => setFocused(null)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                onSaveAndNext();
              }}
              inputMode="email"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="next"
              placeholder="juan@example.com"
              aria-invalid={errorFor("email") ? true : undefined}
              className={`${inputClass} ${invalidClass(errorFor("email"))}`}
            />
            <FieldError message={errorFor("email")} />
          </label>
          {errorFor("email") && emailFix ? (
            <button
              type="button"
              onClick={() => onChange({ email: emailFix })}
              className="-mt-1.5 min-h-11 self-start rounded-full bg-accent-2 px-4 text-sm font-semibold text-deep focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              Use {emailFix}
            </button>
          ) : null}

          {status.rowError ? (
            <p role="alert" className="rounded border border-red-300/40 bg-red-300/10 px-3 py-2 text-sm font-medium text-red-300">
              {status.rowError}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onRemove}
              className="min-h-11 px-1 text-sm font-semibold text-red-300 focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              Remove row
            </button>
            <button
              type="button"
              onClick={onSaveAndNext}
              className="min-h-11 rounded-full bg-accent-2 px-5 font-semibold text-deep focus:outline-2 focus:outline-offset-2 focus:outline-accent-2"
            >
              Save and next
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Red border on an input whose error is showing. */
function invalidClass(message: string | undefined): string {
  return message ? "border-red-300/80" : "";
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-1.5 text-sm font-medium text-red-300">
      <svg viewBox="0 0 20 20" fill="none" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth={1.6} />
        <path d="M10 6v4.5M10 13.5h.01" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" />
      </svg>
      {message}
    </p>
  );
}

function ChoiceButton({
  selected,
  label,
  onClick,
  children,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={label}
      onClick={onClick}
      className={`min-h-11 min-w-11 rounded border px-3 font-semibold focus:outline-2 focus:outline-offset-2 focus:outline-accent-2 ${
        selected
          ? "border-accent-2 bg-accent-2 text-deep"
          : "border-ground/25 bg-deep text-ground hover:border-ground/50"
      }`}
    >
      {children}
    </button>
  );
}

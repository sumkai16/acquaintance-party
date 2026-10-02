import { describe, expect, it } from "vitest";
import { allRows } from "./all-rows";

/** A fake table of `total` numbered rows that serves the inclusive ranges asked of it. */
function table(total: number, pageLog: Array<[number, number]> = []) {
  return async (from: number, to: number) => {
    pageLog.push([from, to]);
    const rows: number[] = [];
    for (let i = from; i <= Math.min(to, total - 1); i++) rows.push(i);
    return { data: rows, error: null };
  };
}

describe("allRows", () => {
  it("returns a small table in one request", async () => {
    const log: Array<[number, number]> = [];
    const rows = await allRows(table(5, log));
    expect(rows).toHaveLength(5);
    expect(log).toEqual([[0, 999]]);
  });

  it("keeps asking until a short page, so a table over 1000 rows is not cut off", async () => {
    const log: Array<[number, number]> = [];
    const rows = await allRows(table(2350, log));
    expect(rows).toHaveLength(2350);
    expect(rows[0]).toBe(0);
    expect(rows[2349]).toBe(2349);
    expect(log).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
  });

  it("asks once more after an exactly full page, then stops on the empty one", async () => {
    const log: Array<[number, number]> = [];
    const rows = await allRows(table(1000, log));
    expect(rows).toHaveLength(1000);
    expect(log).toEqual([
      [0, 999],
      [1000, 1999],
    ]);
  });

  it("returns an empty table as an empty list", async () => {
    expect(await allRows(table(0))).toEqual([]);
  });

  it("throws the database error rather than returning half the rows", async () => {
    let call = 0;
    const failing = async () => {
      call++;
      if (call === 2) return { data: null, error: { message: "boom" } };
      return { data: Array.from({ length: 1000 }, (_, i) => i), error: null };
    };
    await expect(allRows(failing)).rejects.toMatchObject({ message: "boom" });
  });
});

import { describe, expect, it } from "vitest";
import { tally, validateBallot } from "./ballot";

describe("validateBallot", () => {
  it("accepts one band and one solo from the line-up", () => {
    expect(validateBallot({ band: "six-of-seven", solo: "h4nzo" })).toEqual({
      ok: true,
      band: "six-of-seven",
      solo: "h4nzo",
    });
  });

  it("asks for both picks, not just one", () => {
    const missingSolo = validateBallot({ band: "burnout-band", solo: "" });
    expect(missingSolo.ok).toBe(false);
    const missingBand = validateBallot({ band: "", solo: "h4nzo" });
    expect(missingBand.ok).toBe(false);
  });

  it("refuses a solo act in the band slot and the other way round", () => {
    expect(validateBallot({ band: "h4nzo", solo: "h4nzo" }).ok).toBe(false);
    expect(validateBallot({ band: "six-of-seven", solo: "six-of-seven" }).ok).toBe(false);
  });

  it("refuses a key that is not in the line-up", () => {
    expect(validateBallot({ band: "made-up", solo: "h4nzo" }).ok).toBe(false);
  });
});

describe("tally", () => {
  it("lists every act, including those with no votes, most votes first", () => {
    const result = tally([
      { band_choice: "six-of-seven", solo_choice: "h4nzo" },
      { band_choice: "six-of-seven", solo_choice: "nap-batoon" },
      { band_choice: "burnout-band", solo_choice: "h4nzo" },
    ]);

    expect(result.total).toBe(3);
    expect(result.band.map((row) => [row.key, row.votes])).toEqual([
      ["six-of-seven", 2],
      ["burnout-band", 1],
    ]);
    expect(result.solo.map((row) => row.key)).toEqual([
      "h4nzo",
      "nap-batoon",
      "lovely-yungod",
      "marlo-alcaya",
      "ericson-bareno",
    ]);
    expect(result.solo.find((row) => row.key === "ericson-bareno")?.votes).toBe(0);
  });

  it("names the winner of each category", () => {
    const result = tally([
      { band_choice: "burnout-band", solo_choice: "marlo-alcaya" },
    ]);
    expect(result.winners.band.map((act) => act.name)).toEqual(["Burnout Band"]);
    expect(result.winners.solo.map((act) => act.name)).toEqual(["Marlo Alcaya"]);
  });

  it("reports a tie as every act on the top count, never picks one", () => {
    const result = tally([
      { band_choice: "burnout-band", solo_choice: "h4nzo" },
      { band_choice: "six-of-seven", solo_choice: "nap-batoon" },
    ]);
    expect(result.winners.band.map((act) => act.key).sort()).toEqual([
      "burnout-band",
      "six-of-seven",
    ]);
    expect(result.winners.solo.map((act) => act.key).sort()).toEqual([
      "h4nzo",
      "nap-batoon",
    ]);
  });

  it("has no winner before any vote is cast", () => {
    const result = tally([]);
    expect(result.total).toBe(0);
    expect(result.winners.band).toEqual([]);
    expect(result.winners.solo).toEqual([]);
  });

  it("ignores a stored key that is no longer in the line-up", () => {
    const result = tally([{ band_choice: "gone", solo_choice: "h4nzo" }]);
    expect(result.band.every((row) => row.votes === 0)).toBe(true);
    expect(result.solo.find((row) => row.key === "h4nzo")?.votes).toBe(1);
  });
});

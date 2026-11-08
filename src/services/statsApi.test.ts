import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchStats,
  StatsError,
  statsUrl,
  formatDate,
  candidateDates,
} from "./statsApi";

const validStats = [
  {
    leaderKey: "OP13-004",
    leaderName: "Sabo",
    matchups: [
      { opponent: "EB05-099", first_win_rate: 0.503, second_win_rate: 0.635 },
      { opponent: "P-076", first_win_rate: 1, second_win_rate: null },
    ],
  },
];

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

function notFound(): Response {
  return { ok: false, status: 404, json: async () => ({}) } as Response;
}

describe("date helpers", () => {
  it("formatDate pads month and day to YYYYMMDD", () => {
    expect(formatDate(new Date(2026, 0, 5))).toBe("20260105");
    expect(formatDate(new Date(2026, 11, 30))).toBe("20261230");
  });

  it("statsUrl embeds the date in both the filename and the cache-bust param", () => {
    expect(statsUrl("20260830")).toBe(
      "/api/stats/ranking_eb05_lw_p_top20_20260830.json?v=20260830"
    );
  });

  it("candidateDates lists today first, then previous days, newest-first", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 30)); // 2026-08-30
    const dates = candidateDates();
    expect(dates[0]).toBe("20260830");
    expect(dates[1]).toBe("20260829");
    expect(dates[2]).toBe("20260828");
    // strictly descending
    expect([...dates].sort((a, b) => b.localeCompare(a))).toEqual(dates);
    vi.useRealTimers();
  });
});

describe("fetchStats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 30));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("loads today's snapshot when it exists", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(validStats));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchStats();
    expect(result.date).toBe("20260830");
    expect(result.stats).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(statsUrl("20260830"));
  });

  it("walks back to a previous day when recent snapshots 404", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(notFound()) // 20260830
      .mockResolvedValueOnce(notFound()) // 20260829
      .mockResolvedValueOnce(jsonResponse(validStats)); // 20260828
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchStats();
    expect(result.date).toBe("20260828");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws when no snapshot is found in the window", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(notFound()));
    await expect(fetchStats()).rejects.toBeInstanceOf(StatsError);
  });

  it("throws a StatsError on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(fetchStats()).rejects.toThrow(StatsError);
  });

  it("throws when the JSON body is malformed", async () => {
    const bad = {
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    } as unknown as Response;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(bad));
    await expect(fetchStats()).rejects.toThrow(/invalid JSON/i);
  });

  it("rejects data that does not match the expected shape", async () => {
    const wrong = [{ leaderKey: "X", leaderName: "Y" }]; // no matchups array
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(wrong)));
    await expect(fetchStats()).rejects.toThrow(/expected format/i);
  });

  it("accepts null win rates (a turn order with no recorded games)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(validStats)));
    const result = await fetchStats();
    const nullSide = result.stats[0].matchups.find((m) => m.opponent === "P-076");
    expect(nullSide?.second_win_rate).toBeNull();
  });
});

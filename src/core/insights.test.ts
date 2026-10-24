import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeHistory,
  pacing,
  downsampleSegments,
  type InsightPoint,
} from "./insights";
import type { HistoryPoint } from "./history-data";
const now = 1800000000000,
  reset = now + 7200000;
const points: InsightPoint[] = Array.from({ length: 5 }, (_, i) => ({
  time: now - (4 - i) * 10 * 60000,
  percent: 10 + i * 5,
  used: null,
  remaining: null,
}));
const options = {
  now,
  refreshMinutes: 5,
  resetsAt: reset,
  reported: true,
  active: true,
};
test("pacing requires fresh active reported evidence and returns a conservative range", () => {
  const result = pacing(points, options);
  assert.equal(result.kind, "range");
  if (result.kind === "range") {
    assert.ok(result.highHours > result.lowHours);
    assert.equal(result.samples, 5);
  }
  for (const changed of [
    { reported: false },
    { active: false },
    { now: now + 3600000 },
    { resetsAt: null },
    { resetsAt: now },
  ])
    assert.equal(
      pacing(points, { ...options, ...changed }).kind,
      "insufficient",
    );
  assert.equal(pacing(points.slice(-3), options).kind, "insufficient");
  assert.equal(
    pacing(
      points.map((p) => ({ ...p, percent: 10 })),
      options,
    ).kind,
    "insufficient",
  );
});
test("duplicate observations do not inflate confidence; downsampling preserves segment boundaries", () => {
  const row: HistoryPoint = {
    accountId: "a",
    time: now,
    meters: [{ id: "x", usedPercent: 30 }],
  };
  const result = analyzeHistory(Array(100).fill(row), {
    ...options,
    activeConnectionIds: [],
  });
  assert.equal(result.series[0]!.samples, 1);
  const segments = [
    Array.from({ length: 500 }, (_, i) => ({
      ...points[0]!,
      time: i,
      percent: i % 100,
    })),
    Array.from({ length: 500 }, (_, i) => ({ ...points[0]!, time: 10000 + i })),
  ];
  const sampled = downsampleSegments(segments, 80);
  assert.equal(sampled.length, 2);
  assert.ok(sampled.flat().length <= 80);
  assert.ok(sampled[0]!.every((p) => p.time < 10000));
});

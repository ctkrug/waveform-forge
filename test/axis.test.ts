import { describe, expect, it } from "vitest";
import { drawHorizontalTicks, drawVerticalTicks } from "../src/ui/axis";
import type { Tick } from "../src/lib/ticks";

/** Records every call a fake CanvasRenderingContext2D receives, in order. */
function fakeCtx() {
  const calls: string[] = [];
  const ctx = {
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    beginPath: () => calls.push("beginPath"),
    moveTo: (x: number, y: number) => calls.push(`moveTo ${x} ${y}`),
    lineTo: (x: number, y: number) => calls.push(`lineTo ${x} ${y}`),
    stroke: () => calls.push("stroke"),
    strokeText: (text: string, x: number, y: number) =>
      calls.push(`strokeText ${text} ${x} ${y}`),
    fillText: (text: string, x: number, y: number) => calls.push(`fillText ${text} ${x} ${y}`),
  } as unknown as CanvasRenderingContext2D;
  return { ctx, calls };
}

const ticks: Tick[] = [
  { value: 0, label: "0:00" },
  { value: 5, label: "0:05" },
];

describe("drawVerticalTicks", () => {
  it("draws a gridline and a label per tick at the mapped x position", () => {
    const { ctx, calls } = fakeCtx();

    drawVerticalTicks(ctx, ticks, (value) => value * 10, 100);

    expect(calls).toEqual([
      "save",
      "beginPath",
      "moveTo 0.5 0",
      "lineTo 0.5 100",
      "stroke",
      "strokeText 0:00 3.5 98",
      "fillText 0:00 3.5 98",
      "beginPath",
      "moveTo 50.5 0",
      "lineTo 50.5 100",
      "stroke",
      "strokeText 0:05 53.5 98",
      "fillText 0:05 53.5 98",
      "restore",
    ]);
  });

  it("draws nothing for an empty tick list beyond save/restore", () => {
    const { ctx, calls } = fakeCtx();

    drawVerticalTicks(ctx, [], (value) => value, 100);

    expect(calls).toEqual(["save", "restore"]);
  });
});

describe("drawHorizontalTicks", () => {
  it("draws a gridline and a label per tick at the mapped y position", () => {
    const { ctx, calls } = fakeCtx();

    drawHorizontalTicks(ctx, ticks, (value) => 100 - value * 10, 200);

    expect(calls).toEqual([
      "save",
      "beginPath",
      "moveTo 0 100.5",
      "lineTo 200 100.5",
      "stroke",
      "strokeText 0:00 3 98.5",
      "fillText 0:00 3 98.5",
      "beginPath",
      "moveTo 0 50.5",
      "lineTo 200 50.5",
      "stroke",
      "strokeText 0:05 3 48.5",
      "fillText 0:05 3 48.5",
      "restore",
    ]);
  });
});

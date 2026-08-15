import { describe, expect, it } from "vitest";
import { getReadingEdgeScrollVelocity, getReadingHeadScrollVelocity, type ReadingViewport } from "@/lib/readingEdgeScroll";

const book: ReadingViewport = {
  left: 100,
  right: 900,
  top: 120,
  bottom: 720,
  width: 800,
  height: 600,
};

describe("reading edge scroll", () => {
  it("scrolls up at the top edge and down at the bottom edge", () => {
    expect(getReadingEdgeScrollVelocity({ x: 500, y: 125 }, book)).toBeLessThan(-400);
    expect(getReadingEdgeScrollVelocity({ x: 500, y: 715 }, book)).toBeGreaterThan(400);
  });

  it("keeps the center of the book neutral", () => {
    expect(getReadingEdgeScrollVelocity({ x: 500, y: 420 }, book)).toBe(0);
  });

  it("accelerates as gaze approaches an edge", () => {
    const nearTopZone = getReadingEdgeScrollVelocity({ x: 500, y: 205 }, book);
    const atTopEdge = getReadingEdgeScrollVelocity({ x: 500, y: 125 }, book);
    expect(Math.abs(atTopEdge)).toBeGreaterThan(Math.abs(nearTopZone));
  });

  it("does not scroll when gaze is outside the book", () => {
    expect(getReadingEdgeScrollVelocity({ x: 50, y: 125 }, book)).toBe(0);
    expect(getReadingEdgeScrollVelocity({ x: 500, y: 800 }, book)).toBe(0);
  });

  it("uses downward head intent when the filtered cursor cannot reach the edge", () => {
    const velocity = getReadingHeadScrollVelocity({ pitch: 14, neutralPitch: 0, upRange: 18, downRange: 18, invertVertical: false });
    expect(velocity).toBeGreaterThan(0);
  });

  it("keeps small pitch changes neutral and respects vertical inversion", () => {
    expect(getReadingHeadScrollVelocity({ pitch: 4, neutralPitch: 0, upRange: 18, downRange: 18, invertVertical: false })).toBe(0);
    expect(getReadingHeadScrollVelocity({ pitch: 14, neutralPitch: 0, upRange: 18, downRange: 18, invertVertical: true })).toBeLessThan(0);
  });
});

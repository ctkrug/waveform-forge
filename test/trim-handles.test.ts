import { describe, expect, it } from "vitest";
import { TrimHandles, type TrimHandlesElements } from "../src/ui/trim-handles";

/**
 * A minimal fake `EventTarget` + the handful of DOM APIs TrimHandles
 * actually touches (style, classList, setAttribute, setPointerCapture,
 * getBoundingClientRect). Enough to drive the class's real pointer/keyboard
 * wiring end-to-end without pulling in jsdom.
 */
type FakeEvent = Record<string, unknown>;
type FakeEventHandler = (event: FakeEvent) => void;

class FakeElement {
  style: Record<string, string> = {};
  private attrs = new Map<string, string>();
  private listeners = new Map<string, Set<FakeEventHandler>>();
  classList = {
    add: () => {},
    remove: () => {},
  };

  addEventListener(type: string, handler: FakeEventHandler): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: FakeEventHandler): void {
    this.listeners.get(type)?.delete(handler);
  }

  dispatch(type: string, event: FakeEvent = {}): void {
    const fullEvent = { preventDefault: () => {}, pointerId: 1, ...event };
    for (const handler of [...(this.listeners.get(type) ?? [])]) {
      handler(fullEvent);
    }
  }

  setAttribute(name: string, value: string): void {
    this.attrs.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attrs.get(name) ?? null;
  }

  setPointerCapture(): void {}

  getBoundingClientRect() {
    return { left: 0, width: 1000 } as DOMRect;
  }
}

function createHandles(): { handles: TrimHandles; el: Record<keyof TrimHandlesElements, FakeElement> } {
  const el = {
    container: new FakeElement(),
    startHandle: new FakeElement(),
    endHandle: new FakeElement(),
    region: new FakeElement(),
  };
  const handles = new TrimHandles(el as unknown as TrimHandlesElements);
  return { handles, el };
}

describe("TrimHandles keyboard nudging", () => {
  it("stops the start handle short of the end handle instead of crossing it", () => {
    const { handles, el } = createHandles();
    handles.setDuration(10);

    // Shift+ArrowRight nudges by 0.5s; 25 presses would overshoot past 10s.
    for (let i = 0; i < 25; i++) {
      el.startHandle.dispatch("keydown", { key: "ArrowRight", shiftKey: true });
    }

    const selection = handles.getSelection();
    expect(selection.start).toBeLessThan(selection.end);
    expect(selection.end).toBe(10);
    expect(selection.start).toBeCloseTo(9.99, 9);
  });

  it("stops the end handle short of the start handle instead of crossing it", () => {
    const { handles, el } = createHandles();
    handles.setDuration(10);

    for (let i = 0; i < 25; i++) {
      el.endHandle.dispatch("keydown", { key: "ArrowLeft", shiftKey: true });
    }

    const selection = handles.getSelection();
    expect(selection.start).toBeLessThan(selection.end);
    expect(selection.start).toBe(0);
    expect(selection.end).toBeCloseTo(0.01, 9);
  });

  it("keeps the focused handle's own aria-valuenow in sync with its semantic role", () => {
    const { handles, el } = createHandles();
    handles.setDuration(10);

    for (let i = 0; i < 25; i++) {
      el.startHandle.dispatch("keydown", { key: "ArrowRight", shiftKey: true });
    }

    expect(Number(el.startHandle.getAttribute("aria-valuenow"))).toBeCloseTo(9.99, 9);
    expect(Number(el.endHandle.getAttribute("aria-valuenow"))).toBe(10);
  });

  it("ignores keys other than the arrow keys", () => {
    const { handles, el } = createHandles();
    handles.setDuration(10);

    el.startHandle.dispatch("keydown", { key: "Enter" });

    expect(handles.getSelection()).toEqual({ start: 0, end: 10 });
  });
});

describe("TrimHandles pointer dragging", () => {
  it("stops a start-handle drag short of the end handle", () => {
    const { handles, el } = createHandles();
    handles.setDuration(10);

    el.startHandle.dispatch("pointerdown", { clientX: 0 });
    // Drag all the way to the right edge (time=10), attempting to cross end.
    el.startHandle.dispatch("pointermove", { clientX: 1000 });

    const selection = handles.getSelection();
    expect(selection.start).toBeLessThan(selection.end);
    expect(selection.end).toBe(10);
  });
});

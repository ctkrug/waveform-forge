import { clampSelection, type TrimSelection } from "../lib/trim";

/** Seconds nudged per arrow-key press; shift multiplies this by 10. */
const KEY_STEP_SECONDS = 0.05;
const KEY_STEP_SECONDS_FAST = 0.5;

export interface TrimHandlesElements {
  container: HTMLElement;
  startHandle: HTMLElement;
  endHandle: HTMLElement;
  region: HTMLElement;
}

/**
 * Owns the draggable in/out trim handles overlaid on the waveform: pointer
 * drag (mouse, touch, and pen all unify under the Pointer Events API),
 * keyboard nudging, and repositioning the DOM to match the current
 * selection.
 */
export class TrimHandles {
  private duration = 0;
  private selection: TrimSelection = { start: 0, end: 0 };
  private onChange: (selection: TrimSelection) => void = () => {};

  constructor(private readonly el: TrimHandlesElements) {
    this.wireHandle(el.startHandle, "start");
    this.wireHandle(el.endHandle, "end");
  }

  /** Resets the selection to the full duration of a newly loaded file. */
  setDuration(duration: number): void {
    this.duration = duration;
    this.selection = { start: 0, end: duration };
    this.el.startHandle.setAttribute("aria-valuemax", String(duration));
    this.el.endHandle.setAttribute("aria-valuemax", String(duration));
    this.reposition();
  }

  getSelection(): TrimSelection {
    return this.selection;
  }

  subscribe(callback: (selection: TrimSelection) => void): void {
    this.onChange = callback;
  }

  private setSelection(start: number, end: number): void {
    this.selection = clampSelection(start, end, this.duration);
    this.reposition();
    this.onChange(this.selection);
  }

  private reposition(): void {
    const { start, end } = this.selection;
    const startPct = this.duration === 0 ? 0 : (start / this.duration) * 100;
    const endPct = this.duration === 0 ? 0 : (end / this.duration) * 100;

    this.el.startHandle.style.left = `${startPct}%`;
    this.el.endHandle.style.left = `${endPct}%`;
    this.el.region.style.left = `${startPct}%`;
    this.el.region.style.width = `${Math.max(0, endPct - startPct)}%`;
    this.el.startHandle.setAttribute("aria-valuenow", start.toFixed(3));
    this.el.endHandle.setAttribute("aria-valuenow", end.toFixed(3));
  }

  private timeFromClientX(clientX: number): number {
    const rect = this.el.container.getBoundingClientRect();
    const ratio = rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
    return Math.min(1, Math.max(0, ratio)) * this.duration;
  }

  private wireHandle(handle: HTMLElement, which: "start" | "end"): void {
    handle.addEventListener("pointerdown", (event) => {
      handle.setPointerCapture(event.pointerId);
      handle.classList.add("is-dragging");

      const onMove = (moveEvent: PointerEvent) => {
        const time = this.timeFromClientX(moveEvent.clientX);
        if (which === "start") {
          this.setSelection(time, this.selection.end);
        } else {
          this.setSelection(this.selection.start, time);
        }
      };

      const onUp = () => {
        handle.classList.remove("is-dragging");
        handle.removeEventListener("pointermove", onMove);
        handle.removeEventListener("pointerup", onUp);
        handle.removeEventListener("pointercancel", onUp);
      };

      handle.addEventListener("pointermove", onMove);
      handle.addEventListener("pointerup", onUp);
      handle.addEventListener("pointercancel", onUp);
    });

    handle.addEventListener("keydown", (event) => {
      const step = event.shiftKey ? KEY_STEP_SECONDS_FAST : KEY_STEP_SECONDS;
      let delta = 0;
      if (event.key === "ArrowLeft") delta = -step;
      else if (event.key === "ArrowRight") delta = step;
      else return;

      event.preventDefault();
      if (which === "start") {
        this.setSelection(this.selection.start + delta, this.selection.end);
      } else {
        this.setSelection(this.selection.start, this.selection.end + delta);
      }
    });
  }
}

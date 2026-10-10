import { InputState } from "./types";

// How fast the steering signal eases toward its target (per second)
const STEER_RESPONSE = 7.0;
const STEER_RELEASE = 9.0;

export class InputManager {
  public state: InputState = {
    steer: 0,
    boost: false,
    switchCat: false,
  };

  private keys = {
    left: false,
    right: false,
    boost: false,
  };

  // Raw target the smoothed steer value eases toward
  private steerTarget = 0;
  private manualSteer = 0;

  private pointerDown = false;
  private pointerStartX = 0;
  private container: HTMLElement;
  private onSwitchCallback?: () => void;

  constructor(container: HTMLElement, onSwitchCat?: () => void) {
    this.container = container;
    this.onSwitchCallback = onSwitchCat;
    this.bindEvents();
  }

  private bindEvents(): void {
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);

    // Pointer events for touch/mouse steering
    this.container.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
  }

  public destroy(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);

    this.container.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);
  }

  /** Eases the steering signal toward its target. Call once per frame. */
  public update(delta: number): void {
    const keySteer = (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0);
    if (!this.pointerDown) {
      this.steerTarget = keySteer !== 0 ? keySteer : this.manualSteer;
    }

    const rate = Math.abs(this.steerTarget) < Math.abs(this.state.steer) ? STEER_RELEASE : STEER_RESPONSE;
    const t = Math.min(1, rate * delta);
    this.state.steer += (this.steerTarget - this.state.steer) * t;
    if (Math.abs(this.state.steer) < 0.001 && this.steerTarget === 0) this.state.steer = 0;
  }

  private handlePointerDown = (e: PointerEvent): void => {
    this.pointerDown = true;
    this.pointerStartX = e.clientX;
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.pointerDown) return;
    const diffX = (e.clientX - this.pointerStartX) / (window.innerWidth * 0.25);
    this.steerTarget = Math.max(-1, Math.min(1, diffX));
  };

  private handlePointerUp = (): void => {
    this.pointerDown = false;
    this.steerTarget = 0;
  };

  private handleBlur = (): void => {
    // Avoid stuck keys when the tab loses focus mid-press
    this.keys.left = false;
    this.keys.right = false;
    this.keys.boost = false;
    this.state.boost = false;
    this.pointerDown = false;
    this.manualSteer = 0;
    this.steerTarget = 0;
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
      this.keys.left = true;
    } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
      this.keys.right = true;
    } else if (e.key === " ") {
      e.preventDefault();
      this.keys.boost = true;
      this.state.boost = true;
    } else if ((e.key === "c" || e.key === "C") && !e.repeat) {
      this.onSwitchCallback?.();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (e.key === "a" || e.key === "A" || e.key === "ArrowLeft") {
      this.keys.left = false;
    } else if (e.key === "d" || e.key === "D" || e.key === "ArrowRight") {
      this.keys.right = false;
    } else if (e.key === " ") {
      this.keys.boost = false;
      this.state.boost = false;
    }
  };

  public setSteerManual(value: number): void {
    this.manualSteer = Math.max(-1, Math.min(1, value));
  }

  public setBoostManual(active: boolean): void {
    this.state.boost = active || this.keys.boost;
  }
}

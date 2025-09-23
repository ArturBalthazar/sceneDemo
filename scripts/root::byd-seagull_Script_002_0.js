class CustomLogic {
  static inspector = {
    strength: {
      type: "number",
      label: "Strength",
      default: 1,
      min: 0,
      max: 20,
      step: 0.01,
    },
    // compatibility for the user's spelled "strenght" (optional, will read either)
    strenght: {
      type: "number",
      label: "Strenght (alias)",
      default: 1,
      min: 0,
      max: 20,
      step: 0.01,
    },
  };

  attach(self, ctx) {
    const p = this.params ?? {};

    console.log("🔧 Drag-to-rotate (X -> Y) script attached to:", self?.name || "unknown object");
    console.log("🔧 Parameters received:", p);

    // Get canvas
    const canvas =
      (ctx && ctx.engine && typeof ctx.engine.getRenderingCanvas === "function" && ctx.engine.getRenderingCanvas()) ||
      (ctx && ctx.scene && ctx.scene.getEngine && ctx.scene.getEngine().getRenderingCanvas && ctx.scene.getEngine().getRenderingCanvas()) ||
      null;

    if (!canvas) {
      console.warn("Drag-to-rotate: No canvas found in ctx.engine / ctx.scene.");
      return;
    }

    // internal state
    this._dragging = false;
    this._lastX = 0;
    this._activePointerId = null;

    // Helper to read strength (supports both 'strength' and misspelled 'strenght')
    const readStrength = () => {
      const params = this.params ?? {};
      // prefer correctly spelled 'strength' if provided
      const s = params.strength !== undefined ? params.strength : params.strenght;
      // fallback default if neither present
      return typeof s === "number" ? s : 1;
    };

    // Pointer down: start drag, record normalized X
    this._onPointerDown = (evt) => {
      // Only left button (usually button === 0). Allow touch/pointer as well.
      // For pointer events, evt.button is 0 for primary.
      if (typeof evt.button === "number" && evt.button !== 0) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;

      this._dragging = true;
      this._activePointerId = evt.pointerId ?? null;
      this._lastX = (evt.clientX - rect.left) / rect.width;

      // capture pointer to keep receiving move/up even if leaving canvas
      try {
        if (evt.pointerId && canvas.setPointerCapture) {
          canvas.setPointerCapture(evt.pointerId);
        }
      } catch (e) {
        // ignore capture errors on some browsers
      }
    };

    // Pointer move: if dragging, compute normalized delta X and rotate around Y
    this._onPointerMove = (evt) => {
      if (!this._dragging) return;

      // If a pointerId is being tracked, ignore moves from other pointers
      if (this._activePointerId != null && evt.pointerId != null && evt.pointerId !== this._activePointerId) return;

      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0) return;

      const currentX = (evt.clientX - rect.left) / rect.width;
      const deltaX = currentX - this._lastX;
      this._lastX = currentX;

      // strength: number of full rotations per normalized full-width drag (multiplier).
      // deltaRotation in radians:
      const strength = readStrength();
      const deltaRotation = deltaX * strength * Math.PI * 2; // 2π = full revolution

      // Apply rotation around Y
      // Ensure rotation vector exists; if rotation is a BABYLON.Vector3 it supports direct property writes.
      if (self && self.rotation) {
        // Some objects may use quaternion instead of Euler rotation; we'll check and fallback:
        if (self.rotation && typeof self.rotation.y === "number") {
          self.rotation.y += deltaRotation;
        } else if (self.rotationQuaternion) {
          // Convert small Y-axis rotation into quaternion and multiply
          // Create a temporary quaternion only if needed
          const quat = BABYLON.Quaternion.RotationAxis(BABYLON.Axis.Y, deltaRotation);
          self.rotationQuaternion = quat.multiply(self.rotationQuaternion || BABYLON.Quaternion.Identity());
        } else {
          // Last fallback: try setting rotation property as object
          try {
            self.rotation = self.rotation || { x: 0, y: 0, z: 0 };
            self.rotation.y = (self.rotation.y || 0) + deltaRotation;
          } catch (e) {
            console.warn("Drag-to-rotate: unable to apply rotation to object", e);
          }
        }
      }
    };

    // Pointer up / cancel: stop dragging and release capture
    this._onPointerUp = (evt) => {
      if (this._activePointerId != null && evt.pointerId != null && evt.pointerId !== this._activePointerId) return;

      this._dragging = false;
      if (evt.pointerId && canvas.releasePointerCapture) {
        try {
          canvas.releasePointerCapture(evt.pointerId);
        } catch (e) {
          // ignore
        }
      }
      this._activePointerId = null;
    };

    // Attach listeners
    canvas.addEventListener("pointerdown", this._onPointerDown, { passive: true });
    // Use window for move/up so dragging continues even if pointer leaves canvas (pointer capture should help too).
    window.addEventListener("pointermove", this._onPointerMove, { passive: true });
    window.addEventListener("pointerup", this._onPointerUp, { passive: true });
    window.addEventListener("pointercancel", this._onPointerUp, { passive: true });

    // Save canvas handle for detach cleanup
    this._canvas = canvas;
  }

  detach() {
    // Remove listeners and release pointer capture if necessary
    try {
      const canvas = this._canvas;
      if (canvas && this._onPointerDown) {
        canvas.removeEventListener("pointerdown", this._onPointerDown);
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("pointermove", this._onPointerMove);
        window.removeEventListener("pointerup", this._onPointerUp);
        window.removeEventListener("pointercancel", this._onPointerUp);
      }

      if (this._activePointerId != null && canvas && canvas.releasePointerCapture) {
        try {
          canvas.releasePointerCapture(this._activePointerId);
        } catch (e) {
          // ignore
        }
      }
    } catch (e) {
      console.warn("Drag-to-rotate: error during detach cleanup", e);
    } finally {
      this._dragging = false;
      this._lastX = 0;
      this._activePointerId = null;
      this._onPointerDown = null;
      this._onPointerMove = null;
      this._onPointerUp = null;
      this._canvas = null;
    }
  }
}
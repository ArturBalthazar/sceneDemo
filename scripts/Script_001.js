class CustomLogic {
  static inspector = {
    // Limits (radians): 0 .. 1080°
    minRotation: { type: "number", label: "Min Rotation (rad)", default: 0, step: 0.01 },
    maxRotation: { type: "number", label: "Max Rotation (rad)", default: Math.PI * 6, step: 0.01 },

    // Speed & travel
    rotationSpeed: { type: "number", label: "Rotation Speed (rad/frame)", default: 0.02, step: 0.001 },
    travelPerTurn: { type: "number", label: "Worktable Travel per Turn (X units)", default: 0.2, step: 0.01 },

    // Two HTML buttons (uiElement = your HTML button mapped by id)
    forwardButton: { type: "uiElement", label: "Rotate +X Button" },
    backwardButton: { type: "uiElement", label: "Rotate -X Button" }
  };

  attach(self, ctx) {
    const p = this.params ?? {};

    // --- Find skeleton and bones once ---
    let skeleton = null;
    let crankBone = null;
    let worktableBone = null;

    for (const child of self.getChildren()) {
      if (!child.skeleton) continue;
      skeleton = child.skeleton;

      // Crank and table resolvers (avoid grabbing the crank when searching "worktable")
      crankBone = skeleton.bones.find(b => /worktable.*(traverse).*crank/i.test(b.name));
      worktableBone = skeleton.bones.find(b => /^worktable$/i.test(b.name));

      if (crankBone && worktableBone) break;
    }
    if (!crankBone || !worktableBone) {
      console.error("❌ Could not find required bones (Worktable_Traverse_Crank & Worktable).");
      return;
    }

    const crankNode = crankBone.getTransformNode?.() || null;
    const tableNode = worktableBone.getTransformNode?.() || null;

    // --- State ---
    let crankRot = 0;              // current crank rotation around X (radians)
    let dir = 0;                   // -1, 0, +1 based on which button is held
    let baseTablePos = tableNode ? tableNode.position.clone() : null;

    // --- Helpers: apply rotation & drive table travel ---
    const applyCrankRot = () => {
      const q = BABYLON.Quaternion.FromEulerAngles(crankRot, 0, 0);
      if (crankNode) {
        crankNode.rotationQuaternion = q;
      } else {
        // Fallback to bone
        crankBone.setRotationQuaternion(q, BABYLON.Space.LOCAL);
        crankBone.updateMatrix(BABYLON.Matrix.Identity(), false, true);
      }
    };

    const updateWorktable = () => {
      const turns = crankRot / (2 * Math.PI);
      const travelX = turns * p.travelPerTurn;

      if (tableNode) {
        if (!baseTablePos) baseTablePos = tableNode.position.clone();
        tableNode.position.x = baseTablePos.x + travelX;
      } else {
        worktableBone.setPosition(new BABYLON.Vector3(travelX, 0, 0), BABYLON.Space.LOCAL);
        worktableBone.updateMatrix(BABYLON.Matrix.Identity(), false, true);
      }
    };

    // --- Per-frame update: advance rotation while held, clamp to limits ---
    this._updateHandle = ctx.scene.onBeforeRenderObservable.add(() => {
      if (dir === 0) return;
      crankRot += dir * p.rotationSpeed;
      if (crankRot < p.minRotation) crankRot = p.minRotation;
      if (crankRot > p.maxRotation) crankRot = p.maxRotation;
      applyCrankRot();
      updateWorktable();
    });

    // ---------- BUTTON BINDING (HTML-first, Babylon GUI fallback) ----------
    // Safe bind: supports HTML elements and Babylon GUI controls
    const addDomPressHandlers = (el, direction) => {
      const down = () => { dir = direction; };
      const up = () => { if (dir === direction) dir = 0; };

      el.addEventListener("pointerdown", down);
      // stop when releasing anywhere (not just over the button)
      window.addEventListener("pointerup", up);
      el.addEventListener("pointerleave", up);

      // touch
      el.addEventListener("touchstart", down, { passive: true });
      window.addEventListener("touchend", up, { passive: true });

      // keep for cleanup
      return () => {
        el.removeEventListener("pointerdown", down);
        window.removeEventListener("pointerup", up);
        el.removeEventListener("pointerleave", up);
        el.removeEventListener("touchstart", down);
        window.removeEventListener("touchend", up);
      };
    };

    const addBabylonPressHandlers = (guiControl, direction) => {
      const down = () => { dir = direction; };
      const up = () => { if (dir === direction) dir = 0; };

      guiControl.onPointerDownObservable.add(down);
      guiControl.onPointerUpObservable.add(up);
      guiControl.onPointerOutObservable?.add(up);

      return () => {
        guiControl.onPointerDownObservable.removeCallback?.(down);
        guiControl.onPointerUpObservable.removeCallback?.(up);
        guiControl.onPointerOutObservable?.removeCallback?.(up);
      };
    };

    // Attempt to resolve a UI element by editor ref id (HTML first, then GUI)
    const resolveUiElement = (ref) => {
      if (!ref || !ref.id) return null;
      // 1) Plain DOM id
      let el = document.getElementById(ref.id);
      if (el) return { kind: "html", el };
      // 2) data-ui-id (some editors use this)
      el = document.querySelector(`[data-ui-id="${ref.id}"]`);
      if (el) return { kind: "html", el };
      // 3) Editor helper (Babylon GUI or later HTML mount)
      const ui = ctx.getUIElement?.(ref);
      if (ui) {
        // If it looks like a GUI control (has observables), treat as babylon
        if (ui.onPointerDownObservable && ui.onPointerUpObservable) {
          return { kind: "babylon", el: ui };
        }
        // If the helper returns a DOM node later, that’s fine too
        if (ui instanceof HTMLElement) {
          return { kind: "html", el: ui };
        }
      }
      return null;
    };

    const bindButton = (ref, direction) => {
      const resolved = resolveUiElement(ref);
      if (!resolved) return false;

      if (resolved.kind === "html") {
        const off = addDomPressHandlers(resolved.el, direction);
        this._unbinders.push(off);
        return true;
      } else {
        const off = addBabylonPressHandlers(resolved.el, direction);
        this._unbinders.push(off);
        return true;
      }
    };

    this._unbinders = [];

    // Try immediate bind; if not yet mounted, poll a bit
    const tryBindBoth = () => {
      const okF = bindButton(p.forwardButton, +1);
      const okB = bindButton(p.backwardButton, -1);
      return okF || okB;
    };

    if (!tryBindBoth()) {
      let tries = 0;
      this._pollTimer = setInterval(() => {
        if (tryBindBoth() || ++tries > 50) { // ~5s at 100ms
          clearInterval(this._pollTimer);
          this._pollTimer = null;
        }
      }, 100);
    }
  }

  detach(ctx) {
    if (this._updateHandle) {
      ctx.scene.onBeforeRenderObservable.remove(this._updateHandle);
      this._updateHandle = null;
    }
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._unbinders) {
      this._unbinders.forEach(off => { try { off(); } catch {} });
      this._unbinders = [];
    }
  }
}

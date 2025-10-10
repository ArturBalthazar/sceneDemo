class CustomLogic {
  static inspector = {
    // ---- Which bones to use (matched by "contains", case-insensitive) ----
    crankNameContains: { type: "string", label: "Crank Bone contains", default: "Worktable_Traverse_Crank" },
    drivenNameContains: { type: "string", label: "Driven Bone contains", default: "Worktable" },

    // ---- Limits & kinematics ----
    minRotation:  { type: "number", label: "Min Rotation (rad)", default: 0, step: 0.01 },
    maxRotation:  { type: "number", label: "Max Rotation (rad)", default: Math.PI * 6, step: 0.01 }, // 1080°
    rotationSpeed:{ type: "number", label: "Rotation Speed (rad/frame)", default: 0.02, step: 0.001 },
    travelPerTurn:{ type: "number", label: "Travel per Turn (units)", default: 0.2, step: 0.01 },

    // ---- Axes (pick per setup) ----
    rotationAxis:    { type: "enum", label: "Rotation Axis",    default: "X", options: ["X","Y","Z"] },
    translationAxis: { type: "enum", label: "Translation Axis", default: "X", options: ["X","Y","Z"] },

    // ---- UI buttons (HTML) ----
    forwardButton:  { type: "uiElement", label: "Rotate + Button" },
    backwardButton: { type: "uiElement", label: "Rotate - Button" }
  };

  attach(self, ctx) {
    const p = this.params ?? {};

    // ---------- Find bones robustly (by substring; supports "A|B" to require both) ----------
    const findBoneByContains = (skeleton, contains) => {
      if (!contains) return null;
      const tokens = contains.toLowerCase().split("|").map(s => s.trim()).filter(Boolean);
      const matches = skeleton.bones.filter(b => {
        const n = b.name.toLowerCase();
        return tokens.every(t => n.includes(t));
      });
      if (matches.length === 1) return matches[0];
      const exact = matches.find(b => b.name.toLowerCase() === contains.toLowerCase());
      if (exact) return exact;
      if (matches.length > 1) {
        console.warn(`⚠️ Multiple bones match "${contains}":`, matches.map(b=>b.name), "→ using", matches[0].name);
        return matches[0];
      }
      return null;
    };

    let crankBone = null, drivenBone = null, skeleton = null;

    for (const child of self.getChildren()) {
      if (!child.skeleton) continue;
      const sk = child.skeleton;
      const c = findBoneByContains(sk, p.crankNameContains);
      const d = findBoneByContains(sk, p.drivenNameContains);
      if (c && d && c !== d) { crankBone = c; drivenBone = d; skeleton = sk; break; }
    }

    if (!crankBone || !drivenBone) {
      console.error("❌ Could not uniquely resolve bones.",
        "crank:", p.crankNameContains, "driven:", p.drivenNameContains);
      if (skeleton) console.log("Bones available:", skeleton.bones.map(b=>b.name));
      return;
    }

    console.log(`🎯 Crank bone => ${crankBone.name} | Driven bone => ${drivenBone.name}`);

    const crankNode  = crankBone.getTransformNode?.()  || null;
    const drivenNode = drivenBone.getTransformNode?.() || null;

    // ---------- State ----------
    let crankRot = 0;
    let dir = 0; // -1 / 0 / +1
    let baseDrivenPos = drivenNode ? drivenNode.position.clone() : null;

    // ---------- Helpers ----------
    const applyCrankRot = () => {
      const rx = p.rotationAxis === "X" ? crankRot : 0;
      const ry = p.rotationAxis === "Y" ? crankRot : 0;
      const rz = p.rotationAxis === "Z" ? crankRot : 0;
      const q = BABYLON.Quaternion.FromEulerAngles(rx, ry, rz);
      if (crankNode) {
        crankNode.rotationQuaternion = q;
      } else {
        crankBone.setRotationQuaternion(q, BABYLON.Space.LOCAL);
        crankBone.updateMatrix(BABYLON.Matrix.Identity(), false, true);
      }
    };

    const updateDriven = () => {
      const turns = crankRot / (2 * Math.PI);
      const travel = turns * p.travelPerTurn;

      if (drivenNode) {
        if (!baseDrivenPos) baseDrivenPos = drivenNode.position.clone();
        drivenNode.position.copyFrom(baseDrivenPos);
        if (p.translationAxis === "X") drivenNode.position.x += travel;
        if (p.translationAxis === "Y") drivenNode.position.y += travel;
        if (p.translationAxis === "Z") drivenNode.position.z += travel;
      } else {
        const v = new BABYLON.Vector3(0,0,0);
        if (p.translationAxis === "X") v.x = travel;
        if (p.translationAxis === "Y") v.y = travel;
        if (p.translationAxis === "Z") v.z = travel;
        drivenBone.setPosition(v, BABYLON.Space.LOCAL);
        drivenBone.updateMatrix(BABYLON.Matrix.Identity(), false, true);
      }
    };

    // ---------- Per-frame ----------
    this._updateHandle = ctx.scene.onBeforeRenderObservable.add(() => {
      if (dir === 0) return;
      crankRot += dir * p.rotationSpeed;
      crankRot = Math.max(p.minRotation, Math.min(crankRot, p.maxRotation));
      applyCrankRot();
      updateDriven();
    });

    // ---------- Button binding (HTML DOM first, safe polling) ----------
    const addDomPressHandlers = (el, direction) => {
      const down = () => { dir = direction; };
      const up   = () => { if (dir === direction) dir = 0; };
      el.addEventListener("pointerdown", down);
      window.addEventListener("pointerup", up);
      el.addEventListener("pointerleave", up);
      el.addEventListener("touchstart", down, { passive: true });
      window.addEventListener("touchend", up, { passive: true });
      return () => {
        el.removeEventListener("pointerdown", down);
        window.removeEventListener("pointerup", up);
        el.removeEventListener("pointerleave", up);
        el.removeEventListener("touchstart", down);
        window.removeEventListener("touchend", up);
      };
    };

    const resolveHtml = (ref) => {
      if (!ref || !ref.id) return null;
      return document.getElementById(ref.id) || document.querySelector(`[data-ui-id="${ref.id}"]`);
    };

    this._unbinders = [];
    const bindButton = (ref, direction) => {
      const el = resolveHtml(ref);
      if (!el) return false;
      const off = addDomPressHandlers(el, direction);
      this._unbinders.push(off);
      return true;
    };

    const tryBindBoth = () => {
      const okF = bindButton(p.forwardButton,  +1);
      const okB = bindButton(p.backwardButton, -1);
      return okF || okB;
    };

    if (!tryBindBoth()) {
      let tries = 0;
      this._pollTimer = setInterval(() => {
        if (tryBindBoth() || ++tries > 50) {
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

class CustomLogic {
  static inspector = {
    crankNameContains:  { type: "string", label: "Crank Bone contains",  default: "Worktable_Traverse_Crank" },
    drivenNameContains: { type: "string", label: "Driven Bone contains", default: "Worktable" },

    minRotation:   { type: "number", label: "Min Rotation (rad)", default: 0, step: 0.01 },
    maxRotation:   { type: "number", label: "Max Rotation (rad)", default: Math.PI * 6, step: 0.01 },
    rotationSpeed: { type: "number", label: "Rotation Speed (rad/frame)", default: 0.02, step: 0.001 },
    travelPerTurn: { type: "number", label: "Travel per Turn (units)", default: 0.2, step: 0.01 },

    rotationAxis:    { type: "enum", label: "Rotation Axis",    default: "X", options: ["X","Y","Z"] },
    translationAxis: { type: "enum", label: "Translation Axis", default: "X", options: ["X","Y","Z"] },

    forwardButton:  { type: "uiElement", label: "Rotate + Button" },
    backwardButton: { type: "uiElement", label: "Rotate - Button" }
  };

  attach(self, ctx) {
    const p = this.params ?? {};

    // ---------- Bone finder ----------
    const findBoneByContains = (skeleton, contains) => {
      if (!contains) return null;
      const tokens = contains.toLowerCase().split("|").map(s => s.trim()).filter(Boolean);
      const matches = skeleton.bones.filter(b =>
        tokens.every(t => b.name.toLowerCase().includes(t))
      );
      if (matches.length > 0) return matches[0];
      return null;
    };

    let crankBone = null, drivenBone = null, skeleton = null;

    for (const child of self.getChildren()) {
      if (!child.skeleton) continue;
      skeleton = child.skeleton;
      crankBone  = findBoneByContains(skeleton, p.crankNameContains);
      drivenBone = findBoneByContains(skeleton, p.drivenNameContains);
      if (crankBone || drivenBone) break; // allow one or both
    }

    if (!crankBone && !drivenBone) {
      console.warn("⚠️ No matching crank or driven bone found, nothing to update.");
      return;
    }

    if (crankBone)  console.log(`🎯 Crank bone => ${crankBone.name}`);
    if (drivenBone) console.log(`🎯 Driven bone => ${drivenBone.name}`);

    const crankNode  = crankBone?.getTransformNode?.()  || null;
    const drivenNode = drivenBone?.getTransformNode?.() || null;

    let crankRot = 0;
    let dir = 0;
    let baseDrivenPos = drivenNode ? drivenNode.position.clone() : null;

    // ---------- Apply rotation ----------
    const applyCrankRot = () => {
      if (!crankBone) return;
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

    // ---------- Apply translation ----------
    const updateDriven = () => {
      if (!drivenBone) return;
      const turns = crankRot / (2 * Math.PI);
      const travel = turns * p.travelPerTurn;

      if (drivenNode) {
        if (!baseDrivenPos) baseDrivenPos = drivenNode.position.clone();
        drivenNode.position.copyFrom(baseDrivenPos);
        if (p.translationAxis === "X") drivenNode.position.x += travel;
        if (p.translationAxis === "Y") drivenNode.position.y += travel;
        if (p.translationAxis === "Z") drivenNode.position.z += travel;
      } else {
        const v = new BABYLON.Vector3();
        if (p.translationAxis === "X") v.x = travel;
        if (p.translationAxis === "Y") v.y = travel;
        if (p.translationAxis === "Z") v.z = travel;
        drivenBone.setPosition(v, BABYLON.Space.LOCAL);
        drivenBone.updateMatrix(BABYLON.Matrix.Identity(), false, true);
      }
    };

    // ---------- Frame update ----------
    this._updateHandle = ctx.scene.onBeforeRenderObservable.add(() => {
      if (dir === 0) return;
      crankRot += dir * p.rotationSpeed;
      crankRot = Math.max(p.minRotation, Math.min(crankRot, p.maxRotation));
      applyCrankRot();
      updateDriven();
    });

    // ---------- Button binding ----------
    const addDomPressHandlers = (el, direction) => {
      const down = () => { dir = direction; };
      const up   = () => { if (dir === direction) dir = 0; };
      el.addEventListener("pointerdown", down);
      window.addEventListener("pointerup", up);
      el.addEventListener("pointerleave", up);
      el.addEventListener("touchstart", down, { passive: true });
      window.addEventListener("touchend", up);
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
      const okF = bindButton(p.forwardButton, +1);
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

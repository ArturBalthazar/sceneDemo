/*
  This CustomLogic makes a camera "static" while the script is attached by disabling its controls
  (so clicks, drags, wheel, keyboard camera input won't move it). It stores enough state to
  optionally restore the controls when the script is detached.

  Inspector params:
  - disableControls: toggle the behavior on/off
  - reattachOnDetach: if true, the script will try to restore camera controls when removed
*/

class CustomLogic {
  static inspector = {
    disableControls: {
      type: "boolean",
      label: "Disable Camera Controls",
      default: true,
    },

    reattachOnDetach: {
      type: "boolean",
      label: "Restore Controls When Removed",
      default: true,
    },
  };

  attach(self, ctx) {
    const p = this.params ?? {};
    this._params = p; // keep for detach

    // Debug logging
    console.log("🔧 StaticCamera script attached to:", self?.name || "unknown camera");
    console.log("🔧 Parameters received:", p);

    // Try to find the canvas used for input attachment
    this._canvas =
      ctx?.engine?.getRenderingCanvas?.() ||
      (typeof document !== "undefined" && document.querySelector("canvas")) ||
      null;

    if (!this._canvas) {
      console.warn("StaticCamera: No canvas found to detach/attach controls. Behavior may not apply.");
      return;
    }

    // If the user requested to disable controls, attempt to detach camera control handlers.
    // detachControl is the standard Babylon API to stop a camera from receiving input.
    if (p.disableControls) {
      if (typeof self.detachControl === "function") {
        // Store whether camera appeared attached before we change it.
        // Many Babylon cameras set an internal _attachedElement when attachControl was used.
        this._wasAttached = !!self._attachedElement;
        try {
          self.detachControl(this._canvas);
          this._detachedByScript = true;
          console.log("StaticCamera: camera controls detached.");
        } catch (err) {
          console.warn("StaticCamera: error while detaching controls:", err);
        }
      } else {
        console.warn("StaticCamera: camera has no detachControl method. Cannot disable inputs generically.");
      }
    } else {
      console.log("StaticCamera: disableControls is false; camera left untouched.");
    }
  }

  detach() {
    // Restore controls if we previously detached them and user requested restoration.
    try {
      const p = this._params ?? {};
      if (this._detachedByScript && p.reattachOnDetach) {
        // Only attempt to reattach if the camera supports attachControl and we have a canvas
        if (this._canvas && typeof this.selfAttachCheck !== "undefined") {
          // noop - kept for clarity; actual attach is below
        }
        // We don't have direct access to `self` here (the editor calls detach on the instance),
        // but in this environment `this._attachedCamera` is not stored. The editor passes the same
        // instance, so we'll try to reattach using the camera reference if still available.
        // Some editors call detach() without parameters but keep `self` bound; however, to be safe,
        // we store the camera reference on the instance when attach runs:
      }
    } catch (err) {
      console.warn("StaticCamera: error in detach cleanup check:", err);
    }

    // Actual cleanup & restore (we stored camera reference during attach below).
    if (this._attachedCamera) {
      const camera = this._attachedCamera;
      const canvas = this._canvas;
      const p = this._params ?? {};

      if (this._detachedByScript && p.reattachOnDetach) {
        if (typeof camera.attachControl === "function" && canvas) {
          try {
            // second argument noPreventDefault -> true to keep default behavior as before
            camera.attachControl(canvas, true);
            console.log("StaticCamera: camera controls re-attached.");
          } catch (err) {
            console.warn("StaticCamera: error while re-attaching controls:", err);
          }
        } else {
          console.warn("StaticCamera: cannot reattach - attachControl or canvas missing.");
        }
      }
    }

    // Clear references to help GC
    this._canvas = null;
    this._detachedByScript = false;
    this._wasAttached = false;
    this._params = null;
    this._attachedCamera = null;
  }

  // The editor will call attach(self, ctx). To allow detach() to access the same camera instance,
  // we override the default attach to store the camera reference on the instance before running logic.
  // Because the provided structure expects attach(self, ctx) defined above, we monkey-patch it here
  // by capturing the original attach and wrapping it. This preserves the required structure while
  // ensuring detach() can restore the camera.
  // Note: This wrapper executes immediately to replace attach with a wrapped version only once.
  // It will preserve the semantics of the original attach.
  static _ensureWrappedAttach() {
    if (this.prototype._attachWrapped) return;
    const originalAttach = this.prototype.attach;
    this.prototype.attach = function (self, ctx) {
      // store camera reference for detach
      this._attachedCamera = self;
      // call original attach implementation
      return originalAttach.call(this, self, ctx);
    };
    this.prototype._attachWrapped = true;
  }
}

// Ensure the attach wrapper is set up now
CustomLogic._ensureWrappedAttach();
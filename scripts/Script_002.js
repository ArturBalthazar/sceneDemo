class CustomLogic {
  static inspector = {
    alphaMin: { type: "number", label: "Alpha Minimum (degrees)", default: 60 },
    alphaMax: { type: "number", label: "Alpha Maximum (degrees)", default: 120 },
    betaMin:  { type: "number", label: "Beta Minimum (degrees)",  default: 60 },
    betaMax:  { type: "number", label: "Beta Maximum (degrees)",  default: 70 },
    smoothingFactor: {
      type: "number",
      label: "Smoothing Factor",
      default: 0.2,  // 0=no smoothing, 1=very soft near limit
      min: 0,
      max: 1,
      step: 0.01,
    }
  };

  attach(self, ctx) {
    const p = this.params ?? {};

    const alphaMinRad = BABYLON.Angle.FromDegrees(p.alphaMin).radians();
    const alphaMaxRad = BABYLON.Angle.FromDegrees(p.alphaMax).radians();
    const betaMinRad  = BABYLON.Angle.FromDegrees(p.betaMin).radians();
    const betaMaxRad  = BABYLON.Angle.FromDegrees(p.betaMax).radians();

    self.lowerAlphaLimit = alphaMinRad;
    self.upperAlphaLimit = alphaMaxRad;
    self.lowerBetaLimit  = betaMinRad;
    self.upperBetaLimit  = betaMaxRad;

    let prevAlpha = self.alpha;
    let prevBeta  = self.beta;

    const smoothDelta = (prev, curr, min, max, factor) => {
      let delta = curr - prev;
      if (delta === 0) return curr;

      const distToMin = prev - min;
      const distToMax = max - prev;

      if (delta > 0 && distToMax < 0.5) {
        // approaching max
        const t = Math.max(0, distToMax / 0.5); // 0..1 over 0.5 rad buffer
        delta *= (1 - factor) + factor * t;
      } else if (delta < 0 && distToMin < 0.5) {
        // approaching min
        const t = Math.max(0, distToMin / 0.5);
        delta *= (1 - factor) + factor * t;
      }

      let next = prev + delta;
      if (next < min) next = min;
      if (next > max) next = max;
      return next;
    };

    this._observer = ctx.scene.onBeforeRenderObservable.add(() => {
      const desiredAlpha = self.alpha;
      const desiredBeta  = self.beta;

      const easedAlpha = smoothDelta(prevAlpha, desiredAlpha, alphaMinRad, alphaMaxRad, p.smoothingFactor);
      const easedBeta  = smoothDelta(prevBeta,  desiredBeta,  betaMinRad,  betaMaxRad,  p.smoothingFactor);

      self.alpha = easedAlpha;
      self.beta  = easedBeta;

      prevAlpha = easedAlpha;
      prevBeta  = easedBeta;
    });

    console.log("✅ Soft slowdown near camera limits enabled.");
  }

  detach(ctx) {
    if (this._observer) {
      ctx.scene.onBeforeRenderObservable.remove(this._observer);
      this._observer = null;
    }
  }
}

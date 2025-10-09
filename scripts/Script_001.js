class CustomLogic {
  static inspector = {
    myUIElement: {
      type: "uiElement",
      label: "UI Button",
    },
  };

  async attach(self, ctx) {
    const p = this.params ?? {};

    // Debug logging
    console.log("🔧 Script attached to:", self?.name || "unknown object");
    console.log("🔧 Parameters received:", p);

    // Wait for the UI element to be available
    const myButton = await ctx.getUIElement?.(p.myUIElement);
    if (myButton) {
      myButton.addEventListener('click', () => {
        // Create a new material on button click
        const newMaterial = new BABYLON.StandardMaterial("newMaterial", ctx.scene);
        
        // Randomize the color for the new material
        const randomColor = new BABYLON.Color3(
          Math.random(),
          Math.random(),
          Math.random()
        );
        newMaterial.diffuseColor = randomColor;

        // Assign the new material to the object
        self.material = newMaterial;
        console.log("🎨 New material created and applied with color:", randomColor);
      });
      console.log("✅ Button configured to change and replace material.");
    } else {
      console.log("❌ UI Button not found. Please ensure the button is correctly referenced.");
    }
  }

  detach() {
    // Cleanup logic could go here if needed
    console.log("🔧 Script detached, cleanup complete.");
  }
}
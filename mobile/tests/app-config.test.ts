import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("app config", () => {
  it("android package, version and icons configured", () => {
    const app = JSON.parse(readFileSync("app.json", "utf8")).expo;
    expect(app.android.package).toBe("com.pmcv.app");
    expect(app.version).toBe("1.0.0");
    expect(app.scheme).toMatch(/^[a-z][a-z0-9.+-]*$/);
    for (const f of ["assets/icon.png", "assets/adaptive-icon.png", "assets/splash.png"]) {
      expect(existsSync(f), f).toBe(true);
    }
  });
  it("eas preview builds apk", () => {
    const eas = JSON.parse(readFileSync("eas.json", "utf8"));
    expect(eas.build.preview.android.buildType).toBe("apk");
  });
  it("root README documents both projects and the APK flow", () => {
    const r = readFileSync("../README.md", "utf8");
    for (const needle of ["web/", "mobile/", "eas build", "eas login", "APK"]) {
      expect(r, needle).toContain(needle);
    }
  });
});

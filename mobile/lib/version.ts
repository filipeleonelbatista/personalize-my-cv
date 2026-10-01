// mobile/lib/version.ts
import appJson from "../app.json";

type ExpoConfig = {
  expo?: {
    version?: unknown;
    android?: {
      versionCode?: unknown;
    };
  };
};

const expo = (appJson as ExpoConfig).expo ?? {};

const rawVersion = expo.version;
const rawCode = expo.android?.versionCode;

export const APP_VERSION: string =
  typeof rawVersion === "string" && rawVersion.length > 0 ? rawVersion : "1.0.0";

export const ANDROID_VERSION_CODE: number =
  typeof rawCode === "number" && Number.isFinite(rawCode) ? rawCode : 1;

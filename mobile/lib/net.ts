// mobile/lib/net.ts
import * as Network from "expo-network";
import { getLocale, tErr } from "./i18n-locale";
import { toastError } from "./toast";

/** True when online; toasts the localized offline warning otherwise. */
export async function ensureOnline(): Promise<boolean> {
  try {
    const net = await Network.getNetworkStateAsync();
    if (net.isConnected !== true) {
      toastError(tErr(getLocale(), "offline"));
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

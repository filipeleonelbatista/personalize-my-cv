// mobile/app/index.tsx — boot gate: splash, then onboarding or dashboard.
import { useEffect, useState } from "react";
import { router } from "expo-router";
import { isOnboarded } from "../lib/store";
import { SplashScreen } from "../components/SplashScreen";

export default function Index() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      await new Promise((r) => setTimeout(r, 400));
      if (!cancelled) {
        router.replace((await isOnboarded()) ? "/(tabs)/curriculos" : "/onboarding");
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  if (!ready) return <SplashScreen />;
  return null;
}

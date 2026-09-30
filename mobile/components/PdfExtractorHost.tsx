// mobile/components/PdfExtractorHost.tsx
// Hidden WebView owning the vendored pdf.js harness. Mount once in _layout.
// Containment is structural (0x0 overflow-hidden wrapper in normal flow),
// never positional — so sibling order in the layout cannot affect visuals.
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Asset } from "expo-asset";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { registerExtractorHost, resolveExtractorJob } from "../lib/webview-extract";

export function PdfExtractorHost() {
  const ref = useRef<WebView>(null);
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    Asset.loadAsync(require("../assets/pdfjs/extract.html")).then((assets) => {
      setUri(assets[0]?.localUri ?? null);
    });
  }, []);

  useEffect(() => {
    return registerExtractorHost((js) => ref.current?.injectJavaScript(js));
  }, []);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data) as { id: number; ok: boolean; text?: string; error?: string; ready?: boolean };
      if (m.ready) return;
      resolveExtractorJob(m.id, m.ok, m.text, m.error);
    } catch {
      /* ignore malformed messages */
    }
  }

  if (!uri) return null;
  return (
    <View pointerEvents="none" style={{ width: 0, height: 0, overflow: "hidden", opacity: 0 }}>
      <WebView
        ref={ref}
        source={{ uri }}
        originWhitelist={["*"]}
        javaScriptEnabled
        allowFileAccess={true}
        domStorageEnabled={false}
        scrollEnabled={false}
        style={{ width: 0, height: 0 }}
        onMessage={onMessage}
      />
    </View>
  );
}

// mobile/components/PdfExtractorHost.tsx
// Hidden WebView owning the vendored pdf.js harness. Mount once in _layout.
import { useEffect, useRef, useState } from "react";
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
    <WebView
      ref={ref}
      source={{ uri }}
      originWhitelist={["*"]}
      javaScriptEnabled
      allowFileAccess={true}
      domStorageEnabled={false}
      style={{ width: 0, height: 0, position: "absolute" }}
      onMessage={onMessage}
    />
  );
}

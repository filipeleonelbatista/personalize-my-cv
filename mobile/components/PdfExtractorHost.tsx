// mobile/components/PdfExtractorHost.tsx
// Hidden WebView owning the vendored pdf.js harness. Mount once in _layout.
// Containment is structural (0x0 overflow-hidden wrapper in normal flow),
// never positional — so sibling order in the layout cannot affect visuals.
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { Asset } from "expo-asset";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import {
  registerExtractorHost,
  resolveExtractorJob,
  notifyExtractorReady,
  notifyExtractorFailed,
} from "../lib/webview-extract";

function log(...args: unknown[]): void {
  try {
    console.log("[pdf-host]", ...args);
  } catch {
    /* ignore */
  }
}

export function PdfExtractorHost() {
  const ref = useRef<WebView>(null);
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    Asset.loadAsync(require("../assets/pdfjs/extract.html")).then(
      (assets) => {
        const localUri = assets[0]?.localUri ?? null;
        log("harness asset:", localUri ?? "MISSING localUri");
        if (!localUri) {
          notifyExtractorFailed("Falha ao carregar o extrator de PDF (asset sem localUri).");
          return;
        }
        setUri(localUri);
      },
      (e) => {
        const msg = `Falha ao carregar o extrator de PDF: ${e instanceof Error ? e.message : String(e)}`;
        log(msg);
        notifyExtractorFailed(msg);
      },
    );
  }, []);

  useEffect(() => {
    return registerExtractorHost((js) => ref.current?.injectJavaScript(js));
  }, []);

  function onMessage(e: WebViewMessageEvent) {
    try {
      const m = JSON.parse(e.nativeEvent.data) as {
        id: number;
        ok: boolean;
        text?: string;
        error?: string;
        ready?: boolean;
        bootError?: string;
      };
      if (m.ready) {
        log("harness ready");
        notifyExtractorReady();
        return;
      }
      if (m.id === 0 && (m.bootError || m.ok === false)) {
        const msg = `Falha ao iniciar o extrator de PDF: ${m.bootError || m.error || "desconhecida"}`;
        log(msg);
        notifyExtractorFailed(msg);
        return;
      }
      resolveExtractorJob(m.id, m.ok, m.text, m.error);
    } catch {
      /* ignore malformed messages */
    }
  }

  function failLoad(detail: string, url?: string) {
    const msg = `Falha ao abrir o extrator de PDF: ${detail}`;
    log(msg, url);
    notifyExtractorFailed(msg);
  }

  function onError(e: { nativeEvent: { description?: string; code?: number | string; url?: string } }) {
    failLoad(e.nativeEvent.description || String(e.nativeEvent.code ?? "unknown"), e.nativeEvent.url);
  }

  function onHttpError(e: { nativeEvent: { description?: string; statusCode?: number; url?: string } }) {
    failLoad(e.nativeEvent.description || `HTTP ${e.nativeEvent.statusCode ?? "?"}`, e.nativeEvent.url);
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
        onError={onError}
        onHttpError={onError}
      />
    </View>
  );
}

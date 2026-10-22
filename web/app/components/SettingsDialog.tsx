"use client";

import { useEffect, useRef, useState } from "react";
import { LuSettings, LuShieldAlert } from "react-icons/lu";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  clearSettings,
  exportBackup,
  importBackup,
  loadSettings,
  saveSettings,
  setOnboarded,
  wipeAll,
} from "@/lib/store";
import { validateGeminiKey } from "@/lib/llm/chain";
import { DEFAULT_GEMINI_MODELS } from "@/lib/llm/gemini";
import { Button } from "./ui/button";
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { LocaleSelector } from "./LocaleSelector";
import { HelpDialog } from "./HelpDialog";
import { ThemeToggle } from "./theme-toggle";

type ProviderId = "gemini" | "openai" | "anthropic" | "openrouter";

const PROVIDERS: Array<{ id: ProviderId; label: string; url: string; placeholder: string }> = [
  { id: "gemini", label: "Gemini", url: "https://aistudio.google.com/apikey", placeholder: "GEMINI_API_KEY" },
  { id: "openai", label: "OpenAI", url: "https://platform.openai.com/api-keys", placeholder: "sk-..." },
  { id: "anthropic", label: "Anthropic", url: "https://console.anthropic.com/settings/keys", placeholder: "sk-ant-..." },
  { id: "openrouter", label: "OpenRouter", url: "https://openrouter.ai/keys", placeholder: "sk-or-..." },
];

const PROVIDER_DEFAULT_MODELS: Record<ProviderId, string[]> = {
  gemini: DEFAULT_GEMINI_MODELS,
  openai: ["gpt-4.1", "gpt-4o", "gpt-4o-mini", "gpt-4.1-mini", "o4-mini"],
  anthropic: ["claude-3-5-sonnet-latest", "claude-3-7-sonnet-latest", "claude-3-5-haiku-latest"],
  openrouter: ["openai/gpt-4o", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash-001"],
};

type ProviderConfig = {
  provider: ProviderId;
  keys: Record<ProviderId, string>;
  models: Record<ProviderId, string[]>;
};

const defaultConfig: ProviderConfig = {
  provider: "gemini",
  keys: { gemini: "", openai: "", anthropic: "", openrouter: "" },
  models: {
    gemini: [...DEFAULT_GEMINI_MODELS],
    openai: [...PROVIDER_DEFAULT_MODELS.openai],
    anthropic: [...PROVIDER_DEFAULT_MODELS.anthropic],
    openrouter: [...PROVIDER_DEFAULT_MODELS.openrouter],
  },
};

function loadProviderConfig(): ProviderConfig {
  try {
    const raw = localStorage.getItem("pmcv:provider-config");
    if (!raw) return defaultConfig;
    const parsed = JSON.parse(raw) as Partial<ProviderConfig>;
    return {
      provider: parsed.provider === "openai" || parsed.provider === "anthropic" || parsed.provider === "openrouter" ? parsed.provider : "gemini",
      keys: { ...defaultConfig.keys, ...(parsed.keys ?? {}) },
      models: {
        gemini: Array.isArray(parsed.models?.gemini) && parsed.models.gemini.length ? parsed.models.gemini : [...DEFAULT_GEMINI_MODELS],
        openai: Array.isArray(parsed.models?.openai) && parsed.models.openai.length ? parsed.models.openai : [...PROVIDER_DEFAULT_MODELS.openai],
        anthropic: Array.isArray(parsed.models?.anthropic) && parsed.models.anthropic.length ? parsed.models.anthropic : [...PROVIDER_DEFAULT_MODELS.anthropic],
        openrouter: Array.isArray(parsed.models?.openrouter) && parsed.models.openrouter.length ? parsed.models.openrouter : [...PROVIDER_DEFAULT_MODELS.openrouter],
      },
    };
  } catch {
    return defaultConfig;
  }
}

function saveProviderConfig(config: ProviderConfig) {
  localStorage.setItem("pmcv:provider-config", JSON.stringify(config));
}

export function SettingsDialog({ open, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const t = useTranslations("Settings");
  const tr = useTranslations("Research");
  const [internalOpen, setInternalOpen] = useState(false);
  const [tab, setTab] = useState("appearance");
  const [provider, setProvider] = useState<ProviderId>("gemini");
  const [key, setKey] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  function setDialogOpen(next: boolean) {
    if (isControlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  useEffect(() => {
    if (!isOpen) return;
    const s = loadSettings();
    const config = loadProviderConfig();
    const active = config.provider;
    const activeKey = config.keys[active] || (active === "gemini" ? s.geminiKey : "");
    const activeModels = config.models[active]?.length ? config.models[active] : [...(PROVIDER_DEFAULT_MODELS[active] ?? [])];
    setProvider(active);
    setKey(activeKey);
    setModels(activeModels);
    setCustom((activeModels.filter((m) => !(PROVIDER_DEFAULT_MODELS[active] ?? DEFAULT_GEMINI_MODELS).includes(m))).join(", "));
    setError("");
    setTab("appearance");
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const config = loadProviderConfig();
    const s = loadSettings();
    const activeKey = config.keys[provider] || (provider === "gemini" ? s.geminiKey : "");
    const activeModels = config.models[provider]?.length ? config.models[provider] : [...(PROVIDER_DEFAULT_MODELS[provider] ?? [])];
    setKey(activeKey);
    setModels(activeModels);
    setCustom((activeModels.filter((m) => !(PROVIDER_DEFAULT_MODELS[provider] ?? DEFAULT_GEMINI_MODELS).includes(m))).join(", "));
  }, [provider, isOpen]);

  function toggleModel(m: string) {
    setModels((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]));
  }

  async function handleSave() {
    setError("");
    setLoading(true);
    try {
      const trimmed = key.trim();
      if (!trimmed) {
        setError(t("providerKeyRequired"));
        return;
      }
      if (provider === "gemini") {
        const v = await validateGeminiKey(trimmed);
        if (!v.ok) {
          setError(v.error);
          return;
        }
      }

      const all = Array.from(new Set([...models, ...custom.split(",").map((s) => s.trim()).filter(Boolean)]));
      if (!all.length) {
        setError(t("minOneModel"));
        return;
      }
      const config = loadProviderConfig();
      config.provider = provider;
      config.keys[provider] = trimmed;
      config.models[provider] = all;
      saveProviderConfig(config);
      if (provider === "gemini") {
        saveSettings({ geminiKey: trimmed, models: all });
      }
      toast.success(t("updated"));
      setDialogOpen(false);
    } finally {
      setLoading(false);
    }
  }

  function handleClearKey() {
    if (!window.confirm(t("confirmClear"))) return;
    const config = loadProviderConfig();
    config.keys[provider] = "";
    config.models[provider] = [];
    saveProviderConfig(config);
    if (provider === "gemini") {
      clearSettings();
      setOnboarded(false);
      window.location.reload();
      return;
    }
    setKey("");
    setModels([]);
    setCustom("");
  }

  function handleExport() {
    const blob = new Blob([exportBackup()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pmcv-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    toast.success(t("exported"));
  }

  async function handleImportFile(file: File) {
    try {
      importBackup(await file.text());
      toast.success(t("imported"));
      window.location.reload();
    } catch (e) {
      toast.error(t("invalidBackup"), { description: (e as Error).message.slice(0, 300) });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function handleWipeAll() {
    wipeAll();
    window.location.reload();
  }

  const providerMeta = PROVIDERS.find((p) => p.id === provider) ?? PROVIDERS[0];
  const providerDefaults = PROVIDER_DEFAULT_MODELS[provider] ?? DEFAULT_GEMINI_MODELS;
  const options = Array.from(new Set([...providerDefaults, ...models]));
  const keyLinkText = `${t("createKeyLinkBase")} ${new URL(providerMeta.url).hostname}`;

  return (
    <>
      {!isControlled ? (
        <Button variant="outline" onClick={() => setDialogOpen(true)}>
          <LuSettings /> {t("open")}
        </Button>
      ) : null}
      <Dialog open={isOpen} onClose={() => setDialogOpen(false)} className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("desc")}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Tabs value={tab} onChange={setTab} className="space-y-4">
            <TabsList className="w-full justify-start overflow-auto">
              <TabsTrigger value="appearance">{t("appearance")}</TabsTrigger>
              <TabsTrigger value="ai">{t("ai")}</TabsTrigger>
              <TabsTrigger value="backup">{t("backupTab")}</TabsTrigger>
            </TabsList>

            <TabsContent value="appearance">
              <div className="space-y-5">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("darkMode")}</p>
                    <p className="text-xs text-muted-foreground">{t("darkModeDesc")}</p>
                  </div>
                  <ThemeToggle />
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("language")}</p>
                    <p className="text-xs text-muted-foreground">{t("languageDesc")}</p>
                  </div>
                  <LocaleSelector />
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">{t("help")}</p>
                    <p className="text-xs text-muted-foreground">{t("helpDesc")}</p>
                  </div>
                  <HelpDialog />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="ai">
              <div className="space-y-4">
                <p className="rounded-md border border-border bg-muted p-3 text-xs text-muted-foreground">{tr("environmentNotice")}</p>
                <div className="flex flex-wrap gap-2">
                  {PROVIDERS.map((item) => (
                    <Button
                      key={item.id}
                      type="button"
                      variant={provider === item.id ? "default" : "outline"}
                      size="sm"
                      onClick={() => setProvider(item.id)}
                    >
                      {item.label}
                    </Button>
                  ))}
                </div>

                <div className="rounded-md border p-4">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{providerMeta.label}</p>
                      <p className="text-xs text-muted-foreground">{t("fallbackHint")}</p>
                    </div>
                    <a href={providerMeta.url} target="_blank" rel="noopener" className="text-xs underline">
                      {keyLinkText}
                    </a>
                  </div>

                  <input
                    type="password"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder={providerMeta.placeholder}
                    className="w-full rounded border p-2 text-sm"
                    disabled={loading}
                  />

                  <fieldset className="mt-4 space-y-2">
                    <legend className="text-sm font-medium">{t("modelsLegend")}</legend>
                    {options.map((m) => (
                      <label key={m} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={models.includes(m)}
                          onChange={() => toggleModel(m)}
                          disabled={loading}
                        />
                        {m}
                      </label>
                    ))}
                    <input
                      type="text"
                      value={custom}
                      onChange={(e) => setCustom(e.target.value)}
                      placeholder={t("customPlaceholder")}
                      className="w-full rounded border p-2 text-sm"
                      disabled={loading}
                    />
                  </fieldset>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {error ? <p className="text-sm text-destructive">{error}</p> : <span />}
                  <Button variant="outline" size="sm" onClick={handleClearKey} disabled={loading}>
                    {t("clearKey")}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="backup">
              <div className="space-y-4">
                <div className="rounded-md border p-3">
                  <p className="text-sm font-medium">{t("backupInfoTitle")}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{t("backupInfo")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={handleExport}>{t("export")}</Button>
                  <Button variant="outline" onClick={() => fileRef.current?.click()}>{t("import")}</Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="application/json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handleImportFile(f);
                    }}
                  />
                </div>
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                    <LuShieldAlert /> {t("wipeAll")}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t("wipeDesc")}</p>
                  <div className="mt-3">
                    <Button variant="destructive" onClick={() => setConfirmWipe(true)} disabled={loading}>
                      {t("wipeAll")}
                    </Button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={loading}>{t("cancel")}</Button>
          <Button onClick={handleSave} disabled={loading || !key.trim()}>{loading ? t("validating") : t("save")}</Button>
        </DialogFooter>
      </Dialog>

      <Dialog open={confirmWipe} onClose={() => setConfirmWipe(false)}>
        <DialogHeader>
          <DialogTitle>{t("wipeTitle")}</DialogTitle>
          <DialogDescription>{t("wipeDesc")}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setConfirmWipe(false)}>{t("cancel")}</Button>
          <Button variant="destructive" onClick={handleWipeAll}>{t("wipeConfirm")}</Button>
        </DialogFooter>
      </Dialog>
    </>
  );
}

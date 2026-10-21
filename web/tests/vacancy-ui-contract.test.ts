// web/tests/vacancy-ui-contract.test.ts
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

describe("vacancy url + chat UI", () => {
  it("the generate modal has an optional job url field", () => {
    const src = readFileSync("app/components/GenerateModal.tsx", "utf8");
    expect(src).toContain("jobUrl");
    expect(src).toContain('t("jobUrl")');
    expect(src).toContain("normalizeJobUrl");
  });
  it("the detail drawer opens the job posting and starts the chat", () => {
    const src = readFileSync("app/components/DetailDrawer.tsx", "utf8");
    expect(src).toContain("VacancyChat");
    expect(src).toContain('t("chatWithVacancy")');
    expect(src).toContain('window.open(app.jobUrl, "_blank", "noopener,noreferrer")');
  });
  it("the job link shows whenever the vacancy has a url, even without an analysis", () => {
    const src = readFileSync("app/components/DetailDrawer.tsx", "utf8");
    expect(src).toMatch(/\{app\.jobUrl \? \(\s*<Button[^>]*>\s*<LuExternalLink \/> \{t\("openJob"\)\}/);
  });
  it("the chat component asks the AI with the vacancy context and persists nothing", () => {
    expect(existsSync("app/components/VacancyChat.tsx")).toBe(true);
    const src = readFileSync("app/components/VacancyChat.tsx", "utf8");
    expect(src).toContain("askVacancy");
    expect(src).not.toContain("saveApps");
    expect(src).not.toContain("localStorage");
  });
  it("all three locales carry the new keys", () => {
    for (const loc of ["pt-BR", "en-US", "es-ES"]) {
      const m = JSON.parse(readFileSync(`messages/${loc}.json`, "utf8"));
      expect(m.Generate.jobUrl, loc).toBeTruthy();
      expect(m.Generate.jobUrlPlaceholder, loc).toBeTruthy();
      expect(m.Generate.jobUrlInvalid, loc).toBeTruthy();
      expect(m.Detail.openJob, loc).toBeTruthy();
      expect(m.Detail.chatWithVacancy, loc).toBeTruthy();
      expect(m.VacancyChat.title, loc).toBeTruthy();
      expect(m.VacancyChat.placeholder, loc).toBeTruthy();
      expect(m.VacancyChat.send, loc).toBeTruthy();
    }
  });
  it("the chat answers in the interface language", () => {
    const src = readFileSync("lib/vacancy-chat.ts", "utf8");
    expect(src).toContain("getLocale");
    expect(src).toContain("buildVacancyChatSystem(locale)");
  });
});

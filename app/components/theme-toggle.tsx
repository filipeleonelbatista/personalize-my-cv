"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { LuSun, LuMoon } from "react-icons/lu";
import { Button } from "./ui/button";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = (theme === "system" ? resolvedTheme : theme) === "dark";
  return (
    <Button variant="ghost" size="icon" onClick={() => setTheme(dark ? "light" : "dark")} aria-label="Alternar tema">
      {mounted && dark ? <LuSun /> : <LuMoon />}
    </Button>
  );
}

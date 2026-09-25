// Appearance, as in Henry: three choices (tone, highlight, shade) derive the whole palette, which
// is written as CSS variables on <html>. The chart reads the same variables when it is built.
import { useSyncExternalStore } from "react";
import { saveDevice, settings } from "./settings";

export const TONES = {
  graphite: { h: 250, c: 0 },
  slate: { h: 255, c: 0.018 },
  ink: { h: 265, c: 0.028 },
  mocha: { h: 60, c: 0.012 },
  moss: { h: 150, c: 0.012 },
  plum: { h: 320, c: 0.016 },
} as const;
export const HIGHLIGHTS = { blue: 255, teal: 195, green: 145, amber: 75, coral: 30, violet: 300, rose: 350 } as const;
/** Background lightness. Past 0.5 the palette flips: surfaces step darker, text drops to read on paper. */
export const SHADES = { black: 0.11, dark: 0.18, dim: 0.24, light: 0.93, white: 0.985 } as const;
export const isLight = (shade: keyof typeof SHADES = current.shade): boolean => SHADES[shade] > 0.5;

export interface ThemeChoice {
  tone: keyof typeof TONES;
  highlight: keyof typeof HIGHLIGHTS;
  shade: keyof typeof SHADES;
}
const DEFAULT: ThemeChoice = { tone: "slate", highlight: "blue", shade: "dark" };

// OKLCH -> sRGB hex. Chroma is pulled in until the color fits the gamut.
export function oklch(L: number, C: number, H: number): string {
  for (let c = C; ; c = Math.max(0, c - 0.01)) {
    const hr = (H * Math.PI) / 180;
    const a = c * Math.cos(hr), b = c * Math.sin(hr);
    const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const rgb = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (c === 0 || rgb.every((x) => x >= -0.002 && x <= 1.002)) {
      return "#" + rgb.map((x) => {
        const v = Math.min(1, Math.max(0, x));
        const g = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
        return Math.round(g * 255).toString(16).padStart(2, "0");
      }).join("");
    }
  }
}

export function palette(t: ThemeChoice): Record<string, string> {
  const tone = TONES[t.tone], L0 = SHADES[t.shade], hh = HIGHLIGHTS[t.highlight];
  const light = isLight(t.shade);
  const bg = (dl: number) => oklch(L0 + (light ? -dl : dl), tone.c, tone.h);
  const grey = (L: number, k = 1) => oklch(L, tone.c * k, tone.h);
  const L = (dark: number, onPaper: number) => (light ? onPaper : dark);
  const accent = oklch(L(0.76, 0.5), L(0.13, 0.16), hh);
  return {
    "--bg": bg(0), "--bg-2": bg(0.035), "--bg-3": bg(0.075), "--border": bg(0.13), "--grid": bg(0.055),
    "--fg": grey(L(0.88, 0.2), 0.6), "--fg-dim": grey(L(0.64, 0.42)), "--fg-faint": grey(L(0.48, 0.56)),
    "--accent": accent, "--accent-soft": accent + "2e", "--accent-glow": accent + "e6", "--sel": accent + "55",
    // Up and down are Henry's ok and alarm.
    "--up": oklch(L(0.72, 0.55), 0.17, 150), "--down": oklch(L(0.68, 0.55), 0.19, 25),
    "--warn": oklch(L(0.77, 0.6), 0.15, 80),
  };
}

function valid(raw: Partial<ThemeChoice> = {}): ThemeChoice {
  return {
    tone: raw.tone && raw.tone in TONES ? raw.tone : DEFAULT.tone,
    highlight: raw.highlight && raw.highlight in HIGHLIGHTS ? raw.highlight : DEFAULT.highlight,
    shade: raw.shade && raw.shade in SHADES ? raw.shade : DEFAULT.shade,
  };
}

let current = DEFAULT;
const listeners = new Set<() => void>();

/** The theme saved on this machine (the device half of the settings file). */
export function initTheme() {
  current = valid(settings().device.theme as Partial<ThemeChoice> | undefined);
  applyTheme();
}

export function applyTheme() {
  const root = document.documentElement.style;
  for (const [k, val] of Object.entries(palette(current))) root.setProperty(k, val);
  root.colorScheme = isLight() ? "light" : "dark";
  document.documentElement.classList.toggle("light", isLight());
  // A phone colours its status bar (and an installed app its title bar) with this.
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", palette(current)["--bg-2"] ?? "#161a21");
}
export function setTheme(patch: Partial<ThemeChoice>) {
  current = { ...current, ...patch };
  saveDevice({ theme: current });
  applyTheme();
  listeners.forEach((f) => f());
}
export function onTheme(fn: () => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export function useTheme(): ThemeChoice {
  return useSyncExternalStore(onTheme, () => current);
}
export function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}
/** A line colour for a hue that reads on the current shade: indicator lines, mostly. */
export function hueLine(hue: number): string {
  return oklch(isLight() ? 0.55 : 0.75, 0.14, hue);
}

// Icons, brand mark and category styles from the team's Figma redesign.
import type { CSSProperties } from "react";
import type { Category } from "../../shared/resources";
import lifelineMark from "../assets/figma/lifeline-mark.svg";

// Every downloaded Figma icon, plus our own icons drawn in the same line style, by file name ("pill", "map-pin", ...).
const URLS = Object.fromEntries(
  Object.entries({
    ...import.meta.glob<string>("../assets/figma/*.svg", { eager: true, query: "?url", import: "default" }),
    ...import.meta.glob<string>("../assets/icons/*.svg", { eager: true, query: "?url", import: "default" }),
  }).map(([path, url]) => [path.split("/").pop()!.replace(".svg", ""), url]),
);

export type FigmaIconName =
  | "arrow-right" | "battery-charging" | "car-bolt" | "check" | "chevron-down" | "chevron-right" | "clock-3" | "cross"
  | "droplets" | "guidance-link" | "house" | "info-link" | "locate-fixed" | "map-pin" | "mic" | "navigation"
  | "phone" | "pill" | "search" | "sparkles" | "thermometer-sun" | "utensils" | "x" | "pin-tip";

export const figmaIconUrl = (name: FigmaIconName) => URLS[name];

/** A Figma line icon in the current text color (drawn as a mask, so it follows themes). */
export function FIcon({ name, size = 16, className = "", style }: { name: FigmaIconName; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <span
      aria-hidden="true"
      className={`ficon ${className}`}
      style={{ width: `${size / 16}rem`, height: `${size / 16}rem`, ["--icon" as string]: `url("${URLS[name]}")`, ...style }}
    />
  );
}

export function LifelineMark({ size = 34 }: { size?: number }) {
  return <img src={lifelineMark} alt="" width={size} height={size} className="shrink-0" style={{ width: `${size / 16}rem`, height: `${size / 16}rem` }} />;
}

/** Pin color, light tint, dark text and icon for each kind of place. */
export interface CategoryStyle {
  pin: string;
  tint: string;
  text: string;
  icon: FigmaIconName;
}

export const CATEGORY_STYLE: Record<Category, CategoryStyle> = {
  pharmacy: { pin: "#ec407a", tint: "#fce4ec", text: "#b71c4e", icon: "pill" },
  health: { pin: "#e53935", tint: "#ffebee", text: "#b71c1c", icon: "cross" },
  food: { pin: "#f57c00", tint: "#fff3e0", text: "#8a3900", icon: "utensils" },
  shelter: { pin: "#43a047", tint: "#e8f5e9", text: "#1b5e20", icon: "house" },
  charging: { pin: "#f9a825", tint: "#fffde7", text: "#725000", icon: "battery-charging" },
  water: { pin: "#1e88e5", tint: "#e3f2fd", text: "#0d47a1", icon: "droplets" },
  // Not in the Figma file; picked to sit with the palette.
  cooling: { pin: "#00897b", tint: "#e0f2f1", text: "#00574b", icon: "thermometer-sun" },
  ev_charging: { pin: "#607d8b", tint: "#eceff1", text: "#37474f", icon: "car-bolt" },
};

/** The filter tabs under the map. Medicine covers pharmacies and clinics, Charging covers car chargers too. */
export const TABS: { key: string; categories: Category[] | null; style: CategoryStyle }[] = [
  { key: "all", categories: null, style: { pin: "#075d60", tint: "#fef9ef", text: "#163b3b", icon: "check" } },
  { key: "medicine", categories: ["pharmacy", "health"], style: CATEGORY_STYLE.pharmacy },
  { key: "food", categories: ["food"], style: CATEGORY_STYLE.food },
  { key: "shelter", categories: ["shelter"], style: CATEGORY_STYLE.shelter },
  { key: "cooling", categories: ["cooling"], style: CATEGORY_STYLE.cooling },
  { key: "charging", categories: ["charging", "ev_charging"], style: CATEGORY_STYLE.charging },
  { key: "water", categories: ["water"], style: CATEGORY_STYLE.water },
];

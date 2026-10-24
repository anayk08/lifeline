import type { Resource } from "../../shared/resources";

// A web app can't ask which maps app is the default, so it uses the link each system hands to it:
// Apple Maps links open the Maps app on iPhone and iPad, geo: links open the default maps app
// on Android (or let the person choose), and everywhere else gets Google Maps in the browser.
type Platform = "ios" | "android" | "other";

function platform(): Platform {
  const ua = navigator.userAgent;
  // iPadOS reports itself as a Mac, so a touch screen tells them apart.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "other";
}

/** Directions to a place in the device's maps app, starting from `origin` when known. */
export function mapsLink(r: Resource, origin: [number, number] | null, mode: "walk" | "drive" = "walk"): string {
  const to = `${r.lat},${r.lng}`;
  switch (platform()) {
    case "ios":
      return `https://maps.apple.com/?daddr=${to}&q=${encodeURIComponent(r.name)}${origin ? `&saddr=${origin[0]},${origin[1]}` : ""}&dirflg=${mode === "drive" ? "d" : "w"}`;
    case "android":
      return `geo:${to}?q=${to}(${encodeURIComponent(r.name)})`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${to}${origin ? `&origin=${origin[0]},${origin[1]}` : ""}&travelmode=${mode === "drive" ? "driving" : "walking"}`;
  }
}

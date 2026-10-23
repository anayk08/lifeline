import { useCallback, useRef, useState } from "react";
import type { Lang } from "../../shared/resources";
import { SPEECH_LANG } from "./i18n";

// Web Speech API types aren't in lib.dom for every TS version, so keep this loose.
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: { 0: { transcript: string } }[] }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
};

export function useSpeechInput(lang: Lang, onText: (text: string) => void) {
  const Ctor =
    typeof window !== "undefined"
      ? ((window as unknown as Record<string, unknown>).SpeechRecognition ??
          (window as unknown as Record<string, unknown>).webkitSpeechRecognition)
      : undefined;
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);

  const start = useCallback(() => {
    if (!Ctor) return;
    const r = new (Ctor as new () => Recognition)();
    r.lang = SPEECH_LANG[lang];
    r.interimResults = false;
    r.onresult = (e) => {
      const text = e.results[0]?.[0]?.transcript;
      if (text) onText(text);
    };
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }, [Ctor, lang, onText]);

  return { supported: Boolean(Ctor), listening, start };
}

export function speak(text: string, lang: Lang) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = SPEECH_LANG[lang];
  u.rate = 0.95;
  window.speechSynthesis.speak(u);
}

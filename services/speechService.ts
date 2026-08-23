
// Speech service — thin, guarded wrappers over the browser's Web Speech
// APIs (the p3tuh/jarvis & AlexandreSajus/JARVIS pattern: native
// SpeechRecognition for voice-to-text, speechSynthesis for the reply).
// Everything degrades: unsupported browsers simply get no mic/speaker
// controls, never an error.

import { toSpeakable } from '../domain/assistant/voice.engine';

// --- Speech recognition (voice -> text) --------------------------------------

type RecognitionCtor = new () => any;

const recognitionCtor = (): RecognitionCtor | null => {
  if (typeof window === 'undefined') return null;
  return (
    ((window as any).SpeechRecognition as RecognitionCtor) ||
    ((window as any).webkitSpeechRecognition as RecognitionCtor) ||
    null
  );
};

export const isVoiceInputSupported = (): boolean => recognitionCtor() !== null;

export interface ListenSession {
  stop: () => void;
}

/**
 * One tap-to-talk session: interim transcripts stream to `onInterim`, the
 * final utterance lands in `onFinal`, and `onEnd` always fires (including
 * on permission denial or silence). en-IN first — Indian tickers and fund
 * names transcribe far better against the Indian English model.
 */
export const startListening = (
  onInterim: (text: string) => void,
  onFinal: (text: string) => void,
  onEnd: () => void
): ListenSession | null => {
  const Ctor = recognitionCtor();
  if (!Ctor) return null;
  try {
    const recognition = new Ctor();
    recognition.lang = 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    let finalText = '';
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const chunk = event.results[i][0]?.transcript ?? '';
        if (event.results[i].isFinal) finalText += chunk;
        else interim += chunk;
      }
      onInterim(finalText + interim);
    };
    recognition.onerror = () => {
      /* fall through to onend — a denied mic just ends the session */
    };
    recognition.onend = () => {
      if (finalText.trim()) onFinal(finalText.trim());
      onEnd();
    };
    recognition.start();
    return { stop: () => { try { recognition.stop(); } catch { /* already stopped */ } } };
  } catch {
    onEnd();
    return null;
  }
};

// --- Speech synthesis (reply -> voice) ---------------------------------------

export const isVoiceOutputSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window;

const pickVoice = (): SpeechSynthesisVoice | null => {
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find(v => v.lang === 'en-IN') ??
    voices.find(v => v.lang.startsWith('en-')) ??
    voices[0] ??
    null
  );
};

/** Speak an assistant reply (rewritten for speech). Cancels anything queued. */
export const speak = (text: string): void => {
  if (!isVoiceOutputSupported()) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(toSpeakable(text));
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = 1.05;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  } catch {
    // synthesis unavailable mid-call — stay silent rather than throw
  }
};

export const stopSpeaking = (): void => {
  if (!isVoiceOutputSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
};

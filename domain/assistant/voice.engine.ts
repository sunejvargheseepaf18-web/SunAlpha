
// Voice output engine (pure domain logic).
//
// Financial text is written for eyes: ₹, %, ×, Δ, bullets, tickers. Read
// verbatim by a TTS engine it turns to mush ("bullet rupee sign one two
// three..."). toSpeakable() rewrites an assistant reply into something a
// speech synthesizer says naturally — the browser-Jarvis pattern
// (voice-to-text -> route -> text-to-speech) needs this last leg to not
// sound broken. Deterministic: same text in, same speech out.

const SYMBOL_SPEECH: Array<[RegExp, string]> = [
  [/₹\s?([\d,]+(?:\.\d+)?)/g, '$1 rupees'], // ₹1,23,456 -> "1,23,456 rupees"
  [/([\d.]+)\s?%/g, '$1 percent'],
  [/\bP&L\b/gi, 'profit and loss'],
  [/\bLTP\b/g, 'last traded price'],
  [/\bOI\b/g, 'open interest'],
  [/\bPCR\b/g, 'put call ratio'],
  [/\bNAV\b/g, 'N A V'],
  [/\bSIP\b/g, 'S I P'],
  [/×/g, ' times '],
  [/Δ/g, ' change '],
  [/→/g, ' to '],
  [/·/g, ', '],
  [/&/g, ' and ']
];

/**
 * Rewrite assistant text for speech synthesis:
 * - bullets and markdown noise removed, newlines become sentence pauses
 * - finance symbols spoken (₹ -> rupees after the amount, % -> percent…)
 * - truncated to `maxChars` at a sentence boundary where possible, so the
 *   voice never stops mid-number.
 */
export const toSpeakable = (text: string, maxChars = 400): string => {
  let out = text
    .replace(/^[\s]*[•\-*]\s*/gm, '') // list markers
    .replace(/[_*`#]/g, '') // markdown residue
    .replace(/\s*\n+\s*/g, '. ') // newlines -> pauses
    .replace(/[:;,]\s*\./g, '.') // "setups:." -> "setups."
    .replace(/\.\s*\./g, '.'); // collapse double stops

  for (const [pattern, replacement] of SYMBOL_SPEECH) {
    out = pattern.global ? out.replace(pattern, replacement) : out.replace(pattern, replacement);
  }
  out = out.replace(/\s{2,}/g, ' ').trim();

  if (out.length <= maxChars) return out;
  const slice = out.slice(0, maxChars);
  const lastStop = slice.lastIndexOf('. ');
  if (lastStop > maxChars * 0.4) return slice.slice(0, lastStop + 1).trim();
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim() + '.';
};

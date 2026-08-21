
// Context digestion for AI prompts.
//
// Every token a model reads of raw tool output is paid twice: once to fetch
// it, once to carry it for the rest of the session. So no raw payload ever
// enters a prompt — it goes through digest() with an explicit character
// budget first. Long arrays (price history, order books) are elided to their
// ends, and the result is hard-truncated at the budget.

const MAX_ARRAY_ITEMS = 8;

const compact = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    if (value.length > MAX_ARRAY_ITEMS) {
      return [
        ...value.slice(0, 3).map(compact),
        `…${value.length - 6} of ${value.length} items omitted…`,
        ...value.slice(-3).map(compact)
      ];
    }
    return value.map(compact);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, compact(v)])
    );
  }
  return value;
};

/** Bounded, prompt-safe string form of any context blob. */
export const digest = (value: unknown, maxChars = 1200): string => {
  let text: string;
  try {
    text = JSON.stringify(compact(value)) ?? String(value);
  } catch {
    text = String(value);
  }
  return text.length > maxChars
    ? `${text.slice(0, maxChars)}…[truncated ${text.length - maxChars} chars]`
    : text;
};

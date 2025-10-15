// Normalization utilities (must be identical across judge & overrides)
export const normalize = (s: string) =>
  String(s ?? "")
    .normalize("NFKC")
    .replace(/[ァ-ン]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)) // Katakana -> Hiragana
    .toLowerCase()
    .replace(/[！-／：-＠［-｀｛-～]/g, "") // full-width punctuation (rough)
    .replace(/[。、，．・\s]/g, "");        // jp punctuation & whitespaces

export const makeKey = (qid: string, answerRaw: string) =>
  `${String(qid)}::${normalize(answerRaw)}`;

// small guard to prevent ReDoS via huge regex-like strings in phrases
export const isSafePattern = (s: string) =>
  s.length <= 200 && (s.match(/[.*+?^${}()|[\]\\]/g)?.length ?? 0) / Math.max(1, s.length) < 0.3;

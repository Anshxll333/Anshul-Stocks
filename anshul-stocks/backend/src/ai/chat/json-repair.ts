/**
 * Repairs truncated stock/IPO decision JSON inside an AI response.
 *
 * The AI model is prompted to emit its decision card inside a ```json block, but
 * when the response hits the provider's `max_tokens` limit the JSON is cut off
 * mid-object (e.g. `"detailedInfoPrompt": "If you want detailed`), which makes
 * JSON.parse fail and the UI fall back to dumping raw JSON.
 *
 * These helpers extract the decision object, and if it is unbalanced (truncated),
 * best-effort repair it by dropping the incomplete trailing token and closing all
 * still-open braces/brackets so the frontend can render the decision card.
 */

function isDecisionContent(text: string): boolean {
  return (
    text.includes('"type"') &&
    (text.includes('"stock"') || text.includes('"ipo"'))
  );
}

/**
 * Returns the exact balanced JSON object that contains the first
 * `"type": "stock"` / `"type": "ipo"` marker, or null if it is truncated.
 */
export function extractBalancedDecisionJson(text: string): string | null {
  const marker = text.search(/"type"\s*:\s*"(?:stock|ipo)"/);
  if (marker === -1) return null;
  const start = text.lastIndexOf('{', marker);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null; // truncated / unbalanced
}

/**
 * Best-effort repair of a truncated JSON object: drop the incomplete trailing
 * token, remove dangling commas, then close every still-open brace/bracket.
 * Returns the repaired JSON string, or null when it cannot be salvaged.
 */
export function repairTruncatedJsonObject(partial: string): string | null {
  let work = partial;
  let stack: string[] = [];
  let inString = false;
  let escaped = false;
  let openStringStart = -1;

  for (let i = 0; i < work.length; i++) {
    const ch = work[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      openStringStart = i;
      continue;
    }
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // 1. Drop a trailing unclosed string (e.g. `"detail": "If you want deta...`)
  if (inString && openStringStart >= 0) {
    work = work.slice(0, openStringStart);
  }

  // 2. Drop a dangling key/value pair that lost its value (text ends with ':')
  let trimmed = work.trimEnd();
  if (trimmed.endsWith(':')) {
    const cut = Math.max(
      trimmed.lastIndexOf(','),
      trimmed.lastIndexOf('{'),
      trimmed.lastIndexOf('['),
    );
    if (cut >= 0) trimmed = trimmed.slice(0, cut);
    else return null;
  }
  work = trimmed.replace(/[,\s]+$/, '');

  // 3. Recompute the open-delimiter stack over the cleaned text
  stack = [];
  inString = false;
  escaped = false;
  for (let i = 0; i < work.length; i++) {
    const ch = work[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{' || ch === '[') stack.push(ch);
    else if (ch === '}' || ch === ']') stack.pop();
  }

  // 4. Close every still-open delimiter in reverse order
  for (let i = stack.length - 1; i >= 0; i--) {
    work += stack[i] === '{' ? '}' : ']';
  }

  try {
    const parsed = JSON.parse(work);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? work
      : null;
  } catch {
    return null;
  }
}

/**
 * Given a full AI response, returns a version where a truncated decision JSON
 * block has been repaired so the frontend can always render a card. Returns the
 * input unchanged when the response needs no repair (or cannot be repaired).
 */
export function repairDecisionJsonBlock(text: string): string {
  if (!isDecisionContent(text)) return text;

  // Already balanced & parseable → nothing to do.
  const balanced = extractBalancedDecisionJson(text);
  if (balanced) {
    try {
      JSON.parse(balanced);
      return text;
    } catch {
      /* fall through to repair */
    }
  }

  const start = text.lastIndexOf(
    '{',
    text.search(/"type"\s*:\s*"(?:stock|ipo)"/),
  );
  if (start === -1) return text;

  const repairedJson = repairTruncatedJsonObject(text.slice(start));
  if (!repairedJson) return text;

  // Rebuild: prose before the JSON + repaired JSON + close any dangling fence.
  const prefix = text.slice(0, start);
  const fenceCount = (prefix.match(/```/g) || []).length;
  const closeFence = fenceCount % 2 === 1 ? '\n```' : '';

  return `${prefix}${repairedJson}${closeFence}`;
}

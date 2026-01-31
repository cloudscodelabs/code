// ---------------------------------------------------------------------------
// Model name → full model ID map
// ---------------------------------------------------------------------------

const MODEL_MAP: Record<string, string> = {
  sonnet: 'claude-sonnet-4-20250514',
  opus: 'claude-opus-4-20250514',
  haiku: 'claude-haiku-4-20250514',
};

export function resolveModelId(shortName?: string): string {
  return MODEL_MAP[shortName ?? 'sonnet'] ?? MODEL_MAP.sonnet;
}

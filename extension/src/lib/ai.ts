const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_MODEL = "claude-opus-4-7";
const ANTHROPIC_MAX_TOKENS = 16000;

export interface StreamUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

export function buildHandoffText(prompt: string, markdown: string): string {
  return `${prompt}\n\n---\n\n${markdown}`;
}

export async function claudeAiHandoff(
  prompt: string,
  markdown: string
): Promise<void> {
  const text = buildHandoffText(prompt, markdown);
  await navigator.clipboard.writeText(text);
  await chrome.tabs.create({ url: "https://claude.ai/new" });
}

export async function notebookLmHandoff(
  filename: string,
  markdown: string
): Promise<void> {
  const blob = new Blob([markdown], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  await chrome.tabs.create({ url: "https://notebooklm.google.com/" });
}

export async function streamFromAnthropic(
  apiKey: string,
  prompt: string,
  markdown: string,
  cb: StreamCallbacks
): Promise<StreamUsage> {
  const resp = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: ANTHROPIC_MAX_TOKENS,
      stream: true,
      thinking: { type: "adaptive" },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Here is an article I clipped. I'll ask a question about it below.\n\n${markdown}`,
              cache_control: { type: "ephemeral" },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
    signal: cb.signal,
  });

  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Anthropic API ${resp.status}: ${body || resp.statusText}`);
  }
  if (!resp.body) throw new Error("Anthropic API returned no response body");

  const usage: StreamUsage = {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
  };

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let evt: SSEEvent;
      try {
        evt = JSON.parse(payload) as SSEEvent;
      } catch {
        continue;
      }
      handleEvent(evt, cb.onDelta, usage);
    }
  }

  return usage;
}

interface SSEEvent {
  type: string;
  delta?: { type: string; text?: string };
  message?: { usage?: Partial<StreamUsage> };
  usage?: Partial<StreamUsage>;
}

function handleEvent(
  evt: SSEEvent,
  onDelta: (s: string) => void,
  usage: StreamUsage
): void {
  if (
    evt.type === "content_block_delta" &&
    evt.delta?.type === "text_delta" &&
    typeof evt.delta.text === "string"
  ) {
    onDelta(evt.delta.text);
    return;
  }
  if (evt.type === "message_start" && evt.message?.usage) {
    mergeUsage(usage, evt.message.usage);
    return;
  }
  if (evt.type === "message_delta" && evt.usage) {
    mergeUsage(usage, evt.usage);
  }
}

function mergeUsage(dst: StreamUsage, src: Partial<StreamUsage>): void {
  if (typeof src.input_tokens === "number") dst.input_tokens = src.input_tokens;
  if (typeof src.output_tokens === "number")
    dst.output_tokens = src.output_tokens;
  if (typeof src.cache_read_input_tokens === "number")
    dst.cache_read_input_tokens = src.cache_read_input_tokens;
  if (typeof src.cache_creation_input_tokens === "number")
    dst.cache_creation_input_tokens = src.cache_creation_input_tokens;
}

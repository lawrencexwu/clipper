import type { PromptKey } from "@shared/prompts.js";
import { DEFAULTS } from "@shared/prompts.js";

const API_KEY_KEY = "ai.apiKey";
const PROMPT_OVERRIDE_PREFIX = "ai.prompt.";
const ARCHIVE_FALLBACK_KEY = "archiveFallback";

export async function getApiKey(): Promise<string | undefined> {
  const r = await chrome.storage.local.get(API_KEY_KEY);
  const v = r[API_KEY_KEY];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function setApiKey(key: string): Promise<void> {
  if (key) {
    await chrome.storage.local.set({ [API_KEY_KEY]: key });
  } else {
    await chrome.storage.local.remove(API_KEY_KEY);
  }
}

export async function getArchiveFallback(): Promise<boolean> {
  const r = await chrome.storage.local.get(ARCHIVE_FALLBACK_KEY);
  return r[ARCHIVE_FALLBACK_KEY] === true;
}

export async function setArchiveFallback(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [ARCHIVE_FALLBACK_KEY]: enabled });
}

export async function getPromptOverride(
  key: PromptKey
): Promise<string | undefined> {
  const storageKey = PROMPT_OVERRIDE_PREFIX + key;
  const r = await chrome.storage.local.get(storageKey);
  const v = r[storageKey];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

export async function setPromptOverride(
  key: PromptKey,
  value: string
): Promise<void> {
  const storageKey = PROMPT_OVERRIDE_PREFIX + key;
  if (value && value !== DEFAULTS[key]) {
    await chrome.storage.local.set({ [storageKey]: value });
  } else {
    await chrome.storage.local.remove(storageKey);
  }
}

export async function resolvePrompt(key: PromptKey): Promise<string> {
  const override = await getPromptOverride(key);
  return override ?? DEFAULTS[key];
}

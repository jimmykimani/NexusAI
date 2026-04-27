/** Presets for the in-chat model selector (must stay in sync with backend keys). */

export type ChatLlmProvider = 'openai' | 'groq' | 'openrouter' | 'anthropic' | 'deepseek'

export interface ChatModelProfile {
  id: string
  pill: string
  description: string
  provider: ChatLlmProvider
  reasoningModel: string
  fastModel: string
}

export const CHAT_MODEL_PROFILES: ChatModelProfile[] = [
  {
    id: 'openai-gpt4o',
    pill: 'GPT-4o',
    description: 'OpenAI · default quality',
    provider: 'openai',
    reasoningModel: 'gpt-4o',
    fastModel: 'gpt-4o-mini',
  },
  {
    id: 'openai-mini',
    pill: 'GPT-4o mini',
    description: 'OpenAI · fastest / lowest cost',
    provider: 'openai',
    reasoningModel: 'gpt-4o-mini',
    fastModel: 'gpt-4o-mini',
  },
  {
    id: 'groq-llama-70b',
    pill: 'Llama 3.3 70B',
    description: 'Groq · strong + fast',
    provider: 'groq',
    reasoningModel: 'llama-3.3-70b-versatile',
    fastModel: 'llama-3.1-8b-instant',
  },
  {
    id: 'groq-llama-8b',
    pill: 'Llama 3.1 8B',
    description: 'Groq · lightest quota use',
    provider: 'groq',
    reasoningModel: 'llama-3.1-8b-instant',
    fastModel: 'llama-3.1-8b-instant',
  },
  {
    id: 'openrouter-gemini-flash',
    pill: 'Gemini 2.0 Flash',
    description: 'OpenRouter · needs credits',
    provider: 'openrouter',
    reasoningModel: 'google/gemini-2.0-flash-001',
    fastModel: 'google/gemini-2.0-flash-001',
  },

  {
    id: 'openrouter-qwen',
    pill: 'Qwen 2.5 72B',
    description: 'OpenRouter · high speed + context',
    provider: 'openrouter',
    reasoningModel: 'qwen/qwen-2.5-72b-instruct',
    fastModel: 'qwen/qwen-2.5-72b-instruct',
  },
  {
    id: 'openrouter-llama-3-free',
    pill: 'Llama 3 (Free)',
    description: 'OpenRouter · free pool escape valve',
    provider: 'openrouter',
    reasoningModel: 'meta-llama/llama-3-70b-instruct:free',
    fastModel: 'meta-llama/llama-3-8b-instruct:free',
  },
]

export const CHAT_MODEL_STORAGE_KEY = 'nexusai.chatModelId'

export function readStoredChatModelId(): string | null {
  try {
    return localStorage.getItem(CHAT_MODEL_STORAGE_KEY)
  } catch {
    return null
  }
}

export function writeStoredChatModelId(id: string) {
  try {
    localStorage.setItem(CHAT_MODEL_STORAGE_KEY, id)
  } catch {
    /* ignore */
  }
}

export function initialChatModelId(): string {
  const stored = readStoredChatModelId()
  if (stored && CHAT_MODEL_PROFILES.some((p) => p.id === stored)) return stored
  return CHAT_MODEL_PROFILES[0].id
}

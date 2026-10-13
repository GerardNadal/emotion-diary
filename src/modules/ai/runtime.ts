import "server-only";
import { createOpenAIProvider } from "./openai-provider";

export function configuredAIProvider() {
  return process.env.OPENAI_API_KEY ? createOpenAIProvider({
    apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL,
    metric: metric => console.info(JSON.stringify(metric)),
  }) : null;
}

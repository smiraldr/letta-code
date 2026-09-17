import type { Provider } from "@earendil-works/pi-ai";
import {
  createLocalEndpointPiProvider,
  type LocalEndpointDiscover,
  modelIdsFromOpenAICompatibleList,
} from "./pi-local-endpoint-provider";

export const IONET_PI_PROVIDER_ID = "ionet";

export interface IonetPiProviderOptions {
  baseURL: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  discoveryTimeoutMs?: number;
}

const ionetDiscover: LocalEndpointDiscover = async (context) => {
  const list = await context.fetchJson(`${context.openAIBaseURL}/models`);
  return modelIdsFromOpenAICompatibleList(list).map(
    (modelId) =>
      context.lastKnown.get(modelId) ?? context.buildModel({ id: modelId }),
  );
};

/**
 * Dynamic provider for the IO Intelligence (io.net) API, an
 * OpenAI-compatible Chat Completions endpoint. The endpoint's
 * `GET /models` response owns model identity; ids are Hugging Face-style
 * `org/name` strings, so model ids (and the handles derived from them)
 * contain a slash. Capabilities stay conservative because the OpenAI
 * model-list schema does not report them.
 */
export function createIonetPiProvider(
  options: IonetPiProviderOptions,
): Provider<"openai-completions"> {
  return createLocalEndpointPiProvider({
    id: IONET_PI_PROVIDER_ID,
    name: "IO Intelligence",
    baseURL: options.baseURL,
    ...(options.apiKey ? { apiKey: options.apiKey } : {}),
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    ...(options.discoveryTimeoutMs
      ? { discoveryTimeoutMs: options.discoveryTimeoutMs }
      : {}),
    discover: ionetDiscover,
  });
}

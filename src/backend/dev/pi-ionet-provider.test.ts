import { describe, expect, test } from "bun:test";
import { testRefreshContext } from "@/test-utils/pi-refresh-context";
import {
  createIonetPiProvider,
  IONET_PI_PROVIDER_ID,
} from "./pi-ionet-provider";

interface FakeIonetState {
  modelIds?: string[];
  requests: Array<{ url: string; authorization?: string }>;
}

function fakeIonetFetch(state: FakeIonetState): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    state.requests.push({
      url,
      authorization:
        typeof init?.headers === "object" && init.headers !== null
          ? (init.headers as Record<string, string>).Authorization
          : undefined,
    });
    if (url.endsWith("/models")) {
      return Response.json({
        object: "list",
        data: (state.modelIds ?? []).map((id) => ({ id, object: "model" })),
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
}

const IONET_BASE_URL = "https://api.intelligence.io.solutions/api/v1";

describe("createIonetPiProvider", () => {
  test("discovers Hugging Face-style model ids and keeps the /api/v1 base URL", async () => {
    const state: FakeIonetState = {
      modelIds: [
        "meta-llama/Llama-3.3-70B-Instruct",
        "deepseek-ai/DeepSeek-R1-0528",
      ],
      requests: [],
    };
    const provider = createIonetPiProvider({
      baseURL: IONET_BASE_URL,
      apiKey: "test-key",
      fetchImpl: fakeIonetFetch(state),
    });

    const refreshContext = testRefreshContext();
    await provider.refreshModels?.(refreshContext);

    const models = provider.getModels();
    expect(models).toHaveLength(2);
    expect(models[0]?.id).toBe("meta-llama/Llama-3.3-70B-Instruct");
    expect(models[0]?.provider).toBe(IONET_PI_PROVIDER_ID);
    // The OpenAI-compatible surface must keep the documented /api/v1 root
    // exactly (no duplicate /v1, no stripped path).
    expect(models[0]?.baseUrl).toBe(IONET_BASE_URL);
    // The OpenAI model-list schema reports no capabilities.
    expect(models[0]?.input).toEqual(["text"]);
    // io.net does not document the OpenAI `store` field.
    expect(models[0]?.compat?.supportsStore).toBe(false);
  });

  test("authenticates model discovery with the Bearer API key", async () => {
    const state: FakeIonetState = { modelIds: [], requests: [] };
    const provider = createIonetPiProvider({
      baseURL: IONET_BASE_URL,
      apiKey: "test-key",
      fetchImpl: fakeIonetFetch(state),
    });

    await provider.refreshModels?.(testRefreshContext());

    expect(state.requests).toHaveLength(1);
    expect(state.requests[0]?.url).toBe(`${IONET_BASE_URL}/models`);
    expect(state.requests[0]?.authorization).toBe("Bearer test-key");
  });
});

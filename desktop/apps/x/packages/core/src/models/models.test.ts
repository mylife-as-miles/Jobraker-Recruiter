import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateRecruiterLlmText } from "./models.js";

// Mock container/repo
const mockGetConfig = vi.fn();
vi.mock("../di/container.js", () => {
  return {
    default: {
      resolve: vi.fn(() => ({
        getConfig: mockGetConfig,
      })),
    },
  };
});

// Mock @google/adk
const mockGeminiConstructor = vi.fn();
const mockLlmAgentConstructor = vi.fn();
const mockInMemoryRunnerConstructor = vi.fn();
const mockRunEphemeral = vi.fn();

vi.mock("@google/adk", () => {
  class Gemini {
    constructor(params: unknown) {
      mockGeminiConstructor(params);
    }
  }
  class LlmAgent {
    constructor(params: unknown) {
      mockLlmAgentConstructor(params);
    }
  }
  class InMemoryRunner {
    constructor(params: unknown) {
      mockInMemoryRunnerConstructor(params);
    }
    runEphemeral(params: unknown) {
      return mockRunEphemeral(params);
    }
  }
  return {
    Gemini,
    LlmAgent,
    InMemoryRunner,
    stringifyContent: (event: Record<string, unknown>) => event.text,
  };
});

describe("models", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generateRecruiterLlmText transitions properly to LlmAgent / Gemini runtime", async () => {
    mockGetConfig.mockResolvedValue({
      provider: {
        flavor: "google",
        apiKey: "test-api-key",
      },
      model: "gemini-2.5-flash",
    });

    mockRunEphemeral.mockImplementation(async function* () {
      yield { text: "Hello " };
      yield { text: "world!" };
    });

    const result = await generateRecruiterLlmText("System instruction", "User prompt", 0.7);

    expect(mockGetConfig).toHaveBeenCalled();
    expect(mockGeminiConstructor).toHaveBeenCalledWith({
      apiKey: "test-api-key",
      model: "gemini-2.5-flash",
    });
    expect(mockLlmAgentConstructor).toHaveBeenCalledWith({
      name: "RecruiterCompanion",
      model: expect.any(Object),
      instruction: "System instruction",
      generateContentConfig: {
        temperature: 0.7,
      },
    });
    expect(mockInMemoryRunnerConstructor).toHaveBeenCalledWith({
      agent: expect.any(Object),
      appName: "JobrakerRecruiter",
    });
    expect(mockRunEphemeral).toHaveBeenCalledWith({
      userId: "recruiter-default-user",
      newMessage: { parts: [{ text: "User prompt" }] },
    });
    expect(result).toBe("Hello world!");
  });

  it("throws error if an event contains errorMessage", async () => {
    mockGetConfig.mockResolvedValue({
      provider: {
        flavor: "google",
        apiKey: "test-api-key",
      },
      model: "gemini-2.5-flash",
    });

    mockRunEphemeral.mockImplementation(async function* () {
      yield { errorMessage: "Something went wrong" };
    });

    await expect(
      generateRecruiterLlmText("System instruction", "User prompt", 0.7)
    ).rejects.toThrow("Something went wrong");
  });
});

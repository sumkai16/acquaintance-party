import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { tallyThemes, type AiSummary } from "./theme-tally";

/**
 * An AI reading of one written question's answers: a short summary, the
 * overall mood, and the answers sorted into themes.
 *
 * The model sorts; this file counts. Models are unreliable at tallying, so it
 * returns which numbered answers belong to each theme and the counts come from
 * those lists (see theme-tally.ts) — every percentage the admin sees is exact.
 *
 * The answers are anonymous (the evaluation never stores names) but they are
 * free text, so the prompt tells the model not to repeat any name it finds.
 *
 * Two providers, chosen by which key is set: OPENROUTER_API_KEY (free models
 * work, so no billing is needed) wins over ANTHROPIC_API_KEY (Claude, which
 * needs credit on the account). Both return the same shape, so the counting
 * and the page don't care which one ran.
 */
const ANTHROPIC_MODEL = "claude-opus-5-5";

/**
 * Tried in order: the next is used when one is rate-limited, down or answers
 * badly, which free models often do. Override the first with OPENROUTER_MODEL.
 * Free model names change; if all of these vanish the button says it failed.
 */
const OPENROUTER_MODELS = [
  "nvidia/nemotron-3-super-120b-a12b:free",
  "qwen/qwen3.8-27b:free",
  "openrouter/free",
];

const Reading = z.object({
  summary: z.string(),
  mood: z.enum(["positive", "mixed", "negative", "neutral"]),
  themes: z.array(
    z.object({
      label: z.string(),
      answer_numbers: z.array(z.number()),
    }),
  ),
});

/** The same shape as plain JSON schema, for providers that take one. */
const READING_JSON_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    mood: { type: "string", enum: ["positive", "mixed", "negative", "neutral"] },
    themes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string" },
          answer_numbers: { type: "array", items: { type: "number" } },
        },
        required: ["label", "answer_numbers"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "mood", "themes"],
  additionalProperties: false,
};

export type AiSummaryResult =
  | { ok: true; summary: AiSummary }
  | { ok: false; error: string };

type Reply =
  | { ok: true; reading: z.infer<typeof Reading>; model: string }
  | { ok: false; error: string };

const SYSTEM = `You read anonymous written answers from a post-event survey for an IT students' society party at a Philippine university.

Answers are in English, Filipino (Tagalog) or a mix, often with typos and slang. "Wala", "none", "n/a" and "no comment" all mean the student had nothing to say.

Do three things:
1. Sort every answer into exactly one theme. Use 3 to 7 short theme labels (2 to 4 words each). Put empty or "nothing to say" answers in one theme called "No answer". Use "Other" sparingly, only for answers that fit no other theme; prefer a specific theme even for a single answer. List each answer's number under its theme, and make sure every number appears exactly once.
2. Write a summary of 2 or 3 plain sentences for the organisers: what most students said and any suggestion worth acting on. Say who said it the most, for example "Most students named the battle of the bands".
3. Give the overall mood of the answers that say something: positive, mixed, negative or neutral.

Never repeat a person's name that appears in an answer. Do not invent anything that is not in the answers.`;

export async function summarizeWrittenAnswers(
  prompt: string,
  answers: string[],
): Promise<AiSummaryResult> {
  if (answers.length === 0) {
    return { ok: false, error: "Nobody answered this question yet." };
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!openRouterKey && !anthropicKey) {
    return {
      ok: false,
      error:
        "The AI summary isn't set up yet: add OPENROUTER_API_KEY (free) or ANTHROPIC_API_KEY.",
    };
  }

  const numbered = answers.map((answer, index) => `${index + 1}. ${answer}`);
  const content = `Question: ${prompt}\n\nAnswers (${answers.length}):\n${numbered.join("\n")}`;

  const reply = openRouterKey
    ? await askOpenRouter(openRouterKey, content)
    : await askAnthropic(anthropicKey as string, content);
  if (!reply.ok) return reply;

  return { ok: true, summary: tallyThemes(reply.reading, answers.length, reply.model) };
}

/** Total time the free models get before the button gives up. */
const OPENROUTER_BUDGET_MS = 55_000;

async function askOpenRouter(apiKey: string, content: string): Promise<Reply> {
  const first = process.env.OPENROUTER_MODEL?.trim();
  const models = first ? [first, ...OPENROUTER_MODELS] : OPENROUTER_MODELS;
  const deadline = Date.now() + OPENROUTER_BUDGET_MS;

  // One model at a time, not OpenRouter's own fallback list: free models are
  // often rate-limited, down, or answer with something that isn't the JSON we
  // asked for, and a model that fails should hand over to the next.
  for (const model of models) {
    const left = deadline - Date.now();
    if (left < 6_000) break;

    const attempt = await tryOpenRouterModel(apiKey, model, content, left);
    if (attempt.kind === "done") return attempt.reply;
    if (attempt.kind === "stop") return { ok: false, error: attempt.error };
    // "next": try the following model.
  }

  return {
    ok: false,
    error: "The free AI models are busy right now. Try again in a minute.",
  };
}

type Attempt =
  | { kind: "done"; reply: Reply }
  | { kind: "stop"; error: string }
  | { kind: "next" };

async function tryOpenRouterModel(
  apiKey: string,
  model: string,
  content: string,
  timeoutMs: number,
): Promise<Attempt> {
  const request = (reasoningOff: boolean) =>
    fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        // Thinking models can spend a minute reasoning over a hundred answers,
        // and sorting short comments doesn't need it. Some models refuse to
        // have it switched off; those are retried below without the flag.
        ...(reasoningOff ? { reasoning: { enabled: false } } : {}),
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "reading", strict: true, schema: READING_JSON_SCHEMA },
        },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

  try {
    let response = await request(true);
    if (response.status === 400) response = await request(false);

    if (response.status === 401 || response.status === 403) {
      return { kind: "stop", error: "The OpenRouter key was rejected. Check OPENROUTER_API_KEY." };
    }
    if (response.status === 402) {
      return { kind: "stop", error: "OpenRouter says the account is out of credit." };
    }
    if (!response.ok) {
      console.error("OpenRouter", model, response.status);
      return { kind: "next" };
    }

    const body = (await response.json()) as {
      model?: string;
      choices?: { message?: { content?: string | null } }[];
    };
    // `body.model` is the model that actually answered, which for the router
    // model (openrouter/free) is not the one we asked for.
    const reply = parseReading(
      body.choices?.[0]?.message?.content,
      body.model ?? model,
    );
    return reply.ok ? { kind: "done", reply } : { kind: "next" };
  } catch (error) {
    console.error("OpenRouter", model, error);
    return { kind: "next" };
  }
}

async function askAnthropic(apiKey: string, content: string): Promise<Reply> {
  try {
    const response = await new Anthropic({ apiKey }).messages.parse({
      model: ANTHROPIC_MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      messages: [{ role: "user", content }],
      output_config: { format: zodOutputFormat(Reading) },
    });

    if (response.stop_reason === "refusal") {
      return { ok: false, error: "The AI declined to read these answers." };
    }
    if (!response.parsed_output) {
      return { ok: false, error: "The AI's reply could not be read. Try again." };
    }
    return { ok: true, reading: response.parsed_output, model: response.model };
  } catch (error) {
    console.error("askAnthropic failed", error);
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "The Anthropic key was rejected. Check ANTHROPIC_API_KEY." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Too many requests right now. Wait a minute and try again." };
    }
    if (error instanceof Anthropic.APIError && error.status === 400) {
      return {
        ok: false,
        error: "Anthropic rejected the request. Check the account has credit.",
      };
    }
    return { ok: false, error: "The AI summary failed. Try again in a moment." };
  }
}

/** The model's reply text as a checked Reading, or a plain error. */
function parseReading(text: string | null | undefined, model: string): Reply {
  try {
    const parsed = Reading.safeParse(JSON.parse(text ?? ""));
    if (parsed.success) return { ok: true, reading: parsed.data, model };
  } catch {
    // Not JSON: fall through to the same message.
  }
  console.error("AI reply was not a valid reading", (text ?? "").length, (text ?? "").slice(0, 400));
  return { ok: false, error: "The AI's reply could not be read. Try again." };
}

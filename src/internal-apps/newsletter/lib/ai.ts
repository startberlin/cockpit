import "server-only";

import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { env } from "@/env";

/**
 * Optional writing help for the composer.
 *
 * Three deliberate constraints:
 *
 *  - **Scope.** It only ever sees the text of the issue being edited. Member
 *    and applicant data is never passed in — the kickoff was explicit that no
 *    applicant database should be reachable from an AI system, and the simplest
 *    way to honour that is for this module to have no access to one.
 *  - **Optional.** Without a key the feature reports itself unavailable and
 *    every other part of the app works unchanged.
 *  - **Suggestions only.** Nothing here writes to an issue; the editor decides
 *    what to accept.
 *
 * Uses the Responses API rather than Chat Completions, with `responses.parse`
 * so the shape is enforced by the same Zod schemas the rest of the app uses
 * instead of by parsing prose.
 */

export class AiNotConfiguredError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not set, so writing help is turned off.");
    this.name = "AiNotConfiguredError";
  }
}

let client: OpenAI | null = null;

export function isAiConfigured(): boolean {
  return !!env.OPENAI_API_KEY;
}

function openai(): OpenAI {
  if (!env.OPENAI_API_KEY) throw new AiNotConfiguredError();
  if (!client) client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  return client;
}

/** Keeps a long issue inside a sensible request size. */
const MAX_CONTEXT_CHARS = 6000;

const HOUSE_STYLE = [
  "You write for START Berlin, a student-run startup association in Berlin.",
  "The newsletter is editorial, not promotional: concrete over enthusiastic.",
  "British English. No exclamation marks. No emoji.",
  "Never invent facts, names, numbers or links that are not in the material.",
].join(" ");

const subjectSuggestionsSchema = z.object({
  subjects: z
    .array(
      z.object({
        text: z.string(),
        rationale: z.string(),
      }),
    )
    .length(5),
});

export interface SubjectSuggestion {
  text: string;
  rationale: string;
}

export async function suggestSubjectLines(
  issueText: string,
): Promise<SubjectSuggestion[]> {
  const response = await openai().responses.parse({
    model: env.OPENAI_MODEL,
    instructions: [
      HOUSE_STYLE,
      "Propose five subject lines for this issue.",
      "Each under 60 characters so it is not truncated in an inbox.",
      "Vary the angle: one plain and descriptive, one built on the single most",
      "surprising detail, one naming a person or company, one question-shaped,",
      "one very short. Give a one-line rationale for each.",
    ].join(" "),
    input: issueText.slice(0, MAX_CONTEXT_CHARS),
    text: { format: zodTextFormat(subjectSuggestionsSchema, "subjects") },
  });

  return response.output_parsed?.subjects ?? [];
}

const previewTextSchema = z.object({
  options: z.array(z.string()).length(3),
});

export async function suggestPreviewText(
  issueText: string,
  subject: string,
): Promise<string[]> {
  const response = await openai().responses.parse({
    model: env.OPENAI_MODEL,
    instructions: [
      HOUSE_STYLE,
      "Write three preview lines, the text an inbox shows next to the subject.",
      "Around 90 characters each. It must add something the subject does not",
      "already say; never restate the subject.",
      `The subject is: "${subject}".`,
    ].join(" "),
    input: issueText.slice(0, MAX_CONTEXT_CHARS),
    text: { format: zodTextFormat(previewTextSchema, "preview_text") },
  });

  return response.output_parsed?.options ?? [];
}

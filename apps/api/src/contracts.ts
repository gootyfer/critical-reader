import { z } from "zod";

export const MAX_PARAGRAPHS = 200;
export const MAX_TOTAL_CHARACTERS = 100_000;

export const ParagraphSchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().trim().min(1).max(20_000),
});

export const AnalyzeRequestSchema = z
  .object({
    title: z.string().max(2_000),
    subtitle: z.string().max(4_000),
    language: z.literal("es"),
    paragraphs: z.array(ParagraphSchema).min(1).max(MAX_PARAGRAPHS),
  })
  .superRefine((input, context) => {
    const totalCharacters =
      input.title.length +
      input.subtitle.length +
      input.paragraphs.reduce((total, paragraph) => total + paragraph.text.length, 0);

    if (totalCharacters > MAX_TOTAL_CHARACTERS) {
      context.addIssue({
        code: "custom",
        message: `El artículo supera el límite de ${MAX_TOTAL_CHARACTERS} caracteres`,
        path: ["paragraphs"],
      });
    }

    const paragraphIds = new Set(input.paragraphs.map(({ id }) => id));
    if (paragraphIds.size !== input.paragraphs.length) {
      context.addIssue({
        code: "custom",
        message: "Los identificadores de párrafo deben ser únicos",
        path: ["paragraphs"],
      });
    }
  });

export const FindingCategorySchema = z.enum([
  "sexism",
  "racism_xenophobia",
  "homophobia_transphobia",
]);

export const FindingMechanismSchema = z.enum([
  "slur",
  "stereotype",
  "generalization",
  "objectification",
  "paternalism",
  "victim_blaming",
  "dehumanization",
  "exclusion",
  "other_discriminatory_framing",
]);

export const FindingSchema = z.object({
  paragraphId: z.string().min(1).max(100),
  category: FindingCategorySchema,
  mechanism: FindingMechanismSchema,
  explanation: z.string().trim().min(1).max(500),
});

export const AnalyzeResponseSchema = z
  .object({
    findings: z.array(FindingSchema).max(MAX_PARAGRAPHS),
  })
  .superRefine((response, context) => {
    const paragraphIds = new Set(
      response.findings.map(({ paragraphId }) => paragraphId),
    );

    if (paragraphIds.size !== response.findings.length) {
      context.addIssue({
        code: "custom",
        message: "Solo puede existir un hallazgo por párrafo",
        path: ["findings"],
      });
    }
  });

export type Paragraph = z.infer<typeof ParagraphSchema>;
export type AnalyzeRequest = z.infer<typeof AnalyzeRequestSchema>;
export type Finding = z.infer<typeof FindingSchema>;
export type AnalyzeResponse = z.infer<typeof AnalyzeResponseSchema>;

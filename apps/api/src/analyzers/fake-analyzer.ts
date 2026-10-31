import {
  AnalyzeResponseSchema,
  type AnalyzeRequest,
  type Finding,
} from "@critical-reader/contracts";

import type { ArticleAnalyzer } from "./article-analyzer.js";

const quotedSpeechPattern = /[«“”"]|\b(afirmó|declaró|dijo|citó|según)\b/iu;

const rules: ReadonlyArray<{
  pattern: RegExp;
  finding: Omit<Finding, "paragraphId">;
}> = [
  {
    pattern: /las mujeres no deberían ocupar puestos técnicos/iu,
    finding: {
      category: "sexism",
      mechanism: "stereotype",
      explanation:
        "El párrafo atribuye una falta de capacidad técnica a las mujeres como grupo.",
    },
  },
  {
    pattern: /las personas inmigrantes son inferiores/iu,
    finding: {
      category: "racism_xenophobia",
      mechanism: "dehumanization",
      explanation:
        "El párrafo presenta a las personas inmigrantes como un grupo humano inferior.",
    },
  },
  {
    pattern: /las parejas homosexuales no deberían tener los mismos derechos/iu,
    finding: {
      category: "homophobia_transphobia",
      mechanism: "exclusion",
      explanation:
        "El párrafo propone negar derechos a las parejas homosexuales.",
    },
  },
];

export class FakeArticleAnalyzer implements ArticleAnalyzer {
  async analyze(input: AnalyzeRequest) {
    const findings = input.paragraphs.flatMap((paragraph) => {
      if (quotedSpeechPattern.test(paragraph.text)) {
        return [];
      }

      const matchedRule = rules.find(({ pattern }) => pattern.test(paragraph.text));
      if (!matchedRule) {
        return [];
      }

      return [{ paragraphId: paragraph.id, ...matchedRule.finding }];
    });

    return AnalyzeResponseSchema.parse({ findings });
  }
}

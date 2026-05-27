import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const JORDAN_LAWS_VECTOR_STORE_ID =
  process.env.OPENAI_VECTOR_STORE_JORDAN_LAWS || '';

type IntakeType = 'judgmentAppeal' | 'contractsBusiness' | string;

type JudgmentIntakeData = {
  judgmentType?: string;
  judgmentDate?: string;
  notificationDate?: string;
  courtName?: string;
  caseNumber?: string;
  partyRole?: string;
  notes?: string;
  [key: string]: unknown;
};

type ContractIntakeData = {
  contractType?: string;
  contractDate?: string;
  parties?: string;
  issue?: string;
  amount?: string;
  notes?: string;
  [key: string]: unknown;
};

type ChatRequestBody = {
  message?: string;
  question?: string;
  prompt?: string;
  userMessage?: string;

  country?: string | null;
  language?: string | null;
  caseType?: unknown;

  intakeType?: IntakeType | null;
  judgmentIntakeData?: JudgmentIntakeData | null;
  contractIntakeData?: ContractIntakeData | null;

  // Backward compatibility with the first flow
  intakeData?: JudgmentIntakeData | ContractIntakeData | null;
};

type SourceConfidence = 'high' | 'medium' | 'low';

type LegalAiOutput = {
  answer: string;
  suggestions: string[];
  lawyerSummary: string;
  sourceNote: string;
  sourceConfidence: SourceConfidence;
  sourceTitle: string;
  sourceArticles: string[];
  primaryArticles: string[];
  relatedArticles: string[];
};

const LEGAL_AI_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: {
      type: 'string',
      description: 'The full legal guidance answer in Arabic Markdown.',
    },
    suggestions: {
      type: 'array',
      description: 'Suggested follow-up questions in Arabic.',
      items: {
        type: 'string',
      },
    },
    lawyerSummary: {
      type: 'string',
      description: 'A concise professional summary for a lawyer in Arabic.',
    },
    sourceNote: {
      type: 'string',
      description:
        'Arabic note explaining whether the answer was based on retrieved legal sources or general legal reasoning.',
    },
    sourceConfidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description:
        'Confidence level of the legal source support: high when directly supported by retrieved legal text, medium when partially supported, low when no clear source was found.',
    },
    sourceTitle: {
      type: 'string',
      description:
        'Arabic title of the legal source used, such as the name of the law. Empty string if no clear source was used.',
    },
    sourceArticles: {
      type: 'array',
      description:
        'List of all legal article numbers used or clearly mentioned in the retrieved legal source. Empty array if no clear article was used.',
      items: {
        type: 'string',
      },
    },
    primaryArticles: {
      type: 'array',
      description:
        'Main legal article numbers that directly answer the user question. Empty array if no clear primary article was used.',
      items: {
        type: 'string',
      },
    },
    relatedArticles: {
      type: 'array',
      description:
        'Related or supporting legal article numbers mentioned or used in the answer. Empty array if no related articles were used.',
      items: {
        type: 'string',
      },
    },
  },
  required: [
    'answer',
    'suggestions',
    'lawyerSummary',
    'sourceNote',
    'sourceConfidence',
    'sourceTitle',
    'sourceArticles',
    'primaryArticles',
    'relatedArticles',
  ],
};

function normalizeCountry(country?: string | null): string {
  return (country || '').trim();
}

function isJordan(country?: string | null): boolean {
  const normalized = normalizeCountry(country);
  return (
    normalized === 'الأردن' ||
    normalized === 'الاردن' ||
    normalized.toLowerCase() === 'jordan'
  );
}

function getUserQuestion(body: ChatRequestBody): string {
  return (
    body.message ||
    body.question ||
    body.prompt ||
    body.userMessage ||
    ''
  ).trim();
}

function getRelevantIntakeData(body: ChatRequestBody) {
  if (body.intakeType === 'contractsBusiness') {
    return body.contractIntakeData || body.intakeData || null;
  }

  if (body.intakeType === 'judgmentAppeal') {
    return body.judgmentIntakeData || body.intakeData || null;
  }

  return (
    body.judgmentIntakeData ||
    body.contractIntakeData ||
    body.intakeData ||
    null
  );
}

function buildSystemPrompt(params: {
  country?: string | null;
  intakeType?: IntakeType | null;
  useJordanRag: boolean;
}) {
  const { country, intakeType, useJordanRag } = params;

  return `
You are Hukumx, a professional AI legal assistant for users in the Arab world.

Your job:
- Answer legal questions clearly in Arabic.
- Help ordinary users understand legal issues.
- Help lawyers quickly understand the legal situation through lawyerSummary.
- Be careful, conservative, and transparent.
- Do not pretend to be a licensed lawyer.
- Do not provide a final legal opinion as a substitute for a qualified lawyer.
- If the facts are incomplete, clearly say what information is missing.
- Do not invent laws, article numbers, deadlines, procedures, or court rules.
- If you are not sure, say that lawyer review is required.

Current context:
- Country: ${country || 'غير محدد'}
- Intake type: ${intakeType || 'غير محدد'}
- Jordan legal RAG enabled: ${useJordanRag ? 'yes' : 'no'}

Legal source rules:
- If retrieved legal text is available and directly supports the answer, use it.
- If the retrieved source is not enough, clearly say that the answer is only partially supported.
- If no legal source supports the answer, do not claim that the answer is source-based.
- Do not invent article numbers.
- Do not cite an article unless it appeared clearly in the retrieved legal content.
- For Jordan questions, prioritize the retrieved Jordanian legal source when available.

Structured output rules:
You must always return a valid JSON object only.
Do not wrap the JSON in Markdown.
Do not add text before or after the JSON.

The JSON must contain exactly these fields:

{
  "answer": "A clear legal answer for the user in Arabic Markdown.",
  "suggestions": ["Suggested next question 1", "Suggested next question 2", "Suggested next question 3"],
  "lawyerSummary": "A concise professional summary that a lawyer can quickly review.",
  "sourceNote": "Arabic note explaining whether the answer was based on retrieved legal sources or general legal reasoning.",
  "sourceConfidence": "high | medium | low",
  "sourceTitle": "Arabic title of the legal source used, or empty string if no clear source was used.",
  "sourceArticles": ["Article number 1", "Article number 2"]
  "primaryArticles": ["Main article number"],
  "relatedArticles": ["Related article number 1", "Related article number 2"]
}

Rules for answer:
- Write in Arabic.
- Use clear headings.
- Explain the practical result.
- Include a legal caution when needed.
- Keep the answer useful for non-lawyers.
- If dates or deadlines are involved, explain how the period is generally calculated, but ask for exact dates when needed.
- Do not include a separate section titled "المصدر القانوني" inside the answer.
- Do not include a separate section titled "المواد ذات العلاقة" inside the answer.
- Do not repeat sourceTitle or sourceArticles inside the answer body.
- The legal source title and related articles must be returned only through sourceTitle and sourceArticles.
- It is allowed to mention article numbers naturally inside the legal explanation when necessary, but do not create a separate source section in the answer.

Rules for suggestions:
- Return 3 useful follow-up questions in Arabic.
- The questions should help the user move to the next legal step.

Rules for lawyerSummary:
- Write in Arabic.
- Keep it concise and professional.
- Focus on facts, legal issue, likely rule, and required next action.
- Make it easy to copy and send to a lawyer.
- Include related legal articles if available.
- Use this structure when possible:
  1. موضوع السؤال:
  2. المواد الأساسية:
  3. المواد المرتبطة:
  4. النتيجة القانونية المختصرة:
  5. الإجراء المقترح:
- Do not exaggerate certainty.
- If dates are involved, mention that the lawyer should verify the exact notification date, judgment type, and applicable deadline.

Rules for sourceConfidence:
- Use "high" only when the answer is directly supported by retrieved legal text or clear legal source content.
- Use "medium" when the answer is partially supported by legal sources but still requires professional review.
- Use "low" when no clear legal source was retrieved and the answer relies mostly on general legal reasoning.

Rules for sourceNote:
- Write in Arabic.
- If legal sources were used, mention that the answer was based on the available legal source.
- If no clear legal source was found, clearly say that no direct legal source was found and the answer should be reviewed by a lawyer.
- Do not claim high confidence unless the answer is actually supported by retrieved legal material.

Rules for sourceTitle:
- Write the legal source title in Arabic.
- If the retrieved source clearly identifies the law, use its title.
- For the current Jordanian civil procedure source, use: "قانون أصول المحاكمات المدنية الأردني".
- If no clear legal source was used, return an empty string.

Rules for sourceArticles:
- Include only article numbers that are clearly found in the retrieved legal source or clearly used in the answer.
- Do not invent article numbers.
- Use strings, for example: ["178", "170"].
- If no clear article was used, return an empty array.

Rules for primaryArticles:
- Include only the article numbers that directly answer the user question.
- If the user asks about an appeal period, the article that sets the period should be primary.
- If the user asks about the consequence of missing a deadline, the article that states the consequence should be primary.
- Do not invent article numbers.
- If no direct article was used, return an empty array.
- The lawyerSummary should be consistent with primaryArticles and relatedArticles.

Rules for relatedArticles:
- Include supporting or related article numbers used to explain the answer.
- Do not repeat articles already included in primaryArticles.
- Do not invent article numbers.
- If no related article was used, return an empty array.
- Return at most 5 related articles.
- Do not include a long list of procedural articles unless each one is directly relevant to the answer.
- Prefer the most important related articles only.

Important:
- The output must be valid JSON.
- sourceConfidence must be only one of: high, medium, low.
- sourceTitle must be a string.
- sourceArticles must be an array of strings.
`;
}

function buildUserPrompt(body: ChatRequestBody) {
  const question = getUserQuestion(body);
  const intakeData = getRelevantIntakeData(body);

  return `
User legal question:
${question}

User selected country:
${body.country || 'غير محدد'}

Selected legal path / intake type:
${body.intakeType || 'غير محدد'}

Additional intake data:
${JSON.stringify(intakeData || {}, null, 2)}

Please answer according to the system instructions and return only the required JSON object.
`;
}

function extractArticleNumbers(text: string): string[] {
  const matches = text.match(/المادة\s+(\d+)/g) || [];

  const articleNumbers = matches
    .map((match) => match.replace(/[^\d]/g, ''))
    .filter(Boolean);

  return Array.from(new Set(articleNumbers));
}
function removeDuplicateSourceSection(answer: string): string {
  return answer
    .replace(
      /(?:^|\n)#{1,6}\s*المصدر القانوني[\s\S]*?(?=\n#{1,6}\s|\n\*\*|$)/g,
      ''
    )
    .replace(
      /(?:^|\n)\*\*المصدر القانوني:\*\*[\s\S]*?(?=\n\n|$)/g,
      ''
    )
    .replace(
      /(?:^|\n)المصدر القانوني:\s*[\s\S]*?(?=\n\n|$)/g,
      ''
    )
    .replace(
      /(?:^|\n)المواد ذات العلاقة:\s*[\s\S]*?(?=\n\n|$)/g,
      ''
    )
    .trim();
}
function uniqueStrings(items: unknown[]): string[] {
  return Array.from(
    new Set(
      items
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function normalizeLegalOutput(
  parsed: Partial<LegalAiOutput>,
  fallbackAnswer: string,
  useJordanRag: boolean
): LegalAiOutput {
  const validConfidenceValues: SourceConfidence[] = ['high', 'medium', 'low'];

  const sourceConfidence: SourceConfidence =
    parsed.sourceConfidence &&
    validConfidenceValues.includes(parsed.sourceConfidence)
      ? parsed.sourceConfidence
      : 'low';
  const combinedSourceText = [
    parsed.answer,
    parsed.sourceNote,
    parsed.lawyerSummary,
  ]
    .filter((item) => typeof item === 'string')
    .join('\n');

  const extractedArticles = extractArticleNumbers(combinedSourceText);
  const rawPrimaryArticles = Array.isArray(parsed.primaryArticles)
    ? uniqueStrings(parsed.primaryArticles)
    : [];

  const rawRelatedArticles = Array.isArray(parsed.relatedArticles)
    ? uniqueStrings(parsed.relatedArticles)
    : [];

  const rawSourceArticles =
    Array.isArray(parsed.sourceArticles) && parsed.sourceArticles.length > 0
      ? uniqueStrings(parsed.sourceArticles)
      : uniqueStrings([...rawPrimaryArticles, ...rawRelatedArticles, ...extractedArticles]);

  const primaryArticles =
  rawPrimaryArticles.length > 0
    ? rawPrimaryArticles.slice(0, 2)
    : rawSourceArticles.length > 0
      ? rawSourceArticles.slice(0, 2)
      : [];

  const relatedArticles = uniqueStrings([
    ...rawRelatedArticles,
    ...rawPrimaryArticles.slice(1),
    ...rawSourceArticles.filter((article) => !primaryArticles.includes(article)),
  ]).slice(0, 5);

  const sourceArticles = uniqueStrings([
    ...primaryArticles,
    ...relatedArticles,
  ]);

  return {
    answer:
      typeof parsed.answer === 'string' && parsed.answer.trim()
        ? removeDuplicateSourceSection(parsed.answer)
        : removeDuplicateSourceSection(fallbackAnswer),
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((item) => typeof item === 'string')
      : [],
    lawyerSummary:
      typeof parsed.lawyerSummary === 'string' && parsed.lawyerSummary.trim()
        ? parsed.lawyerSummary
        : fallbackAnswer,
    sourceNote:
      typeof parsed.sourceNote === 'string' && parsed.sourceNote.trim()
        ? parsed.sourceNote
        : useJordanRag
          ? 'تمت محاولة صياغة الإجابة بالاعتماد على المصادر القانونية الأردنية المتاحة، لكن لم يتم توليد ملاحظة مصدر منظمة بشكل كامل.'
          : 'لم يتم استخدام مصدر قانوني مباشر في هذه الإجابة، ويجب مراجعة محامٍ مختص قبل اتخاذ أي إجراء.',
    sourceConfidence,
    sourceTitle:
      typeof parsed.sourceTitle === 'string' && parsed.sourceTitle.trim()
        ? parsed.sourceTitle
        : useJordanRag && sourceConfidence !== 'low'
          ? 'قانون أصول المحاكمات المدنية الأردني'
          : '',

    sourceArticles,
    primaryArticles,
    relatedArticles,
  };
}

function extractOutputText(response: unknown): string {
  if (
    typeof response === 'object' &&
    response !== null &&
    'output_text' in response &&
    typeof response.output_text === 'string'
  ) {
    return response.output_text;
  }

  if (
    typeof response === 'object' &&
    response !== null &&
    'output' in response &&
    Array.isArray(response.output)
  ) {
    for (const item of response.output) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'content' in item &&
        Array.isArray(item.content)
      ) {
        for (const contentItem of item.content) {
          if (
            typeof contentItem === 'object' &&
            contentItem !== null &&
            'type' in contentItem &&
            'text' in contentItem &&
            (contentItem.type === 'output_text' ||
              contentItem.type === 'text') &&
            typeof contentItem.text === 'string'
          ) {
            return contentItem.text;
          }
        }
      }
    }
  }

  return '';
}

function parseLegalOutput(
  text: string,
  useJordanRag: boolean
): LegalAiOutput {
  try {
    const parsed = JSON.parse(text) as Partial<LegalAiOutput>;
    return normalizeLegalOutput(parsed, text, useJordanRag);
  } catch {
    
    return {
      answer: text || 'تعذر توليد إجابة قانونية منظمة في هذه اللحظة.',
      suggestions: [],
      lawyerSummary:
        text || 'تعذر توليد ملخص محامٍ منظم في هذه اللحظة.',
      sourceNote:
        'لم يتم توليد ملاحظة مصدر منظمة لهذا الجواب، ويجب مراجعة محامٍ مختص قبل اتخاذ أي إجراء.',
      sourceConfidence: 'low',
      sourceTitle: '',
      sourceArticles: [],
      primaryArticles: [],
      relatedArticles: [],
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: 'OPENAI_API_KEY is not configured.',
        },
        { status: 500 }
      );
    }

    const body = (await req.json()) as ChatRequestBody;

    const question = getUserQuestion(body);

    if (!question) {
      return NextResponse.json(
        {
          error: 'Question is required.',
        },
        { status: 400 }
      );
    }

    const useJordanRag =
      isJordan(body.country) && Boolean(JORDAN_LAWS_VECTOR_STORE_ID);

    const systemPrompt = buildSystemPrompt({
      country: body.country,
      intakeType: body.intakeType,
      useJordanRag,
    });

    const userPrompt = buildUserPrompt(body);

    const tools = useJordanRag
      ? [
          {
            type: 'file_search' as const,
            vector_store_ids: [JORDAN_LAWS_VECTOR_STORE_ID],
          },
        ]
      : undefined;

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      ...(tools ? { tools } : {}),
      text: {
        format: {
          type: 'json_schema',
          name: 'legal_ai_output',
          schema: LEGAL_AI_OUTPUT_SCHEMA,
          strict: true,
        },
      },
    });

    const outputText = extractOutputText(response);
    const legalOutput = parseLegalOutput(outputText, useJordanRag);

    return NextResponse.json(legalOutput);
  } catch (error) {
    console.error('Hukumx chat route error:', error);

    return NextResponse.json(
      {
        answer:
          'حدث خطأ أثناء معالجة السؤال القانوني. يرجى المحاولة مرة أخرى، وإذا استمرت المشكلة يجب مراجعة الإعدادات التقنية أو مفاتيح OpenAI.',
        suggestions: [
          'هل يمكنني إعادة صياغة السؤال بطريقة أبسط؟',
          'ما هي المعلومات الناقصة التي أحتاجها؟',
          'هل يمكن تجهيز ملخص للمحامي؟',
        ],
        lawyerSummary:
          'تعذر توليد ملخص قانوني بسبب خطأ تقني أثناء معالجة الطلب.',
        sourceNote:
          'لم يتم الوصول إلى مصدر قانوني بسبب خطأ تقني أثناء معالجة الطلب.',
        sourceConfidence: 'low',
        sourceTitle: '',
        sourceArticles: [],
        primaryArticles: [],
        relatedArticles: [],
      },
      { status: 500 }
    );
  }
}
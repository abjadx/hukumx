import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '../../lib/prisma';

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
  countryCode?: string | null;
  language?: string | null;
  caseType?: unknown;
  caseTypeCode?: string | null;

  answerMode?: string | null;
  userType?: string | null;
  role?: string | null;

  intakeType?: IntakeType | null;
  judgmentIntakeData?: JudgmentIntakeData | null;
  contractIntakeData?: ContractIntakeData | null;

  // Backward compatibility with the first flow
  intakeData?: JudgmentIntakeData | ContractIntakeData | null;
};

type SourceConfidence = 'high' | 'medium' | 'low';

type AnswerMode =
  | 'GENERAL_USER'
  | 'LAWYER'
  | 'JUDGE'
  | 'LAW_STUDENT'
  | 'BUSINESS'
  | 'GOVERNMENT';

type LegalDomain =
  | 'CONSTITUTIONAL'
  | 'EXECUTION'
  | 'CIVIL_PROCEDURE'
  | 'CRIMINAL'
  | 'COMMERCIAL'
  | 'LABOR'
  | 'FAMILY'
  | 'ADMINISTRATIVE'
  | 'CONTRACTS'
  | 'COMPANIES'
  | 'GENERAL';

type LegalQuestionGoal =
  | 'PENALTY'
  | 'PROCEDURE'
  | 'DEADLINE'
  | 'RIGHT'
  | 'OBLIGATION'
  | 'CONSEQUENCE'
  | 'MEMO'
  | 'DRAFTING'
  | 'EXPLANATION'
  | 'COMPARISON'
  | 'GENERAL';

type LegalDistinctionType =
  | 'CRIMINAL_PENALTY_VS_LEGAL_EFFECT'
  | 'CRIMINAL_PENALTY_VS_EXECUTION_PROCEDURE'
  | 'PROCEDURAL_DEADLINE_VS_SUBSTANTIVE_RIGHT'
  | 'CONTRACTUAL_OBLIGATION_VS_STATUTORY_DUTY'
  | 'NEGOTIABLE_INSTRUMENT_TYPE_AMBIGUITY'
  | 'ABILITY_TO_PAY_VS_REFUSAL_TO_PAY';

type RequestedLegalSource = {
  key: string;
  titleHint: string;
  keywords: string[];
  strict: boolean;
};

type DirectLegalArticleHint = {
  key: string;
  sourceKey: string;
  sourceTitleHint: string;
  articleNumber: string;
  labelAr: string;
  keywords: string[];
  reason: string;
};

type LegalIntent = {
  domain: LegalDomain;
  goal: LegalQuestionGoal;
  requestedSource: RequestedLegalSource | null;
  requiresDistinction: boolean;
  distinctions: LegalDistinctionType[];
  searchHints: string[];
  directArticleHints: DirectLegalArticleHint[];
};

type AnswerModePolicy = {
  mode: AnswerMode;
  labelAr: string;
  audienceDescription: string;
  styleRules: string[];
  answerStructure: string[];
  warningStyle:
    | 'consumer'
    | 'professional'
    | 'judicial'
    | 'educational'
    | 'business'
    | 'administrative';
};

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

type DatabaseLegalArticle = {
  articleNumber: string;
  articleText: string;
  articleTextClean: string | null;
  articleTextReviewed: string | null;
  reviewStatus: string;
  legalSource: {
    titleAr: string;
    slug: string;
    country: {
      nameAr: string;
    };
  };
};

type DatabaseLegalContextArticleMeta = {
  sourceTitle: string;
  articleNumber: string;
  articleText: string;
};

type DatabaseLegalContextMeta = {
  sourceTitles: string[];
  articleNumbers: string[];
  articles: DatabaseLegalContextArticleMeta[];
  hasContext: boolean;
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

function getSelectedCountry(body: ChatRequestBody): string | null {
  return body.country || body.countryCode || null;
}

function isJordan(country?: string | null): boolean {
  const normalized = normalizeCountry(country);
  const lower = normalized.toLowerCase();

  return (
    normalized === 'الأردن' ||
    normalized === 'الاردن' ||
    lower === 'jordan' ||
    lower === 'jo' ||
    lower === 'jor'
  );
}

function normalizeAnswerMode(body: ChatRequestBody): AnswerMode {
  const rawValue = String(body.answerMode || body.userType || body.role || '')
    .trim()
    .toLowerCase();

  const compactValue = rawValue
    .replace(/[\s_\-]+/g, '')
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');

  if (
    rawValue === 'lawyer' ||
    rawValue === 'lawyer_mode' ||
    rawValue === 'lawyer-mode' ||
    compactValue.includes('محام') ||
    compactValue.includes('محامي')
  ) {
    return 'LAWYER';
  }

  if (
    rawValue === 'judge' ||
    rawValue === 'judge_mode' ||
    rawValue === 'judge-mode' ||
    compactValue.includes('قاضي') ||
    compactValue.includes('قاض')
  ) {
    return 'JUDGE';
  }

  if (
    rawValue === 'law_student' ||
    rawValue === 'law-student' ||
    rawValue === 'student' ||
    compactValue.includes('طالبقانون') ||
    compactValue.includes('طالب')
  ) {
    return 'LAW_STUDENT';
  }

  if (
    rawValue === 'business' ||
    rawValue === 'company' ||
    rawValue === 'corporate' ||
    compactValue.includes('شركه') ||
    compactValue.includes('شركة') ||
    compactValue.includes('اعمال') ||
    compactValue.includes('رجل')
  ) {
    return 'BUSINESS';
  }

  if (
    rawValue === 'government' ||
    rawValue === 'gov' ||
    compactValue.includes('حكوم') ||
    compactValue.includes('اداري') ||
    compactValue.includes('موظف')
  ) {
    return 'GOVERNMENT';
  }

  return 'GENERAL_USER';
}

const ANSWER_MODE_POLICIES: Record<AnswerMode, AnswerModePolicy> = {
  GENERAL_USER: {
    mode: 'GENERAL_USER',
    labelAr: 'مستخدم عادي',
    audienceDescription:
      'شخص غير متخصص يريد فهم النتيجة العملية بلغة بسيطة وواضحة.',
    warningStyle: 'consumer',
    styleRules: [
      'ابدأ بالجواب المختصر والنتيجة العملية قبل التفاصيل.',
      'استخدم لغة سهلة وقصيرة وتجنب المصطلحات الثقيلة قدر الإمكان.',
      'إذا اضطررت لاستخدام مصطلح قانوني، اشرحه بجملة بسيطة.',
      'لا تبدأ بسرد المواد؛ ابدأ بما يعنيه النص للمستخدم عمليًا.',
      'اجعل الفقرات قصيرة وواضحة، وابتعد عن الأسلوب القضائي المطول.',
    ],
    answerStructure: [
      'الجواب المختصر',
      'ببساطة ماذا يعني ذلك؟',
      'ما الذي يمكن فعله ضمن النصوص المتاحة؟',
      'حدود الجواب',
    ],
  },
  LAWYER: {
    mode: 'LAWYER',
    labelAr: 'محامٍ',
    audienceDescription:
      'محامٍ أو قانوني يريد تكييفًا وتحليلًا مهنيًا قابلًا للبناء عليه.',
    warningStyle: 'professional',
    styleRules: [
      'لا تخاطب المستخدم بعبارات مثل: راجع محامي أو يجب مراجعة محامٍ مختص.',
      'استخدم بدلًا من ذلك: يلزم التحقق من الوقائع والمستندات والنص الساري قبل اعتماد الإجراء.',
      'فرّق بين التكييف القانوني والنص المسترجع والأثر العملي.',
      'اذكر نقاط التحقق والدفوع أو الاتجاهات المحتملة عند اللزوم.',
      'لا تعطِ نتيجة قطعية إذا كان النص أو الوقائع لا يكفيان.',
    ],
    answerStructure: [
      'المسألة القانونية',
      'التكييف القانوني',
      'النصوص المسترجعة وأثرها',
      'النتيجة الأولية',
      'نقاط تحقق مهنية',
    ],
  },
  JUDGE: {
    mode: 'JUDGE',
    labelAr: 'قاضٍ',
    audienceDescription:
      'قاضٍ أو باحث قضائي يريد عرضًا محايدًا للمسألة وشروط التطبيق.',
    warningStyle: 'judicial',
    styleRules: [
      'استخدم صياغة محايدة وغير دفاعية.',
      'لا تستخدم عبارات مثل: ادفع بـ، ننصحك، راجع محامي.',
      'ركّز على المسألة، النص الواجب التطبيق، شروط التطبيق، والأثر القانوني.',
      'إذا تعددت الاحتمالات، اعرضها بصياغة محايدة دون ترجيح قاطع إلا بنص واضح.',
    ],
    answerStructure: [
      'تحديد المسألة',
      'النصوص الواجبة التطبيق',
      'شروط التطبيق',
      'الأثر القانوني',
      'حدود النتيجة',
    ],
  },
  LAW_STUDENT: {
    mode: 'LAW_STUDENT',
    labelAr: 'طالب قانون',
    audienceDescription:
      'طالب قانون يريد فهم المفهوم وتعلم الفرق بين المصطلحات.',
    warningStyle: 'educational',
    styleRules: [
      'استخدم أسلوبًا تعليميًا مبسطًا.',
      'عرّف المصطلحات القانونية الأساسية.',
      'قدّم مثالًا قصيرًا عند الحاجة.',
      'فرّق بوضوح بين المفاهيم المتشابهة.',
    ],
    answerStructure: [
      'الفكرة ببساطة',
      'تعريف المصطلحات',
      'تطبيق النص على السؤال',
      'مثال مبسط',
    ],
  },
  BUSINESS: {
    mode: 'BUSINESS',
    labelAr: 'شركة / رجل أعمال',
    audienceDescription:
      'شركة أو رجل أعمال يريد فهم المخاطر والالتزامات والخطوات العملية.',
    warningStyle: 'business',
    styleRules: [
      'ابدأ بالخلاصة التجارية والمخاطر العملية.',
      'ركّز على الالتزامات، أثر القرار، والمخاطر المالية أو التشغيلية.',
      'اقترح نقاط تحقق قبل توقيع أو مطالبة أو تنفيذ أي إجراء.',
      'لا تطل في الشرح الأكاديمي إلا إذا كان ضروريًا.',
    ],
    answerStructure: [
      'الخلاصة التجارية',
      'المخاطر القانونية',
      'الأثر العملي',
      'نقاط تحقق قبل القرار',
    ],
  },
  GOVERNMENT: {
    mode: 'GOVERNMENT',
    labelAr: 'جهة حكومية / موظف عام',
    audienceDescription:
      'جهة حكومية أو موظف عام يريد معرفة الاختصاص والإجراء والمشروعية.',
    warningStyle: 'administrative',
    styleRules: [
      'ركّز على الاختصاص والصلاحية والإجراء الصحيح.',
      'نبّه إلى مخاطر تجاوز الاختصاص أو مخالفة الشكل والإجراءات.',
      'استخدم لغة رسمية محايدة مناسبة للمخاطبات الإدارية.',
    ],
    answerStructure: [
      'المسألة الإدارية',
      'الصلاحية أو الاختصاص',
      'الإجراء الواجب',
      'مخاطر المشروعية',
    ],
  },
};

function getAnswerModePolicy(answerMode: AnswerMode): AnswerModePolicy {
  return ANSWER_MODE_POLICIES[answerMode] || ANSWER_MODE_POLICIES.GENERAL_USER;
}

function buildAnswerModePrompt(policy: AnswerModePolicy): string {
  return [
    `Answer mode: ${policy.mode} - ${policy.labelAr}`,
    `Audience: ${policy.audienceDescription}`,
    'Mode-specific style rules:',
    ...policy.styleRules.map((rule) => `- ${rule}`),
    'Preferred answer structure:',
    ...policy.answerStructure.map((section) => `- ${section}`),
  ].join('\n');
}

function buildSourceNoteModeInstruction(policy: AnswerModePolicy): string {
  if (policy.mode === 'LAWYER') {
    return [
      '- In sourceNote, never say: راجع محامي، مراجعة محامٍ مختص، or استشارة محامي.',
      '- Good example when sources were used: "الإجابة مستندة إلى النصوص القانونية المسترجعة، وتبقى مقيدة بالوقائع والمستندات والنص الساري وقت التطبيق."',
      '- Good example when no source was found: "لم يتم العثور على سند قانوني مباشر كافٍ ضمن المصادر المسترجعة، ويلزم استكمال البحث في النصوص السارية قبل اعتماد الإجراء."',
    ].join('\n');
  }

  if (policy.mode === 'JUDGE') {
    return [
      '- In sourceNote, never say: راجع محامي، مراجعة محامٍ مختص، or استشارة محامي.',
      '- Good example when sources were used: "العرض مستند إلى النصوص القانونية المسترجعة، ويبقى تقدير التطبيق مرتبطًا بوقائع الملف والنص الواجب التطبيق."',
      '- Good example when no source was found: "لم يظهر سند قانوني مباشر كافٍ ضمن المصادر المسترجعة، ويبقى الحسم مرتبطًا باستكمال النصوص والوقائع ذات الصلة."',
    ].join('\n');
  }

  if (policy.mode === 'LAW_STUDENT') {
    return [
      '- Good example when sources were used: "الشرح مستند إلى النصوص القانونية المتاحة، وهو مخصص لفهم الفكرة وليس لإصدار رأي عملي نهائي."',
      '- Good example when no source was found: "لم يتم العثور على نص مباشر كافٍ، لذلك يبقى الشرح تعليميًا عامًا ويحتاج إلى ربطه بالنصوص السارية."',
    ].join('\n');
  }

  if (policy.mode === 'BUSINESS') {
    return [
      '- Good example when sources were used: "الإجابة مستندة إلى النصوص القانونية المتاحة، ويجب مطابقتها مع المستندات والمخاطر التجارية قبل اتخاذ القرار."',
      '- Good example when no source was found: "لم يتم العثور على سند قانوني مباشر كافٍ، لذلك يجب استكمال التحقق القانوني قبل أي قرار مالي أو تعاقدي."',
    ].join('\n');
  }

  if (policy.mode === 'GOVERNMENT') {
    return [
      '- Good example when sources were used: "الإجابة مستندة إلى النصوص القانونية المتاحة، ويجب مطابقتها مع الصلاحيات والإجراءات الداخلية قبل اتخاذ قرار رسمي."',
      '- Good example when no source was found: "لم يتم العثور على سند قانوني مباشر كافٍ، لذلك يجب استكمال التحقق من النصوص والصلاحيات قبل أي إجراء رسمي."',
    ].join('\n');
  }

  return [
    '- Good example when sources were used: "الإجابة مستندة إلى النصوص القانونية المتاحة، لكنها لا تكفي وحدها لاتخاذ قرار نهائي دون استشارة قانونية متخصصة."',
    '- Good example when no source was found: "لم يتم العثور على مصدر قانوني مباشر كافٍ، ويجب أخذ استشارة قانونية متخصصة قبل اتخاذ أي إجراء."',
  ].join('\n');
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
  hasDatabaseLegalContext: boolean;
  answerMode: AnswerMode;
  legalIntent: LegalIntent;
}) {
  const {
    country,
    intakeType,
    useJordanRag,
    hasDatabaseLegalContext,
    answerMode,
    legalIntent,
  } = params;

  const answerModePolicy = getAnswerModePolicy(answerMode);
  const sourceNoteModeInstruction = buildSourceNoteModeInstruction(answerModePolicy);

  return `
You are Hukumx, a professional AI legal assistant for users in the Arab world.

Your job:
- Answer legal questions clearly in Arabic.
- Help ordinary users understand legal issues.
- Help legal professionals analyze legal issues efficiently.
- Be careful, conservative, and transparent.
- Do not invent laws, article numbers, deadlines, procedures, or court rules.
- If the facts are incomplete, clearly say what information is missing.
- Do not treat every user the same; follow the selected answer mode exactly.

Current context:
- Country: ${country || 'غير محدد'}
- Intake type: ${intakeType || 'غير محدد'}
- Jordan legal RAG enabled: ${useJordanRag ? 'yes' : 'no'}
- Hukumx database legal context available: ${hasDatabaseLegalContext ? 'yes' : 'no'}

${buildAnswerModePrompt(answerModePolicy)}

${buildLegalIntentPrompt(legalIntent)}

Hukumx Legal Reasoning Engine v1:
- First identify the real legal question behind the user's words.
- Then identify the requested legal source and stay inside it when the user restricts the question to a specific law.
- Then distinguish between similar legal concepts before giving the result.
- Then explain what the retrieved text says, what legal effect it has, and how it applies to the question.
- Do not merely copy or paraphrase legal articles; always state the practical legal effect of the text.
- If an article contains an exception, condition, limitation, or threshold, you must mention it and apply it to the answer.
- If the user uses a colloquial or imprecise word such as "عقوبة", "بدون رصيد", "ينحبس", "شو حقي", or "أقدر أشتكي", reframe it into the closest precise legal issue.
- If the user asks about "عقوبة" under a non-criminal law, distinguish between criminal penalty and the legal effect/procedure available under that law.
- If the question is restricted to a law such as "قانون التنفيذ", do not answer from criminal law, commercial law, civil procedure, or any other law unless that law appears in the retrieved legal context. You may only say that other liability may exist outside the restricted source and requires separate research.
- For lawyer mode and judge mode, do not tell the user to "راجع محامي" or "يجب مراجعة محامٍ مختص". Use professional verification language instead.
- For ordinary-user mode, use very simple language and start with the practical answer before legal details.

Legal source rules:
- If Hukumx database legal context is provided in the user prompt, treat it as the highest-priority legal source.
- If the detected legal intent includes a direct article resolver hint and that article appears in the Hukumx database legal context, treat that article as the primary article and do not say that no direct legal text was found.
- When Hukumx database legal context is provided, answer only from the legal source and article numbers shown inside that context.
- Do not cite, mention, or rely on any article number that does not appear inside the Hukumx database legal context.
- Do not switch to another law, regulation, constitutional text, or procedural source unless it appears inside the Hukumx database legal context or retrieved legal source.
- The Hukumx database context uses the approved human-reviewed legal text when the article is approved, otherwise it uses the best available cleaned text.
- If retrieved file_search text and Hukumx database context conflict, prefer the Hukumx database context.
- If retrieved legal text is available and directly supports the answer, use it.
- If the retrieved source is not enough, clearly say that the answer is only partially supported.
- If no legal source supports the answer, do not claim that the answer is source-based.
- Do not invent article numbers.
- Do not cite an article unless it appeared clearly in the retrieved legal content or Hukumx database legal context.
- For Jordan questions, prioritize the retrieved Jordanian legal source when available.

Legal answer safety rules:
- If the available legal source does not directly support the answer, avoid giving a decisive legal conclusion.
- If the question involves deadlines, appeal periods, notification dates, court procedures, loss of rights, or urgent action, be especially conservative.
- If no clear primary article supports the answer, use the caution language appropriate to the selected answer mode.
- For LAWYER and JUDGE modes, never write that the user must review a lawyer; use verification language about facts, documents, the file, and the text in force.
- Never tell the user that a deadline is certainly valid, expired, extended, or still open unless the relevant article and facts clearly support that.
- If dates are missing, ask for the exact date of judgment, notification, and judgment type when relevant.

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
  "sourceArticles": ["Article number 1", "Article number 2"],
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
- Include the primary legal articles if available.
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
- Keep it short and professional, preferably one sentence only.
- If legal sources were used, state briefly that the answer is based on the available legal source.
- If no clear legal source was found, clearly say that no direct legal source was found using the caution language appropriate to the selected answer mode.
- Do not repeat the sourceTitle.
- Do not repeat the article numbers.
- Do not write long explanations inside sourceNote.
${sourceNoteModeInstruction}

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
- Do not mark a merely related article as primary.
- If several articles are retrieved, choose the article whose text creates the legal consequence or rule that answers the question.
- If one article states the rule and another article only gives background, the rule article must be primary and the background article must be related.
- If the user asks about an appeal period, the article that sets the period should be primary.
- If the user asks about the consequence of missing a deadline, the article that states the consequence should be primary.
- If the user asks about retrial / إعادة المحاكمة, the retrial article should be primary.
- If the user asks about third-party objection / اعتراض الغير, the third-party objection article should be primary.
- Do not invent article numbers.
- If no direct article was used, return an empty array.
- The lawyerSummary should be consistent with primaryArticles and relatedArticles.

Rules for relatedArticles:
- Include supporting or related article numbers used to explain the answer.
- Related articles are not decorative; include them only if they add a condition, exception, procedure, definition, or supporting rule.
- Do not repeat articles already included in primaryArticles.
- Do not invent article numbers.
- Return at most 5 related articles.
- Do not include a long list of procedural articles unless each one is directly relevant to the answer.
- Prefer the most important related articles only.
- If no related article was used, return an empty array.

Important:
- The output must be valid JSON.
- sourceConfidence must be only one of: high, medium, low.
- sourceTitle must be a string.
- sourceArticles must be an array of strings.
- primaryArticles must be an array of strings.
- relatedArticles must be an array of strings.
`;
}

function buildUserPrompt(
  body: ChatRequestBody,
  databaseLegalContext: string,
  answerMode: AnswerMode,
  legalIntent: LegalIntent
) {
  const question = getUserQuestion(body);
  const intakeData = getRelevantIntakeData(body);
  const selectedCountry = getSelectedCountry(body);

  const databaseContextBlock = databaseLegalContext.trim()
    ? `
Hukumx database legal context:
${databaseLegalContext}

Important database context rule:
- Use the Hukumx database legal context above as the primary source when it directly answers the question.
- If the detected legal intent contains directArticleHints and the hinted article appears in this context, use it as the primary article.
- When this context is available, do not use any article number or legal source title outside the context.
- If the context contains the Jordanian Constitution, do not answer from civil procedure law or any other law.
- If the context contains civil procedure law, do not answer from the Constitution or any other law.
- Article texts in this context already follow the system priority: approved reviewed text first, then cleaned text, then original extracted text.
`
    : `
Hukumx database legal context:
No matching database legal context was found for this question.
`;

  return `
User legal question:
${question}

User selected country:
${selectedCountry || 'غير محدد'}

Selected answer mode:
${getAnswerModePolicy(answerMode).labelAr} (${answerMode})

Detected legal intent:
${JSON.stringify(legalIntent, null, 2)}

Selected legal path / intake type:
${body.intakeType || 'غير محدد'}

Additional intake data:
${JSON.stringify(intakeData || {}, null, 2)}

${databaseContextBlock}

Please answer according to the system instructions and return only the required JSON object.
`;
}


function normalizeArabicForSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const LEGAL_SEARCH_STOP_WORDS = new Set([
  'في',
  'من',
  'على',
  'الى',
  'إلى',
  'عن',
  'ما',
  'ماذا',
  'هل',
  'اذا',
  'إذا',
  'او',
  'أو',
  'و',
  'ثم',
  'مع',
  'هذا',
  'هذه',
  'ذلك',
  'التي',
  'الذي',
  'الذين',
  'كان',
  'كانت',
  'يكون',
  'تكون',
  'هو',
  'هي',
  'انا',
  'أنا',
  'لي',
  'له',
  'لها',
  'بعد',
  'قبل',
  'عند',
  'كل',
  'اي',
  'أي',
  'غير',
  'بسبب',
  'لدي',
  'عندي',
]);

function tokenizeLegalSearchText(value: string): string[] {
  const normalized = normalizeArabicForSearch(value);

  return uniqueStrings(
    normalized
      .split(/[^\u0600-\u06FF0-9]+/g)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3)
      .filter((term) => !LEGAL_SEARCH_STOP_WORDS.has(term))
  ).slice(0, 12);
}

function compareArticleNumbers(a: string, b: string) {
  const numberA = Number(a);
  const numberB = Number(b);

  if (Number.isFinite(numberA) && Number.isFinite(numberB)) {
    return numberA - numberB;
  }

  return a.localeCompare(b, 'ar');
}

function getBestDatabaseArticleText(article: DatabaseLegalArticle) {
  if (
    article.reviewStatus === 'approved' &&
    article.articleTextReviewed &&
    article.articleTextReviewed.trim()
  ) {
    return article.articleTextReviewed;
  }

  return '';
}

function cleanDatabaseArticleTextForContext(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inferLikelyArticleNumbers(question: string): string[] {
  const normalizedQuestion = normalizeArabicForSearch(question);
  const inferredArticles: string[] = [];

  if (isFraudPenaltyQuestion(question)) {
    inferredArticles.push('417');
  }

  if (isTheftPenaltyQuestion(question)) {
    inferredArticles.push(...getTheftArticlePriority(question));
  }

  if (
    includesAny(normalizedQuestion, [
      'مده الاستئناف',
      'ميعاد الاستئناف',
      'موعد الاستئناف',
      'مده الطعن بالاستئناف',
      'الطعن بالاستئناف',
    ])
  ) {
    inferredArticles.push('178');
  }

  if (
    includesAny(normalizedQuestion, [
      'فاتت مده الاستئناف',
      'فوات مده الاستئناف',
      'انقضاء مده الاستئناف',
      'فوات الميعاد',
      'رد الطعن شكلا',
      'رد الطعن شكل',
    ])
  ) {
    inferredArticles.push('172', '178');
  }

  if (
    includesAny(normalizedQuestion, [
      'اعاده المحاكمه',
      'طلب اعاده المحاكمه',
    ])
  ) {
    inferredArticles.push('213');
  }

  if (
    includesAny(normalizedQuestion, [
      'اعتراض الغير',
      'اعتراض غير',
    ])
  ) {
    inferredArticles.push('207', '208');
  }

  if (
    includesAny(normalizedQuestion, [
      'التمييز',
      'محكمه التمييز',
      'الطعن بالتمييز',
    ])
  ) {
    inferredArticles.push('191');
  }

  return uniqueStrings(inferredArticles);
}

function scoreDatabaseArticle(params: {
  article: DatabaseLegalArticle;
  questionTerms: string[];
  explicitArticleNumbers: string[];
  inferredArticleNumbers: string[];
  directArticleHints?: DirectLegalArticleHint[];
}) {
  const {
    article,
    questionTerms,
    explicitArticleNumbers,
    inferredArticleNumbers,
    directArticleHints = [],
  } = params;

  const articleText = normalizeArabicForSearch(getBestDatabaseArticleText(article));
  const sourceTitle = normalizeArabicForSearch(article.legalSource.titleAr);

  let score = 0;

  if (explicitArticleNumbers.includes(article.articleNumber)) {
    score += 1000;
  }

  if (inferredArticleNumbers.includes(article.articleNumber)) {
    score += 700;
  }

  for (const hint of directArticleHints) {
    if (hint.articleNumber === article.articleNumber) {
      score += 3000;
    }

    if (
      hint.articleNumber === article.articleNumber &&
      sourceMatchesRequestedSource(
        normalizeArabicForSearch(article.legalSource.titleAr),
        {
          key: hint.sourceKey,
          titleHint: hint.sourceTitleHint,
          keywords: [hint.sourceTitleHint, 'قانون العقوبات', 'العقوبات'],
          strict: true,
        }
      )
    ) {
      score += 500;
    }

    const normalizedHintKeywords = hint.keywords.map((keyword) =>
      normalizeArabicForSearch(keyword)
    );

    for (const keyword of normalizedHintKeywords) {
      if (keyword && articleText.includes(keyword)) {
        score += 80;
      }
    }
  }

  for (const term of questionTerms) {
    if (articleText.includes(term)) {
      score += 8;
    }

    if (sourceTitle.includes(term)) {
      score += 3;
    }
  }

  return score;
}


// HUKUMX_CHAT_SOURCE_ROUTING_START
type SourceForRouting = {
  id: string;
  titleAr: string;
  titleEn: string | null;
  slug: string;
  category: string | null;
  country: {
    nameAr: string;
  };
};

function scoreLegalSourceForQuestion(
  source: SourceForRouting,
  question: string
): number {
  const normalizedQuestion = normalizeArabicForSearch(question);
  const sourceText = normalizeArabicForSearch(
    [source.titleAr, source.titleEn, source.slug, source.category]
      .filter(Boolean)
      .join(' ')
  );
  const legalIntent = detectLegalIntent(question);
  const requestedSource = legalIntent.requestedSource;

  let score = 0;

  for (const hint of legalIntent.directArticleHints) {
    if (sourceMatchesRequestedSource(sourceText, {
      key: hint.sourceKey,
      titleHint: hint.sourceTitleHint,
      keywords: [hint.sourceTitleHint, 'قانون العقوبات', 'العقوبات'],
      strict: true,
    })) {
      score += 1800;
    }
  }

  if (requestedSource) {
    if (sourceMatchesRequestedSource(sourceText, requestedSource)) {
      score += requestedSource.strict ? 1400 : 700;
    } else if (requestedSource.strict) {
      score -= 450;
    }
  }

  if (
    includesAny(normalizedQuestion, ['الدستور', 'دستور', 'دستوري', 'الدستوري'])
  ) {
    score += sourceText.includes('دستور') ? 1000 : -500;
  }

  if (
    includesAny(normalizedQuestion, [
      'قانون التنفيذ',
      'التنفيذ',
      'دائره التنفيذ',
      'دائرة التنفيذ',
      'الحبس التنفيذي',
      'حبس المدين',
      'السند التنفيذي',
    ])
  ) {
    score += sourceText.includes('تنفيذ') ? 1000 : -250;
  }

  if (
    includesAny(normalizedQuestion, [
      'اصول المحاكمات',
      'أصول المحاكمات',
      'محاكمات مدنيه',
      'محاكمات مدنية',
      'الاستئناف',
      'التمييز',
      'التبليغ',
    ])
  ) {
    score += sourceText.includes('اصول المحاكمات') || sourceText.includes('محاكمات مدنيه') ? 900 : 0;
  }

  if (
    includesAny(normalizedQuestion, ['النظام', 'نظام'])
  ) {
    score += sourceText.includes('نظام') ? 500 : 0;
  }

  if (
    includesAny(normalizedQuestion, ['تعليمات', 'التعليمات'])
  ) {
    score += sourceText.includes('تعليمات') ? 500 : 0;
  }

  if (
    includesAny(normalizedQuestion, ['قرار', 'قرارات'])
  ) {
    score += sourceText.includes('قرار') ? 500 : 0;
  }

  const questionTerms = tokenizeLegalSearchText(question);
  for (const term of questionTerms) {
    if (sourceText.includes(term)) {
      score += 25;
    }
  }

  return score;
}

async function findBestLegalSourceForQuestion(params: {
  question: string;
  country?: string | null;
}): Promise<SourceForRouting | null> {
  if (!isJordan(params.country)) {
    return null;
  }

  const sources = (await prisma.legalSource.findMany({
    where: {
      isActive: true,
      country: {
        code: 'JO',
      },
      articles: {
        some: {
          reviewStatus: 'approved',
          articleTextReviewed: {
            not: null,
          },
        },
      },
    },
    select: {
      id: true,
      titleAr: true,
      titleEn: true,
      slug: true,
      category: true,
      country: {
        select: {
          nameAr: true,
        },
      },
    },
  })) as SourceForRouting[];

  if (!sources.length) {
    return null;
  }

  const ranked = sources
    .map((source) => ({
      source,
      score: scoreLegalSourceForQuestion(source, params.question),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (!best || best.score <= 0) {
    return null;
  }

  return best.source;
}
// HUKUMX_CHAT_SOURCE_ROUTING_END


async function buildDatabaseLegalContext(params: {
  question: string;
  country?: string | null;
}) {
  if (!isJordan(params.country)) {
    return '';
  }

  const selectedSource = await findBestLegalSourceForQuestion({
    question: params.question,
    country: params.country,
  });

  if (!selectedSource) {
    return '';
  }

  const legalIntent = detectLegalIntent(params.question, params.country);
  const explicitArticleNumbers = extractArticleNumbers(params.question);
  const directArticleNumbers = legalIntent.directArticleHints.map(
    (hint) => hint.articleNumber
  );
  const inferredArticleNumbers = uniqueStrings([
    ...inferLikelyArticleNumbers(params.question),
    ...directArticleNumbers,
  ]);
  const questionTerms = uniqueStrings([
    ...tokenizeLegalSearchText(params.question),
    ...legalIntent.searchHints,
    ...legalIntent.directArticleHints.flatMap((hint) => hint.keywords),
  ]).slice(0, 40);
  const normalizedQuestion = normalizeArabicForSearch(params.question);

  const wantsOverview =
    explicitArticleNumbers.length === 0 &&
    includesAny(normalizedQuestion, [
      'استعرض مواد',
      'اعرض مواد',
      'عرض مواد',
      'مواد الدستور',
      'مواد القانون',
      'استعراض مواد',
    ]);

  const dbArticles = (await prisma.legalArticle.findMany({
    where: {
      legalSourceId: selectedSource.id,
      reviewStatus: 'approved',
      articleTextReviewed: {
        not: null,
      },
    },
    select: {
      articleNumber: true,
      articleText: true,
      articleTextClean: true,
      articleTextReviewed: true,
      reviewStatus: true,
      legalSource: {
        select: {
          titleAr: true,
          slug: true,
          country: {
            select: {
              nameAr: true,
            },
          },
        },
      },
    },
  })) as DatabaseLegalArticle[];

  const approvedArticles = dbArticles.filter((article) =>
    getBestDatabaseArticleText(article).trim()
  );

  const strictAllowedDirectArticleNumbers =
    getStrictAllowedArticleNumbersForDirectIntent(legalIntent);

  const searchableArticles =
    strictAllowedDirectArticleNumbers.length > 0 && !wantsOverview
      ? approvedArticles.filter((article) =>
          strictAllowedDirectArticleNumbers.includes(article.articleNumber)
        )
      : approvedArticles;

  const selectedArticles = wantsOverview
    ? [...approvedArticles]
        .sort((a, b) => compareArticleNumbers(a.articleNumber, b.articleNumber))
        .slice(0, 10)
    : searchableArticles
        .map((article) => ({
          article,
          score: scoreDatabaseArticle({
            article,
            questionTerms,
            explicitArticleNumbers,
            inferredArticleNumbers,
            directArticleHints: legalIntent.directArticleHints,
          }),
        }))
        .filter(
          (item) =>
            item.score > 0 || directArticleNumbers.includes(item.article.articleNumber)
        )
        .sort((a, b) => {
          if (b.score !== a.score) {
            return b.score - a.score;
          }

          return compareArticleNumbers(
            a.article.articleNumber,
            b.article.articleNumber
          );
        })
        .slice(0, 8)
        .map((item) => item.article);

  if (!selectedArticles.length) {
    return '';
  }

  return selectedArticles
    .map((article) => {
      const bestText = cleanDatabaseArticleTextForContext(
        getBestDatabaseArticleText(article)
      );

      const truncatedText =
        bestText.length > 3000 ? `${bestText.slice(0, 3000).trim()}...` : bestText;

      return [
        `القانون: ${article.legalSource.titleAr}`,
        `الدولة: ${article.legalSource.country.nameAr}`,
        `رقم المادة: ${article.articleNumber}`,
        `حالة المراجعة: ${getReviewStatusForPrompt(article.reviewStatus)}`,
        'نص المادة:',
        truncatedText,
      ].join('\n');
    })
    .join('\n\n---\n\n');
}

function getReviewStatusForPrompt(status: string) {
  if (status === 'approved') return 'معتمدة بنص بشري مراجع';
  if (status === 'needs_review') return 'نص مقترح يحتاج مراجعة بشرية';
  if (status === 'pending') return 'غير مراجعة';
  return status || 'غير مراجعة';
}



function extractDatabaseLegalContextMeta(
  databaseLegalContext: string
): DatabaseLegalContextMeta {
  const sourceTitles: string[] = [];
  const articleNumbers: string[] = [];
  const articles: DatabaseLegalContextArticleMeta[] = [];

  const sourceMatches = databaseLegalContext.matchAll(/^القانون:\s*(.+)$/gm);
  for (const match of sourceMatches) {
    sourceTitles.push(match[1]);
  }

  const articleMatches = databaseLegalContext.matchAll(/^رقم المادة:\s*(.+)$/gm);
  for (const match of articleMatches) {
    articleNumbers.push(match[1]);
  }

  const blocks = databaseLegalContext
    .split(/\n\s*---\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const block of blocks) {
    const sourceTitle = block.match(/^القانون:\s*(.+)$/m)?.[1]?.trim() || '';
    const articleNumber = block.match(/^رقم المادة:\s*(.+)$/m)?.[1]?.trim() || '';
    const articleTextMatch = block.match(/نص المادة:\s*\n([\s\S]*)$/m);
    const articleText = articleTextMatch?.[1]?.trim() || '';

    if (sourceTitle && articleNumber) {
      articles.push({
        sourceTitle,
        articleNumber,
        articleText,
      });
    }
  }

  return {
    sourceTitles: uniqueStrings(sourceTitles),
    articleNumbers: uniqueStrings(articleNumbers),
    articles,
    hasContext: Boolean(databaseLegalContext.trim()),
  };
}

function keepOnlyAllowedArticles(
  articles: string[],
  allowedArticleNumbers: string[]
): string[] {
  if (!allowedArticleNumbers.length) {
    return uniqueStrings(articles);
  }

  const allowedSet = new Set(allowedArticleNumbers);

  return uniqueStrings(articles).filter((articleNumber) =>
    allowedSet.has(articleNumber)
  );
}

function hasArticlesOutsideAllowedList(
  articles: string[],
  allowedArticleNumbers: string[]
): boolean {
  if (!allowedArticleNumbers.length) {
    return false;
  }

  const allowedSet = new Set(allowedArticleNumbers);

  return uniqueStrings(articles).some(
    (articleNumber) => !allowedSet.has(articleNumber)
  );
}

function isOverviewLegalSourceQuestion(question: string): boolean {
  const normalizedQuestion = normalizeArabicForSearch(question);

  return includesAny(normalizedQuestion, [
    'استعرض مواد',
    'اعرض مواد',
    'عرض مواد',
    'اذكر مواد',
    'اذكر لي مواد',
    'ما هي مواد',
    'ما مواد',
    'مواد الدستور',
    'مواد القانون',
    'استعراض مواد',
  ]);
}


function scoreDatabaseContextArticleForQuestion(params: {
  article: DatabaseLegalContextArticleMeta;
  question: string;
  legalIntent: LegalIntent;
  output: LegalAiOutput;
}): number {
  const { article, question, legalIntent, output } = params;
  const normalizedQuestion = normalizeArabicForSearch(question);
  const normalizedArticleText = normalizeArabicForSearch(article.articleText);
  const normalizedSourceTitle = normalizeArabicForSearch(article.sourceTitle);
  const questionTerms = uniqueStrings([
    ...tokenizeLegalSearchText(question),
    ...legalIntent.searchHints,
  ]);
  const explicitArticleNumbers = extractArticleNumbers(question);
  const inferredArticleNumbers = inferLikelyArticleNumbers(question);

  let score = 0;

  if (explicitArticleNumbers.includes(article.articleNumber)) score += 1200;
  if (inferredArticleNumbers.includes(article.articleNumber)) score += 850;

  for (const hint of legalIntent.directArticleHints) {
    if (hint.articleNumber === article.articleNumber) {
      score += 3200;
    }

    for (const keyword of hint.keywords) {
      const normalizedKeyword = normalizeArabicForSearch(keyword);
      if (normalizedKeyword && normalizedArticleText.includes(normalizedKeyword)) {
        score += 90;
      }
    }
  }

  if (output.primaryArticles.includes(article.articleNumber)) score += 550;
  if (output.sourceArticles.includes(article.articleNumber)) score += 220;
  if (output.relatedArticles.includes(article.articleNumber)) score += 90;

  for (const term of questionTerms) {
    if (normalizedArticleText.includes(term)) score += 22;
    if (normalizedSourceTitle.includes(term)) score += 5;
  }

  if (legalIntent.requestedSource) {
    const sourceSearchText = normalizeArabicForSearch(
      `${article.sourceTitle} ${legalIntent.requestedSource.titleHint}`
    );

    if (sourceMatchesRequestedSource(sourceSearchText, legalIntent.requestedSource)) {
      score += legalIntent.requestedSource.strict ? 160 : 70;
    }
  }

  if (legalIntent.domain === 'EXECUTION') {
    if (includesAny(normalizedArticleText, ['حبس المدين', 'الحبس', 'يحبس', 'حبسه'])) score += 180;
    if (includesAny(normalizedArticleText, ['عجز عن الوفاء', 'الوفاء', 'السداد'])) score += 150;
    if (includesAny(normalizedArticleText, ['التزام تعاقدي', 'عقود ايجار العقار', 'عقود العمل'])) score += 180;
    if (includesAny(normalizedArticleText, ['دائره التنفيذ', 'دائرة التنفيذ', 'السند التنفيذي', 'الحجز'])) score += 90;
  }

  if (legalIntent.domain === 'CIVIL_PROCEDURE') {
    if (legalIntent.goal === 'DEADLINE' && includesAny(normalizedArticleText, ['ميعاد', 'مده', 'مدة', 'خلال', 'يوما', 'يوم'])) score += 180;
    if (includesAny(normalizedQuestion, ['استئناف', 'الاستئناف']) && includesAny(normalizedArticleText, ['استئناف', 'الاستئناف'])) score += 160;
    if (includesAny(normalizedQuestion, ['تمييز', 'التمييز']) && includesAny(normalizedArticleText, ['تمييز', 'التمييز'])) score += 160;
  }

  if (legalIntent.goal === 'PENALTY') {
    if (legalIntent.domain === 'CRIMINAL' && includesAny(normalizedArticleText, ['يعاقب', 'العقوبه', 'العقوبة', 'الحبس', 'الغرامه', 'الغرامة'])) score += 180;
    if (legalIntent.domain !== 'CRIMINAL' && includesAny(normalizedArticleText, ['اثر', 'الأثر', 'الاجراء', 'إجراء', 'لا يجوز', 'يجوز'])) score += 110;
  }

  if (legalIntent.goal === 'PROCEDURE' && includesAny(normalizedArticleText, ['اجراء', 'إجراء', 'طلب', 'يقدم', 'يجوز', 'لا يجوز'])) {
    score += 120;
  }

  if (legalIntent.goal === 'RIGHT' && includesAny(normalizedArticleText, ['حق', 'يحق', 'يجوز', 'لا يجوز'])) {
    score += 100;
  }

  return score;
}

function rankDatabaseContextArticles(params: {
  databaseLegalContextMeta: DatabaseLegalContextMeta;
  question: string;
  legalIntent: LegalIntent;
  output: LegalAiOutput;
}): string[] {
  const { databaseLegalContextMeta, question, legalIntent, output } = params;

  if (!databaseLegalContextMeta.articles.length) {
    return databaseLegalContextMeta.articleNumbers;
  }

  return databaseLegalContextMeta.articles
    .map((article, index) => ({
      articleNumber: article.articleNumber,
      index,
      score: scoreDatabaseContextArticleForQuestion({
        article,
        question,
        legalIntent,
        output,
      }),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.index - b.index;
    })
    .map((item) => item.articleNumber);
}

function selectPrimaryAndRelatedArticles(params: {
  output: LegalAiOutput;
  databaseLegalContextMeta: DatabaseLegalContextMeta;
  question: string;
  legalIntent: LegalIntent;
}) {
  const { output, databaseLegalContextMeta, question, legalIntent } = params;
  const allowedArticleNumbers = databaseLegalContextMeta.articleNumbers;
  const strictAllowedDirectArticleNumbers =
    getStrictAllowedArticleNumbersForDirectIntent(legalIntent);
  const effectiveAllowedArticleNumbers = strictAllowedDirectArticleNumbers.length
    ? allowedArticleNumbers.filter((articleNumber) =>
        strictAllowedDirectArticleNumbers.includes(articleNumber)
      )
    : allowedArticleNumbers;
  const rankedAllowedArticles = rankDatabaseContextArticles({
    databaseLegalContextMeta,
    question,
    legalIntent,
    output,
  }).filter((articleNumber) =>
    effectiveAllowedArticleNumbers.includes(articleNumber)
  );
  const overviewQuestion = isOverviewLegalSourceQuestion(question);

  if (!effectiveAllowedArticleNumbers.length) {
    const primaryArticles = keepOnlyStrictDirectIntentArticles(
      output.primaryArticles,
      legalIntent
    );
    const relatedArticles = keepOnlyStrictDirectIntentArticles(
      output.relatedArticles,
      legalIntent
    )
      .filter((articleNumber) => !primaryArticles.includes(articleNumber))
      .slice(0, 5);

    return {
      primaryArticles: primaryArticles.length
        ? primaryArticles
        : uniqueStrings(output.primaryArticles),
      relatedArticles: relatedArticles.length
        ? relatedArticles
        : uniqueStrings(output.relatedArticles).slice(0, 5),
      sourceArticles: keepOnlyStrictDirectIntentArticles(
        uniqueStrings([
          ...primaryArticles,
          ...relatedArticles,
          ...output.sourceArticles,
        ]),
        legalIntent
      ),
    };
  }

  const outputPrimary = keepOnlyAllowedArticles(
    output.primaryArticles,
    effectiveAllowedArticleNumbers
  );

  if (overviewQuestion) {
    const primaryArticles = outputPrimary.slice(0, 2);
    const relatedArticles = rankedAllowedArticles
      .filter((articleNumber) => !primaryArticles.includes(articleNumber))
      .slice(0, 5);

    return {
      primaryArticles,
      relatedArticles,
      sourceArticles: uniqueStrings([
        ...primaryArticles,
        ...relatedArticles,
        ...effectiveAllowedArticleNumbers,
      ]),
    };
  }

  const rankedOutputPrimary = rankedAllowedArticles.filter((articleNumber) =>
    outputPrimary.includes(articleNumber)
  );

  const candidatePrimary = uniqueStrings([
    ...rankedOutputPrimary,
    ...rankedAllowedArticles,
  ]);

  const primaryArticles = candidatePrimary.slice(
    0,
    legalIntent.goal === 'COMPARISON' ? 2 : 1
  );

  const outputRelated = keepOnlyAllowedArticles(
    output.relatedArticles,
    effectiveAllowedArticleNumbers
  );

  const relatedArticles = uniqueStrings([
    ...outputRelated,
    ...rankedAllowedArticles,
    ...keepOnlyAllowedArticles(output.sourceArticles, effectiveAllowedArticleNumbers),
  ])
    .filter((articleNumber) => !primaryArticles.includes(articleNumber))
    .slice(0, 5);

  const sourceArticles = uniqueStrings([
    ...primaryArticles,
    ...relatedArticles,
    ...keepOnlyAllowedArticles(output.sourceArticles, effectiveAllowedArticleNumbers),
  ]);

  return {
    primaryArticles,
    relatedArticles,
    sourceArticles: sourceArticles.length ? sourceArticles : effectiveAllowedArticleNumbers,
  };
}

function applyDatabaseSourceGuard(
  output: LegalAiOutput,
  params: {
    databaseLegalContextMeta: DatabaseLegalContextMeta;
    answerMode: AnswerMode;
    question: string;
    legalIntent: LegalIntent;
  }
): LegalAiOutput {
  const { databaseLegalContextMeta, answerMode, question, legalIntent } = params;

  if (!databaseLegalContextMeta.hasContext) {
    return output;
  }

  const allowedArticleNumbers = databaseLegalContextMeta.articleNumbers;
  const allowedSourceTitles = databaseLegalContextMeta.sourceTitles;

  const originalArticles = uniqueStrings([
    ...output.primaryArticles,
    ...output.relatedArticles,
    ...output.sourceArticles,
  ]);

  const { primaryArticles, relatedArticles, sourceArticles } =
    selectPrimaryAndRelatedArticles({
      output,
      databaseLegalContextMeta,
      question,
      legalIntent,
    });

  const safeSourceTitle = allowedSourceTitles.includes(output.sourceTitle)
    ? output.sourceTitle
    : allowedSourceTitles[0] || '';

  const hadForbiddenArticles = hasArticlesOutsideAllowedList(
    originalArticles,
    allowedArticleNumbers
  );

  const sourceConfidence: SourceConfidence =
    output.sourceConfidence === 'low' && sourceArticles.length > 0
      ? 'medium'
      : hadForbiddenArticles && output.sourceConfidence === 'high'
        ? 'medium'
        : output.sourceConfidence;

  const guardedSourceNote = hadForbiddenArticles
    ? buildModeAwareSourceNote({
        answerMode,
        hasLegalSource: sourceArticles.length > 0,
        originalNote:
          'تم استبعاد أي مواد غير موجودة في المصدر القانوني المسترجع، ويلزم التحقق من النصوص المسترجعة قبل الاعتماد النهائي على النتيجة.',
      })
    : output.sourceNote;

  const strictAllowedDirectArticleNumbers =
    getStrictAllowedArticleNumbersForDirectIntent(legalIntent);

  const finalPrimaryArticles = strictAllowedDirectArticleNumbers.length
    ? primaryArticles.filter((articleNumber) =>
        strictAllowedDirectArticleNumbers.includes(articleNumber)
      )
    : primaryArticles;

  const finalRelatedArticles = strictAllowedDirectArticleNumbers.length
    ? relatedArticles.filter((articleNumber) =>
        strictAllowedDirectArticleNumbers.includes(articleNumber)
      )
    : relatedArticles;

  const finalSourceArticles = strictAllowedDirectArticleNumbers.length
    ? sourceArticles.filter((articleNumber) =>
        strictAllowedDirectArticleNumbers.includes(articleNumber)
      )
    : sourceArticles;

  return {
    ...output,
    sourceTitle: safeSourceTitle,
    sourceArticles: uniqueStrings(finalSourceArticles),
    primaryArticles: uniqueStrings(finalPrimaryArticles),
    relatedArticles: uniqueStrings(finalRelatedArticles).filter(
      (articleNumber) => !finalPrimaryArticles.includes(articleNumber)
    ),
    sourceConfidence,
    sourceNote: shortenSourceNote(guardedSourceNote),
  };
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

function extractArticleNumbers(text: string): string[] {
  const articleNumbers: string[] = [];

  const singleArticleMatches = text.matchAll(/المادة\s+(\d+)/g);
  for (const match of singleArticleMatches) {
    articleNumbers.push(match[1]);
  }

  const groupedArticleMatches = text.matchAll(
    /(?:المواد|المادتين)\s*(?:ذات\s+العلاقة)?\s*[:：]?\s*([\d\s،,و]+)/g
  );

  for (const match of groupedArticleMatches) {
    const numbers = match[1].match(/\d+/g) || [];
    articleNumbers.push(...numbers);
  }

  return uniqueStrings(articleNumbers);
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

function includesAny(text: string, terms: string[]): boolean {
  return terms.some((term) => text.includes(term));
}

function detectRequestedLegalSource(question: string): RequestedLegalSource | null {
  const normalizedQuestion = normalizeArabicForSearch(question);

  const sourceDefinitions: RequestedLegalSource[] = [
    {
      key: 'JORDAN_CONSTITUTION',
      titleHint: 'الدستور الأردني',
      keywords: ['الدستور', 'دستور', 'دستوري', 'الدستوري'],
      strict: true,
    },
    {
      key: 'JORDAN_EXECUTION_LAW',
      titleHint: 'قانون التنفيذ الأردني',
      keywords: [
        'قانون التنفيذ',
        'التنفيذ',
        'حبس المدين',
        'الحبس التنفيذي',
        'السند التنفيذي',
        'دائره التنفيذ',
        'دائرة التنفيذ',
      ],
      strict: true,
    },
    {
      key: 'JORDAN_CIVIL_PROCEDURE',
      titleHint: 'قانون أصول المحاكمات المدنية الأردني',
      keywords: [
        'اصول المحاكمات',
        'أصول المحاكمات',
        'محاكمات مدنيه',
        'محاكمات مدنية',
        'الاستئناف',
        'التمييز',
        'التبليغ',
        'اعتراض الغير',
        'اعاده المحاكمه',
        'إعادة المحاكمة',
      ],
      strict: true,
    },
    {
      key: 'JORDAN_CRIMINAL_LAW',
      titleHint: 'قانون العقوبات الأردني',
      keywords: [
        'قانون العقوبات',
        'العقوبات',
        'جرم',
        'جريمه',
        'جريمة',
        'جزاء جزائي',
        'احتيال',
        'الاحتيال',
        'طرق احتيالية',
        'نصب',
        'سرقه',
        'سرقة',
        'السرقه',
        'السرقة',
        'سرقات',
        'نشل',
      ],
      strict: true,
    },
    {
      key: 'JORDAN_COMMERCIAL_LAW',
      titleHint: 'قانون التجارة الأردني',
      keywords: ['قانون التجاره', 'قانون التجارة', 'كمبياله', 'كمبيالة', 'شيك', 'سند لامر', 'سند لأمر'],
      strict: false,
    },
    {
      key: 'JORDAN_LABOR_LAW',
      titleHint: 'قانون العمل الأردني',
      keywords: ['قانون العمل', 'عامل', 'عمال', 'موظف', 'راتب', 'اجور', 'أجور'],
      strict: true,
    },
  ];

  const matchedSource = sourceDefinitions.find((definition) =>
    includesAny(
      normalizedQuestion,
      definition.keywords.map((keyword) => normalizeArabicForSearch(keyword))
    )
  );

  return matchedSource || null;
}

function detectLegalDomain(
  question: string,
  requestedSource: RequestedLegalSource | null
): LegalDomain {
  const normalizedQuestion = normalizeArabicForSearch(question);
  const requestedKey = requestedSource?.key || '';

  if (requestedKey.includes('CONSTITUTION')) return 'CONSTITUTIONAL';
  if (requestedKey.includes('EXECUTION')) return 'EXECUTION';
  if (requestedKey.includes('CIVIL_PROCEDURE')) return 'CIVIL_PROCEDURE';
  if (requestedKey.includes('CRIMINAL')) return 'CRIMINAL';
  if (requestedKey.includes('COMMERCIAL')) return 'COMMERCIAL';
  if (requestedKey.includes('LABOR')) return 'LABOR';

  if (includesAny(normalizedQuestion, ['الدستور', 'دستوري'])) {
    return 'CONSTITUTIONAL';
  }

  if (
    includesAny(normalizedQuestion, [
      'التنفيذ',
      'دائره التنفيذ',
      'دائرة التنفيذ',
      'الحبس التنفيذي',
      'حبس المدين',
      'سند تنفيذي',
      'السند التنفيذي',
      'حجز',
      'دائن',
      'مدين',
    ])
  ) {
    return 'EXECUTION';
  }

  if (
    includesAny(normalizedQuestion, [
      'استئناف',
      'تمييز',
      'تبليغ',
      'محاكمات',
      'اعتراض الغير',
      'اعاده المحاكمه',
      'إعادة المحاكمة',
      'الدعوى',
      'لائحه',
      'لائحة',
    ])
  ) {
    return 'CIVIL_PROCEDURE';
  }

  if (
    includesAny(normalizedQuestion, [
      'جريمه',
      'جريمة',
      'عقوبه جزائيه',
      'عقوبة جزائية',
      'حبس جزائي',
      'سجن',
      'جنحه',
      'جناية',
      'قانون العقوبات',
      'احتيال',
      'الاحتيال',
      'احتياليه',
      'احتيالية',
      'نصب',
      'سرقه',
      'سرقة',
      'السرقه',
      'السرقة',
      'سرقات',
      'نشل',
    ])
  ) {
    return 'CRIMINAL';
  }

  if (
    includesAny(normalizedQuestion, [
      'كمبياله',
      'كمبيالة',
      'شيك',
      'سند لامر',
      'سند لأمر',
      'تاجر',
      'شركه',
      'شركة',
      'تجاري',
      'تجاره',
      'تجارة',
    ])
  ) {
    return 'COMMERCIAL';
  }

  if (
    includesAny(normalizedQuestion, [
      'عمل',
      'عامل',
      'موظف',
      'راتب',
      'اجور',
      'أجور',
      'فصل تعسفي',
      'عقد العمل',
    ])
  ) {
    return 'LABOR';
  }

  if (
    includesAny(normalizedQuestion, [
      'نفقه',
      'نفقة',
      'طلاق',
      'حضانة',
      'حضانه',
      'ميراث',
      'ارث',
      'إرث',
    ])
  ) {
    return 'FAMILY';
  }

  if (
    includesAny(normalizedQuestion, [
      'قرار اداري',
      'قرار إداري',
      'اداره',
      'إدارة',
      'موظف عام',
      'جهة حكومية',
      'حكوميه',
      'حكومية',
    ])
  ) {
    return 'ADMINISTRATIVE';
  }

  if (
    includesAny(normalizedQuestion, [
      'عقد',
      'اتفاقيه',
      'اتفاقية',
      'شرط جزائي',
      'اخلال',
      'إخلال',
      'التزام تعاقدي',
    ])
  ) {
    return 'CONTRACTS';
  }

  return 'GENERAL';
}

function detectLegalQuestionGoal(question: string): LegalQuestionGoal {
  const normalizedQuestion = normalizeArabicForSearch(question);

  if (
    includesAny(normalizedQuestion, [
      'عقوبه',
      'عقوبة',
      'جزاء',
      'ما عقوبتها',
      'ينحبس',
      'حبس',
      'سجن',
    ])
  ) {
    return 'PENALTY';
  }

  if (
    includesAny(normalizedQuestion, [
      'مده',
      'مدة',
      'ميعاد',
      'موعد',
      'اخر يوم',
      'آخر يوم',
      'فوات',
      'انقضاء',
      'كم يوم',
    ])
  ) {
    return 'DEADLINE';
  }

  if (
    includesAny(normalizedQuestion, [
      'اجراء',
      'إجراء',
      'كيف',
      'ماذا افعل',
      'شو اعمل',
      'اتصرف',
      'ارفع',
      'اطعن',
      'انفذ',
      'تنفيذ',
      'حجز',
    ])
  ) {
    return 'PROCEDURE';
  }

  if (
    includesAny(normalizedQuestion, [
      'اثره',
      'أثره',
      'الاثر',
      'الأثر',
      'نتيجه',
      'نتيجة',
      'ماذا يترتب',
      'يترتب',
    ])
  ) {
    return 'CONSEQUENCE';
  }

  if (
    includesAny(normalizedQuestion, [
      'حقي',
      'حق',
      'يحق لي',
      'يجوز لي',
      'استطيع',
      'أستطيع',
    ])
  ) {
    return 'RIGHT';
  }

  if (
    includesAny(normalizedQuestion, [
      'التزام',
      'واجب',
      'يلتزم',
      'مسؤوليه',
      'مسؤولية',
    ])
  ) {
    return 'OBLIGATION';
  }

  if (
    includesAny(normalizedQuestion, [
      'مذكره',
      'مذكرة',
      'لائحه',
      'لائحة',
      'صياغه',
      'صياغة',
      'اكتب',
    ])
  ) {
    return includesAny(normalizedQuestion, ['مذكره', 'مذكرة'])
      ? 'MEMO'
      : 'DRAFTING';
  }

  if (
    includesAny(normalizedQuestion, [
      'اشرح',
      'ما معنى',
      'ما هو',
      'ما هي',
      'عرف',
      'تعريف',
    ])
  ) {
    return 'EXPLANATION';
  }

  if (
    includesAny(normalizedQuestion, [
      'الفرق',
      'قارن',
      'مقارنة',
      'مقارنه',
    ])
  ) {
    return 'COMPARISON';
  }

  return 'GENERAL';
}

function buildLegalDistinctions(params: {
  question: string;
  domain: LegalDomain;
  goal: LegalQuestionGoal;
}): LegalDistinctionType[] {
  const normalizedQuestion = normalizeArabicForSearch(params.question);
  const distinctions: LegalDistinctionType[] = [];

  if (params.goal === 'PENALTY' && params.domain !== 'CRIMINAL') {
    distinctions.push('CRIMINAL_PENALTY_VS_LEGAL_EFFECT');
  }

  if (params.goal === 'PENALTY' && params.domain === 'EXECUTION') {
    distinctions.push('CRIMINAL_PENALTY_VS_EXECUTION_PROCEDURE');
  }

  if (params.goal === 'DEADLINE') {
    distinctions.push('PROCEDURAL_DEADLINE_VS_SUBSTANTIVE_RIGHT');
  }

  if (
    includesAny(normalizedQuestion, [
      'التزام تعاقدي',
      'عقد',
      'كمبياله',
      'كمبيالة',
      'دين',
      'وفاء',
    ])
  ) {
    distinctions.push('CONTRACTUAL_OBLIGATION_VS_STATUTORY_DUTY');
  }

  if (
    includesAny(normalizedQuestion, [
      'كمبياله',
      'كمبيالة',
      'شيك',
      'سند لامر',
      'سند لأمر',
    ]) &&
    includesAny(normalizedQuestion, ['رصيد', 'بدون رصيد'])
  ) {
    distinctions.push('NEGOTIABLE_INSTRUMENT_TYPE_AMBIGUITY');
  }

  if (
    includesAny(normalizedQuestion, [
      'حبس المدين',
      'ينحبس',
      'الحبس التنفيذي',
      'عجز',
      'امتنع',
      'امتناع',
      'عدم الوفاء',
      'الوفاء',
    ])
  ) {
    distinctions.push('ABILITY_TO_PAY_VS_REFUSAL_TO_PAY');
  }

  return uniqueStrings(distinctions) as LegalDistinctionType[];
}

function getLegalIntentSearchHints(params: {
  question: string;
  domain: LegalDomain;
  goal: LegalQuestionGoal;
  distinctions: LegalDistinctionType[];
}): string[] {
  const hints: string[] = [];

  if (params.domain === 'EXECUTION') {
    hints.push(
      'تنفيذ',
      'دائرة التنفيذ',
      'السند التنفيذي',
      'الدائن',
      'المدين',
      'حبس المدين',
      'الحبس التنفيذي',
      'الوفاء',
      'عجز عن الوفاء',
      'التزام تعاقدي',
      'حجز'
    );
  }

  if (params.domain === 'CIVIL_PROCEDURE') {
    hints.push(
      'ميعاد',
      'مدة',
      'استئناف',
      'تمييز',
      'تبليغ',
      'إعادة المحاكمة',
      'اعتراض الغير',
      'رد شكلا'
    );
  }

  if (params.domain === 'CONSTITUTIONAL') {
    hints.push('الدستور', 'الحقوق', 'الحريات', 'المساواة', 'السلطات');
  }

  if (params.domain === 'COMMERCIAL') {
    hints.push('كمبيالة', 'شيك', 'سند لأمر', 'ورقة تجارية', 'التزام تجاري');
  }

  if (params.domain === 'CRIMINAL') {
    hints.push(
      'قانون العقوبات',
      'يعاقب',
      'عقوبة',
      'الحبس',
      'الغرامة',
      'جنحة',
      'جناية'
    );
  }

  if (isFraudPenaltyQuestion(params.question)) {
    hints.push(
      'احتيال',
      'الاحتيال',
      'طرق احتيالية',
      'نصب',
      'حمل الغير',
      'تسليمه مالا',
      'اتخاذ اسم كاذب',
      'صفة غير صحيحة'
    );
  }

  if (isTheftQuestion(params.question)) {
    hints.push(
      'سرقة',
      'السرقة',
      'أخذ مال الغير',
      'دون رضاه',
      'ليل',
      'ليلاً',
      'منزل',
      'مكان مأهول',
      'السرقة بالخلع والكسر',
      'عقوبة السرقة',
      'الحبس من سنة إلى ثلاث سنوات'
    );
  }

  if (params.goal === 'PENALTY') {
    hints.push('عقوبة', 'جزاء', 'أثر قانوني', 'مسؤولية', 'حبس');
  }

  if (params.goal === 'DEADLINE') {
    hints.push('مدة', 'ميعاد', 'آخر موعد', 'فوات الميعاد', 'احتساب المدة');
  }

  if (
    params.distinctions.includes('CRIMINAL_PENALTY_VS_EXECUTION_PROCEDURE')
  ) {
    hints.push('إجراء تنفيذي', 'ليس عقوبة جزائية', 'تحصيل الدين');
  }

  if (params.distinctions.includes('ABILITY_TO_PAY_VS_REFUSAL_TO_PAY')) {
    hints.push('عجز عن الوفاء', 'امتناع عن الوفاء', 'مقدرة على السداد');
  }

  return tokenizeLegalSearchText(hints.join(' '));
}

function isFraudPenaltyQuestion(question: string): boolean {
  const normalizedQuestion = normalizeArabicForSearch(question);

  const mentionsFraud = includesAny(normalizedQuestion, [
    'احتيال',
    'الاحتيال',
    'احتياليه',
    'احتيالية',
    'طرق احتياليه',
    'طرق احتيالية',
    'نصب',
  ]);

  const mentionsPenaltyOrCriminalLaw = includesAny(normalizedQuestion, [
    'عقوبه',
    'عقوبة',
    'جزاء',
    'يعاقب',
    'الحبس',
    'حبس',
    'غرامه',
    'غرامة',
    'قانون العقوبات',
    'العقوبات',
    'جريمه',
    'جريمة',
    'جنحه',
    'جنحة',
    'جناية',
  ]);

  return mentionsFraud && mentionsPenaltyOrCriminalLaw;
}

function isTheftQuestion(question: string): boolean {
  const normalizedQuestion = normalizeArabicForSearch(question);

  return includesAny(normalizedQuestion, [
    'سرقه',
    'سرقة',
    'السرقه',
    'السرقة',
    'سرقات',
    'السارق',
    'سارق',
    'نشل',
    'الاخذ',
    'اخذ مال الغير',
    'مقتنيات',
    'مسروقات',
  ]);
}

function hasNightTheftContext(question: string): boolean {
  const normalizedQuestion = normalizeArabicForSearch(question);

  return includesAny(normalizedQuestion, [
    'ليلا',
    'ليل',
    'بالليل',
    'اثناء الليل',
    'أثناء الليل',
    'ظرف الليل',
  ]);
}

function hasHomeOrInhabitedPlaceTheftContext(question: string): boolean {
  const normalizedQuestion = normalizeArabicForSearch(question);

  return includesAny(normalizedQuestion, [
    'منزل',
    'المنزل',
    'بيت',
    'البيت',
    'مسكن',
    'المسكن',
    'مكان ماهول',
    'مكان مأهول',
    'مكان للسكن',
    'شقه',
    'شقة',
    'دار',
  ]);
}

function hasBreakingOrForcedEntryTheftContext(question: string): boolean {
  const normalizedQuestion = normalizeArabicForSearch(question);

  return includesAny(normalizedQuestion, [
    'كسر',
    'بالكسر',
    'خلع',
    'بالخلع',
    'نقب',
    'تسلق',
    'تسور',
    'كسر الباب',
    'كسر الشباك',
    'فتحها باله',
    'آلة مخصوصة',
    'اله مخصوصه',
    'مفتاح مصطنع',
    'مفاتيح مصطنعه',
  ]);
}

function hasMultipleWeaponOrViolenceTheftContext(question: string): boolean {
  const normalizedQuestion = normalizeArabicForSearch(question);

  return includesAny(normalizedQuestion, [
    'شخصين',
    'اكثر من شخص',
    'أكثر من شخص',
    'بالاشتراك',
    'مشتركين',
    'سلاح',
    'مسلح',
    'تهديد',
    'هدد',
    'عنف',
    'ضرب',
    'جروح',
    'رضوض',
  ]);
}

function getTheftArticlePriority(question: string): string[] {
  const priority: string[] = [];
  const night = hasNightTheftContext(question);
  const homeOrInhabited = hasHomeOrInhabitedPlaceTheftContext(question);
  const breaking = hasBreakingOrForcedEntryTheftContext(question);
  const weaponOrViolenceOrMultiple = hasMultipleWeaponOrViolenceTheftContext(question);

  if (breaking) {
    priority.push('404');
  }

  if (night && homeOrInhabited) {
    priority.push('406');
  }

  if (weaponOrViolenceOrMultiple && night) {
    priority.push('401', '400');
  }

  if (weaponOrViolenceOrMultiple) {
    priority.push('401');
  }

  priority.push('399');

  if (!priority.includes('407')) {
    priority.push('407');
  }

  return uniqueStrings([
    ...priority,
    '400',
    '401',
    '402',
    '403',
    '404',
    '405',
    '406',
  ]);
}

function isTheftPenaltyQuestion(question: string): boolean {
  return isTheftQuestion(question);
}

function getStrictAllowedArticleNumbersForDirectIntent(
  legalIntent: LegalIntent
): string[] {
  const hasFraudArticleResolver = legalIntent.directArticleHints.some(
    (hint) => hint.key === 'JORDAN_PENAL_CODE_FRAUD_ARTICLE_417'
  );

  const hasTheftArticleResolver = legalIntent.directArticleHints.some((hint) =>
    hint.key.startsWith('JORDAN_PENAL_CODE_THEFT_')
  );

  if (hasFraudArticleResolver) {
    return ['417', '240', '419', '438', '439'];
  }

  if (hasTheftArticleResolver) {
    return ['407', '399', '400', '401', '402', '403', '404', '405', '406'];
  }

  return [];
}

function keepOnlyStrictDirectIntentArticles(
  articleNumbers: string[],
  legalIntent: LegalIntent
): string[] {
  const strictAllowedArticleNumbers = getStrictAllowedArticleNumbersForDirectIntent(
    legalIntent
  );

  if (!strictAllowedArticleNumbers.length) {
    return uniqueStrings(articleNumbers);
  }

  const strictAllowedSet = new Set(strictAllowedArticleNumbers);

  return uniqueStrings(articleNumbers).filter((articleNumber) =>
    strictAllowedSet.has(articleNumber)
  );
}

function detectDirectLegalArticleHints(params: {
  question: string;
  country?: string | null;
  domain: LegalDomain;
  goal: LegalQuestionGoal;
  requestedSource: RequestedLegalSource | null;
}): DirectLegalArticleHint[] {
  const hints: DirectLegalArticleHint[] = [];

  if (
    isJordan(params.country) &&
    isFraudPenaltyQuestion(params.question) &&
    (params.domain === 'CRIMINAL' ||
      params.goal === 'PENALTY' ||
      params.requestedSource?.key === 'JORDAN_CRIMINAL_LAW')
  ) {
    hints.push({
      key: 'JORDAN_PENAL_CODE_FRAUD_ARTICLE_417',
      sourceKey: 'JORDAN_CRIMINAL_LAW',
      sourceTitleHint: 'قانون العقوبات الأردني',
      articleNumber: '417',
      labelAr: 'جريمة الاحتيال',
      reason:
        'السؤال يتحدث عن عقوبة الاحتيال في قانون العقوبات الأردني، والمادة المباشرة المتوقعة هي المادة 417.',
      keywords: [
        'احتيال',
        'الاحتيال',
        'طرق احتيالية',
        'نصب',
        'حمل الغير',
        'تسليمه مالا',
        'سند دين غير صحيح',
        'اتخاذ اسم كاذب',
        'صفة غير صحيحة',
        'يعاقب بالحبس',
        'الغرامة',
      ],
    });
  }

  if (isJordan(params.country) && isTheftPenaltyQuestion(params.question)) {
    const theftArticlePriority = getTheftArticlePriority(params.question);

    for (const articleNumber of theftArticlePriority) {
      if (articleNumber === '406') {
        hints.push({
          key: 'JORDAN_PENAL_CODE_THEFT_NIGHT_HOME_406',
          sourceKey: 'JORDAN_CRIMINAL_LAW',
          sourceTitleHint: 'قانون العقوبات الأردني',
          articleNumber: '406',
          labelAr: 'السرقة ليلاً في مكان مأهول أو مكان للعبادة',
          reason:
            'السؤال يتحدث عن دخول ليلاً إلى منزل أو مكان مأهول وسرقة مقتنيات؛ المادة 406 هي المرشح المباشر لهذا الظرف عند عدم ذكر كسر أو سلاح أو عنف أو تعدد فاعلين.',
          keywords: [
            'الوقت ليلا',
            'الوقت ليلاً',
            'السارق واحدا',
            'السارق واحداً',
            'مكان ماهول',
            'مكان مأهول',
            'مكان للعباده',
            'مكان للعبادة',
            'الحبس من سنه الى ثلاث سنوات',
            'الحبس من سنة إلى ثلاث سنوات',
          ],
        });
      }

      if (articleNumber === '404') {
        hints.push({
          key: 'JORDAN_PENAL_CODE_THEFT_BREAKING_404',
          sourceKey: 'JORDAN_CRIMINAL_LAW',
          sourceTitleHint: 'قانون العقوبات الأردني',
          articleNumber: '404',
          labelAr: 'السرقة بالخلع أو الكسر',
          reason:
            'إذا تضمنت الواقعة خلعاً أو كسراً أو تسلقاً أو فتحاً بآلة مخصوصة، فالمادة 404 تصبح من المواد المباشرة في توصيف السرقة.',
          keywords: [
            'السرقة بالخلع والكسر',
            'نقب حائطها',
            'تسلقه',
            'كسر بابها',
            'كسر شباكها',
            'آلة مخصوصة',
            'مفاتيح مصطنعة',
            'أماكن مقفلة',
          ],
        });
      }

      if (articleNumber === '401') {
        hints.push({
          key: 'JORDAN_PENAL_CODE_THEFT_AGGRAVATED_401',
          sourceKey: 'JORDAN_CRIMINAL_LAW',
          sourceTitleHint: 'قانون العقوبات الأردني',
          articleNumber: '401',
          labelAr: 'السرقة المقترنة بظروف مشددة',
          reason:
            'إذا اقترنت السرقة بظروف مثل الليل وتعدد الفاعلين والسلاح أو العنف، فالمادة 401 تكون من مواد السرقة المشددة ذات الصلة.',
          keywords: [
            'تقع السرقة ليلا',
            'تقع السرقة ليلاً',
            'بفعل شخصين او اكثر',
            'بفعل شخصين أو أكثر',
            'السلاح',
            'العنف',
            'الاشغال الشاقة المؤقتة',
          ],
        });
      }
    }

    hints.push(
      {
        key: 'JORDAN_PENAL_CODE_THEFT_DEFINITION_399',
        sourceKey: 'JORDAN_CRIMINAL_LAW',
        sourceTitleHint: 'قانون العقوبات الأردني',
        articleNumber: '399',
        labelAr: 'تعريف السرقة',
        reason:
          'المادة 399 هي مادة تعريف السرقة ويجب استحضارها عند السؤال عن واقعة سرقة حتى لا يتم ربط السؤال بمواد عامة بعيدة.',
        keywords: [
          'سرقة',
          'السرقة',
          'سرقه',
          'السرقه',
          'أخذ مال الغير',
          'اخذ مال الغير',
          'مال الغير المنقول',
          'دون رضاه',
          'أخذ المال',
          'اخذ المال',
        ],
      },
      {
        key: 'JORDAN_PENAL_CODE_SIMPLE_THEFT_PENALTY_407',
        sourceKey: 'JORDAN_CRIMINAL_LAW',
        sourceTitleHint: 'قانون العقوبات الأردني',
        articleNumber: '407',
        labelAr: 'عقوبة السرقة البسيطة',
        reason:
          'المادة 407 تبقى مرجعاً احتياطياً للسرقة البسيطة إذا لم تثبت الظروف المشددة الخاصة كالدخول ليلاً إلى مكان مأهول أو الخلع والكسر أو العنف والسلاح.',
        keywords: [
          'سرقة',
          'السرقة',
          'سرقه',
          'السرقه',
          'سرقات',
          'نشل',
          'يعاقب',
          'الحبس',
          'من غير السرقات المبينة',
          'الأخذ',
        ],
      }
    );
  }

  return hints;
}

function detectLegalIntent(question: string, country?: string | null): LegalIntent {
  const requestedSource = detectRequestedLegalSource(question);
  const domain = detectLegalDomain(question, requestedSource);
  const goal = detectLegalQuestionGoal(question);
  const distinctions = buildLegalDistinctions({ question, domain, goal });
  const directArticleHints = detectDirectLegalArticleHints({
    question,
    country,
    domain,
    goal,
    requestedSource,
  });
  const searchHints = uniqueStrings([
    ...getLegalIntentSearchHints({
      question,
      domain,
      goal,
      distinctions,
    }),
    ...directArticleHints.flatMap((hint) => hint.keywords),
  ]);

  return {
    domain,
    goal,
    requestedSource,
    requiresDistinction: distinctions.length > 0,
    distinctions,
    searchHints,
    directArticleHints,
  };
}

function buildLegalIntentPrompt(intent: LegalIntent): string {
  const requestedSourceText = intent.requestedSource
    ? `${intent.requestedSource.titleHint} (${
        intent.requestedSource.strict
          ? 'strict source requested'
          : 'related source hint'
      })`
    : 'غير محدد';

  const distinctionMap: Record<LegalDistinctionType, string> = {
    CRIMINAL_PENALTY_VS_LEGAL_EFFECT:
      'The user may be using "عقوبة" broadly; distinguish criminal penalty from civil/procedural/administrative legal effect.',
    CRIMINAL_PENALTY_VS_EXECUTION_PROCEDURE:
      'If the selected source is execution law, explain that execution law regulates enforcement measures, not criminal punishment, unless a criminal law source is retrieved.',
    PROCEDURAL_DEADLINE_VS_SUBSTANTIVE_RIGHT:
      'Distinguish procedural deadline from the underlying substantive right and be careful with missing dates.',
    CONTRACTUAL_OBLIGATION_VS_STATUTORY_DUTY:
      'Distinguish contractual obligation from statutory duty and state whether the retrieved text treats them differently.',
    NEGOTIABLE_INSTRUMENT_TYPE_AMBIGUITY:
      'The user may be mixing different negotiable instruments; do not treat a bill of exchange, cheque, or promissory note as identical unless the retrieved law supports it.',
    ABILITY_TO_PAY_VS_REFUSAL_TO_PAY:
      'Distinguish inability to pay from refusal despite ability when the retrieved legal text makes that distinction relevant.',
  };

  return [
    'Detected legal intent:',
    `- Domain: ${intent.domain}`,
    `- Goal: ${intent.goal}`,
    `- Requested source: ${requestedSourceText}`,
    `- Requires legal distinction: ${intent.requiresDistinction ? 'yes' : 'no'}`,
    ...(intent.directArticleHints.length
      ? [
          '- Direct article resolver hints:',
          ...intent.directArticleHints.map(
            (hint) =>
              `  - ${hint.labelAr}: use article ${hint.articleNumber} from ${hint.sourceTitleHint} as the primary article when it appears in the Hukumx database context. Reason: ${hint.reason}`
          ),
        ]
      : []),
    ...(intent.distinctions.length
      ? [
          '- Required distinctions:',
          ...intent.distinctions.map(
            (distinction) => `  - ${distinctionMap[distinction]}`
          ),
        ]
      : []),
    ...(intent.searchHints.length
      ? [`- Search hints used internally: ${intent.searchHints.join(', ')}`]
      : []),
  ].join('\n');
}

function sourceMatchesRequestedSource(
  sourceText: string,
  requestedSource: RequestedLegalSource | null
): boolean {
  if (!requestedSource) return false;

  return requestedSource.keywords
    .map((keyword) => normalizeArabicForSearch(keyword))
    .some((keyword) => sourceText.includes(keyword));
}

function buildModeAwareWarning(params: {
  answerMode: AnswerMode;
  timingSensitive: boolean;
}): string {
  const policy = getAnswerModePolicy(params.answerMode);

  if (policy.warningStyle === 'professional') {
    return params.timingSensitive
      ? 'تنبيه مهني: لا يمكن الجزم بالمدد أو صحة الإجراء دون التحقق من تاريخ الحكم أو التبليغ ونوع الحكم والنص الساري والوقائع والمستندات.'
      : 'تنبيه مهني: النتيجة أدناه أولية ومقيدة بالنصوص المسترجعة والوقائع المعروضة، ويلزم التحقق من المستندات والنص الساري قبل اعتماد أي إجراء.';
  }

  if (policy.warningStyle === 'judicial') {
    return params.timingSensitive
      ? 'تنبيه منهجي: تقدير المدد وصحة الإجراء يبقى مرتبطًا بتاريخ التبليغ ونوع الحكم والنص الواجب التطبيق والوقائع الثابتة في الملف.'
      : 'تنبيه منهجي: العرض أدناه مقيد بالنصوص المسترجعة ولا يغني عن وزن الوقائع والمستندات ضمن الملف.';
  }

  if (policy.warningStyle === 'educational') {
    return 'تنبيه تعليمي: هذا الشرح للتعلّم وفهم الفكرة القانونية، وليس رأيًا نهائيًا على واقعة عملية كاملة.';
  }

  if (policy.warningStyle === 'business') {
    return 'تنبيه تجاري: قبل اتخاذ قرار مالي أو تعاقدي، يجب مطابقة النتيجة مع المستندات الفعلية والنصوص السارية ومخاطر التنفيذ.';
  }

  if (policy.warningStyle === 'administrative') {
    return 'تنبيه إداري: يجب مطابقة النتيجة مع الصلاحيات والإجراءات الداخلية والنصوص السارية قبل اتخاذ أي قرار رسمي.';
  }

  return params.timingSensitive
    ? 'تنبيه مهم: لا يمكن الجزم بالمدد أو سقوط الحق أو صحة الإجراء من دون التحقق من تاريخ الحكم، وتاريخ التبليغ، ونوع الحكم، والنص القانوني المنطبق؛ لذلك يُفضّل أخذ رأي قانوني قبل اتخاذ أي إجراء.'
    : 'تنبيه مهم: هذه إجابة معلوماتية مبنية على النصوص المتاحة، ولا يجوز الاعتماد عليها وحدها كقرار قانوني نهائي.';
}

function sanitizeTextForAnswerMode(text: string, answerMode: AnswerMode): string {
  let sanitizedText = text || '';

  const broadLawyerReviewPattern =
    /(?:هذه\s+الإجابة\s+[^.\n]*?ولا\s+تغني\s+عن\s+)?(?:مراجعة|مراجعه|استشارة|استشاره|راجع|استشر|ينصح\s+بمراجعة|يجب\s+مراجعة|لا\s+تغني\s+عن\s+مراجعة)\s+(?:محام(?:ٍ|ي)?|محامي|محامى)(?:\s+مختص)?(?:\s+[^.\n]*)?/g;

  const lawyerReviewPhrases = [
    /يجب\s+مراجعة\s+محام(?:[ٍي])?\s+مختص(?:\s+قبل\s+اتخاذ\s+أي\s+إجراء)?/g,
    /يجب\s+مراجعة\s+محامي\s+مختص(?:\s+قبل\s+اتخاذ\s+أي\s+إجراء)?/g,
    /ينصح\s+بمراجعة\s+محام(?:[ٍي])?\s+مختص/g,
    /ينصح\s+بمراجعة\s+محامي\s+مختص/g,
    /لا\s+تغني\s+عن\s+مراجعة\s+محام(?:[ٍي])?\s+مختص/g,
    /لا\s+تغني\s+عن\s+مراجعة\s+محامي\s+مختص/g,
    /ولا\s+تغني\s+عن\s+مراجعة\s+محام(?:[ٍي])?\s+مختص/g,
    /ولا\s+تغني\s+عن\s+مراجعة\s+محامي\s+مختص/g,
    /مراجعة\s+محام(?:[ٍي])?\s+مختص/g,
    /مراجعة\s+محامي\s+مختص/g,
    /راجع\s+محام(?:[ٍي])?\s+مختص/g,
    /راجع\s+محامي\s+مختص/g,
    /استشارة\s+محام(?:[ٍي])?\s+مختص/g,
    /استشارة\s+محامي\s+مختص/g,
    /استشر\s+محام(?:[ٍي])?\s+مختص/g,
    /استشر\s+محامي\s+مختص/g,
  ];

  if (answerMode === 'LAWYER') {
    sanitizedText = sanitizedText.replace(
      broadLawyerReviewPattern,
      'التحقق المهني من الوقائع والمستندات والنص الساري'
    );

    for (const pattern of lawyerReviewPhrases) {
      sanitizedText = sanitizedText.replace(
        pattern,
        'التحقق المهني من الوقائع والمستندات والنص الساري'
      );
    }

    sanitizedText = sanitizedText
      .replace(/محام(?:[ٍي])?\s+مختص/g, 'قانوني متخصص')
      .replace(/محامي\s+مختص/g, 'قانوني متخصص');
  }

  if (answerMode === 'JUDGE') {
    sanitizedText = sanitizedText.replace(
      broadLawyerReviewPattern,
      'استكمال التحقق من الوقائع والنصوص ضمن الملف'
    );

    for (const pattern of lawyerReviewPhrases) {
      sanitizedText = sanitizedText.replace(
        pattern,
        'استكمال التحقق من الوقائع والنصوص ضمن الملف'
      );
    }

    sanitizedText = sanitizedText
      .replace(/محام(?:[ٍي])?\s+مختص/g, 'جهة قانونية مختصة')
      .replace(/محامي\s+مختص/g, 'جهة قانونية مختصة');
  }

  return sanitizedText;
}

function buildModeAwareSourceNote(params: {
  answerMode: AnswerMode;
  hasLegalSource: boolean;
  originalNote?: string | null;
}): string {
  const cleanedOriginal = sanitizeTextForAnswerMode(
    params.originalNote || '',
    params.answerMode
  ).trim();

  if (params.answerMode === 'LAWYER') {
    return params.hasLegalSource
      ? 'الإجابة مستندة إلى النصوص القانونية المسترجعة، وتبقى مقيدة بالوقائع والمستندات والنص الساري وقت التطبيق.'
      : 'لم يتم العثور على سند قانوني مباشر كافٍ ضمن المصادر المسترجعة، ويلزم استكمال البحث في النصوص السارية قبل اعتماد الإجراء.';
  }

  if (params.answerMode === 'JUDGE') {
    return params.hasLegalSource
      ? 'العرض مستند إلى النصوص القانونية المسترجعة، ويبقى تقدير التطبيق مرتبطًا بوقائع الملف والنص الواجب التطبيق.'
      : 'لم يظهر سند قانوني مباشر كافٍ ضمن المصادر المسترجعة، ويبقى الحسم مرتبطًا باستكمال النصوص والوقائع ذات الصلة.';
  }

  if (params.answerMode === 'LAW_STUDENT') {
    return params.hasLegalSource
      ? 'الشرح مستند إلى النصوص القانونية المتاحة، وهو مخصص لفهم الفكرة وليس لإصدار رأي عملي نهائي.'
      : 'لم يتم العثور على نص مباشر كافٍ، لذلك يبقى الشرح تعليميًا عامًا ويحتاج إلى ربطه بالنصوص السارية.';
  }

  if (params.answerMode === 'BUSINESS') {
    return params.hasLegalSource
      ? 'الإجابة مستندة إلى النصوص القانونية المتاحة، ويجب مطابقتها مع المستندات والمخاطر التجارية قبل اتخاذ القرار.'
      : 'لم يتم العثور على سند قانوني مباشر كافٍ، لذلك يجب استكمال التحقق القانوني قبل أي قرار مالي أو تعاقدي.';
  }

  if (params.answerMode === 'GOVERNMENT') {
    return params.hasLegalSource
      ? 'الإجابة مستندة إلى النصوص القانونية المتاحة، ويجب مطابقتها مع الصلاحيات والإجراءات الداخلية قبل اتخاذ قرار رسمي.'
      : 'لم يتم العثور على سند قانوني مباشر كافٍ، لذلك يجب استكمال التحقق من النصوص والصلاحيات قبل أي إجراء رسمي.';
  }

  if (cleanedOriginal) {
    return cleanedOriginal;
  }

  return params.hasLegalSource
    ? 'الإجابة مستندة إلى النصوص القانونية المتاحة، لكنها لا تكفي وحدها لاتخاذ قرار نهائي دون استشارة قانونية متخصصة.'
    : 'لم يتم العثور على مصدر قانوني مباشر كافٍ، ويجب أخذ استشارة قانونية متخصصة قبل اتخاذ أي إجراء.';
}

function sanitizeLegalOutputForAnswerMode(
  output: LegalAiOutput,
  answerMode: AnswerMode
): LegalAiOutput {
  return {
    ...output,
    answer: sanitizeTextForAnswerMode(output.answer, answerMode),
    lawyerSummary: sanitizeTextForAnswerMode(output.lawyerSummary, answerMode),
    sourceNote: shortenSourceNote(
      sanitizeTextForAnswerMode(output.sourceNote, answerMode)
    ),
  };
}

function prioritizeArticlesByContext(
  articles: string[],
  text: string
): string[] {
  const normalizedText = text.replace(/\s+/g, ' ');
  const priority: string[] = [];

  const mentionsAppealPeriod = includesAny(normalizedText, [
    'مدة الاستئناف',
    'ميعاد الاستئناف',
    'موعد الاستئناف',
    'مدة الطعن بالاستئناف',
  ]);

  const mentionsMissedDeadline = includesAny(normalizedText, [
    'فاتت مدة الاستئناف',
    'فوات مدة الاستئناف',
    'بعد فوات',
    'انقضاء المدة',
    'انقضاء مدة الاستئناف',
    'رد الطعن شكلا',
    'رد الطعن شكلًا',
    'فوات الميعاد',
  ]);

  const mentionsRetrial = includesAny(normalizedText, [
    'إعادة المحاكمة',
    'اعادة المحاكمة',
    'طلب إعادة المحاكمة',
    'طلب اعادة المحاكمة',
  ]);

  const mentionsThirdPartyObjection = includesAny(normalizedText, [
    'اعتراض الغير',
    'اعتراض غير',
  ]);

  const mentionsCassation = includesAny(normalizedText, [
    'التمييز',
    'محكمة التمييز',
    'الطعن بالتمييز',
  ]);

  if (mentionsMissedDeadline && articles.includes('172')) {
    priority.push('172');
  }

  if (mentionsAppealPeriod && articles.includes('178')) {
    priority.push('178');
  }

  if (mentionsRetrial && articles.includes('213')) {
    priority.push('213');
  }

  if (mentionsThirdPartyObjection && articles.includes('207')) {
    priority.push('207');
  }

  if (mentionsThirdPartyObjection && articles.includes('208')) {
    priority.push('208');
  }

  if (mentionsCassation && articles.includes('191')) {
    priority.push('191');
  }

  return uniqueStrings([...priority, ...articles]);
}

function shortenSourceNote(note: string): string {
  const trimmedNote = note.trim();

  if (trimmedNote.length <= 180) {
    return trimmedNote;
  }

  return `${trimmedNote.slice(0, 177).trim()}...`;
}

function isTimingSensitiveQuestion(question: string): boolean {
  const normalizedQuestion = normalizeArabicForSearch(question);

  return includesAny(normalizedQuestion, [
    'مده',
    'ميعاد',
    'موعد',
    'اجل',
    'اخر يوم',
    'فوات',
    'انقضاء',
    'استئناف',
    'تمييز',
    'اعتراض',
    'تبليغ',
    'تبلغت',
    'حكم',
    'قرار',
    'رد شكلا',
    'رد شكل',
    'سقط حقي',
  ]);
}

function isActionSensitiveQuestion(question: string): boolean {
  const normalizedQuestion = normalizeArabicForSearch(question);

  return includesAny(normalizedQuestion, [
    'ماذا افعل',
    'شو اعمل',
    'كيف اتصرف',
    'هل استطيع',
    'هل يجوز',
    'ارفع دعوي',
    'اطعن',
    'استأنف',
    'استانف',
    'انفذ',
    'تنفيذ',
    'حجز',
    'دعوى',
    'محكمه',
    'محكمة',
  ]);
}

function answerAlreadyHasSafetyWarning(answer: string): boolean {
  const normalizedAnswer = normalizeArabicForSearch(answer);

  return includesAny(normalizedAnswer, [
    'لا تغني عن مراجعه محام',
    'لا يغني عن مراجعه محام',
    'يجب مراجعه محام',
    'يلزم مراجعه محام',
    'محام مختص',
  ]);
}

function prependSafetyWarning(answer: string, warning: string): string {
  const cleanedAnswer = answer.trim();

  if (!cleanedAnswer) {
    return warning;
  }

  if (answerAlreadyHasSafetyWarning(cleanedAnswer)) {
    return cleanedAnswer;
  }

  return `> ${warning}\n\n${cleanedAnswer}`;
}

function buildSaferLawyerSummary(summary: string, warning: string): string {
  const cleanedSummary = summary.trim();

  if (!cleanedSummary) {
    return warning;
  }

  if (answerAlreadyHasSafetyWarning(cleanedSummary)) {
    return cleanedSummary;
  }

  return `${warning}\n\n${cleanedSummary}`;
}

function applyLegalAnswerSafetyCheck(
  output: LegalAiOutput,
  params: {
    userQuestion: string;
    useJordanLegalSources: boolean;
    hasDatabaseLegalContext: boolean;
    answerMode: AnswerMode;
  }
): LegalAiOutput {
  const hasPrimaryArticles = output.primaryArticles.length > 0;
  const hasAnySourceArticles = output.sourceArticles.length > 0;
  const timingSensitive = isTimingSensitiveQuestion(params.userQuestion);
  const actionSensitive = isActionSensitiveQuestion(params.userQuestion);
  const overviewQuestion = isOverviewLegalSourceQuestion(params.userQuestion);

  const needsDirectSupport =
    timingSensitive || actionSensitive || params.useJordanLegalSources;

  const hasWeakSupport =
    output.sourceConfidence === 'low' ||
    (!overviewQuestion && !hasPrimaryArticles) ||
    (needsDirectSupport && !hasAnySourceArticles);

  if (!hasWeakSupport) {
    return output;
  }

  const warning = buildModeAwareWarning({
    answerMode: params.answerMode,
    timingSensitive,
  });

  const saferSourceConfidence: SourceConfidence = hasAnySourceArticles
    ? 'medium'
    : 'low';

  const saferSourceNote = buildModeAwareSourceNote({
    answerMode: params.answerMode,
    hasLegalSource: hasAnySourceArticles,
    originalNote: output.sourceNote,
  });

  return {
    ...output,
    answer: prependSafetyWarning(output.answer, warning),
    lawyerSummary: buildSaferLawyerSummary(output.lawyerSummary, warning),
    sourceNote: shortenSourceNote(saferSourceNote),
    sourceConfidence: saferSourceConfidence,
    primaryArticles: hasPrimaryArticles ? output.primaryArticles : [],
    sourceArticles: uniqueStrings([
      ...output.primaryArticles,
      ...output.relatedArticles,
      ...output.sourceArticles,
    ]),
  };
}

function normalizeLegalOutput(
  parsed: Partial<LegalAiOutput>,
  fallbackAnswer: string,
  useJordanRag: boolean,
  userQuestion: string,
  answerMode: AnswerMode
): LegalAiOutput {
  const validConfidenceValues: SourceConfidence[] = ['high', 'medium', 'low'];

  const sourceConfidence: SourceConfidence =
    parsed.sourceConfidence &&
    validConfidenceValues.includes(parsed.sourceConfidence)
      ? parsed.sourceConfidence
      : 'low';

  const cleanedAnswer =
    typeof parsed.answer === 'string' && parsed.answer.trim()
      ? removeDuplicateSourceSection(parsed.answer)
      : removeDuplicateSourceSection(fallbackAnswer);

  const combinedSourceText = [
    userQuestion,
    parsed.answer,
    parsed.sourceNote,
    parsed.lawyerSummary,
    fallbackAnswer,
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
      : uniqueStrings([
          ...rawPrimaryArticles,
          ...rawRelatedArticles,
          ...extractedArticles,
        ]);

  const prioritizedArticles = prioritizeArticlesByContext(
    uniqueStrings([
      ...rawPrimaryArticles,
      ...rawSourceArticles,
      ...extractedArticles,
    ]),
    combinedSourceText
  );

  const primaryArticles =
    prioritizedArticles.length > 0 ? prioritizedArticles.slice(0, 2) : [];

  const relatedArticles = uniqueStrings([
    ...rawRelatedArticles,
    ...rawPrimaryArticles,
    ...rawSourceArticles,
    ...extractedArticles,
  ])
    .filter((article) => !primaryArticles.includes(article))
    .slice(0, 5);

  const sourceArticles = uniqueStrings([...primaryArticles, ...relatedArticles]);

  return {
    answer: cleanedAnswer,
    suggestions: Array.isArray(parsed.suggestions)
      ? parsed.suggestions.filter((item) => typeof item === 'string')
      : [],
    lawyerSummary:
      typeof parsed.lawyerSummary === 'string' && parsed.lawyerSummary.trim()
        ? parsed.lawyerSummary
        : fallbackAnswer,
    sourceNote: shortenSourceNote(
      buildModeAwareSourceNote({
        answerMode,
        hasLegalSource: useJordanRag || sourceArticles.length > 0,
        originalNote:
          typeof parsed.sourceNote === 'string' && parsed.sourceNote.trim()
            ? parsed.sourceNote
            : '',
      })
    ),
    sourceConfidence,
    sourceTitle:
      typeof parsed.sourceTitle === 'string' && parsed.sourceTitle.trim()
        ? parsed.sourceTitle
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
  useJordanRag: boolean,
  userQuestion: string,
  answerMode: AnswerMode
): LegalAiOutput {
  try {
    const parsed = JSON.parse(text) as Partial<LegalAiOutput>;

    return normalizeLegalOutput(parsed, text, useJordanRag, userQuestion, answerMode);
  } catch {
    return {
      answer: text || 'تعذر توليد إجابة قانونية منظمة في هذه اللحظة.',
      suggestions: [],
      lawyerSummary:
        text || 'تعذر توليد ملخص محامٍ منظم في هذه اللحظة.',
      sourceNote: buildModeAwareSourceNote({
        answerMode,
        hasLegalSource: false,
        originalNote: '',
      }),
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
    const selectedCountry = getSelectedCountry(body);
    const answerMode = normalizeAnswerMode(body);
    const legalIntent = detectLegalIntent(question, selectedCountry);

    if (!question) {
      return NextResponse.json(
        {
          error: 'Question is required.',
        },
        { status: 400 }
      );
    }

    const databaseLegalContext = await buildDatabaseLegalContext({
      question,
      country: selectedCountry,
    });

    const databaseLegalContextMeta = extractDatabaseLegalContextMeta(
      databaseLegalContext
    );

    const hasDatabaseLegalContext = databaseLegalContextMeta.hasContext;

    const useJordanRag =
      isJordan(selectedCountry) && Boolean(JORDAN_LAWS_VECTOR_STORE_ID);

    const useJordanLegalSources = useJordanRag || hasDatabaseLegalContext;

    const systemPrompt = buildSystemPrompt({
      country: selectedCountry,
      intakeType: body.intakeType,
      useJordanRag,
      hasDatabaseLegalContext,
      answerMode,
      legalIntent,
    });

    const userPrompt = buildUserPrompt(
      body,
      databaseLegalContext,
      answerMode,
      legalIntent
    );

    const tools = useJordanRag && !hasDatabaseLegalContext
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
    const parsedLegalOutput = parseLegalOutput(
      outputText,
      useJordanLegalSources,
      question,
      answerMode
    );

    const guardedLegalOutput = applyDatabaseSourceGuard(parsedLegalOutput, {
      databaseLegalContextMeta,
      answerMode,
      question,
      legalIntent,
    });

    const safetyCheckedLegalOutput = applyLegalAnswerSafetyCheck(
      guardedLegalOutput,
      {
        userQuestion: question,
        useJordanLegalSources,
        hasDatabaseLegalContext,
        answerMode,
      }
    );

    const legalOutput = sanitizeLegalOutputForAnswerMode(
      safetyCheckedLegalOutput,
      answerMode
    );

    const hasFinalLegalSource = Boolean(
      hasDatabaseLegalContext ||
        legalOutput.sourceTitle ||
        legalOutput.sourceArticles.length > 0 ||
        legalOutput.primaryArticles.length > 0 ||
        legalOutput.relatedArticles.length > 0
    );

    const finalLegalOutput: LegalAiOutput = {
      ...legalOutput,
      sourceNote: shortenSourceNote(
        buildModeAwareSourceNote({
          answerMode,
          hasLegalSource: hasFinalLegalSource,
          originalNote: legalOutput.sourceNote,
        })
      ),
    };

    return NextResponse.json({
      ...finalLegalOutput,
      answerMode,
    });
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
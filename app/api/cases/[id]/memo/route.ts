import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../../../lib/prisma';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

type UnknownRecord = Record<string, unknown>;

type MemoDocumentInput = {
  id?: string;
  title?: string;
  fileName?: string;
  name?: string;
  manualText?: string;
  text?: string;
  rawText?: string | null;
  extractedText?: string;
  content?: string;
  aiSummary?: string | null;
  notes?: string;
  documentType?: string;
  createdAt?: string;
};

type MemoProcedureInput = {
  id?: string;
  title?: string;
  date?: string | null;
  eventDate?: string | null;
  type?: string;
  eventType?: string;
  description?: string | null;
  notes?: string;
  status?: string;
  isCritical?: boolean;
  createdAt?: string;
  [key: string]: unknown;
};

type MemoRecommendationInput = {
  id?: string;
  title?: string;
  description?: string;
  priority?: string | null;
  recommendationType?: string | null;
  isDone?: boolean;
  createdAt?: string;
};

type MemoLinkedArticleInput = {
  id?: string;
  articleId?: string;
  sourceTitle?: string;
  legalSourceTitle?: string;
  legalSourceSlug?: string;
  articleNumber?: string;
  number?: string;
  articleText?: string;
  articleTextReviewed?: string;
  text?: string;
  reason?: string;
  confidence?: string;
  reviewStatus?: string;
  isApproved?: boolean;
};

type CaseMemoRequestBody = {
  caseData?: UnknownRecord | null;
  documents?: MemoDocumentInput[];
  procedures?: MemoProcedureInput[];
  events?: MemoProcedureInput[];
  analysis?: unknown;
  analyses?: unknown;
  recommendations?: MemoRecommendationInput[] | unknown;
  linkedArticles?: MemoLinkedArticleInput[];
  linkedArticleIds?: string[];
};

type DatabaseLegalArticleForMemo = {
  id: string;
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

type MemoRiskLevel = 'low' | 'medium' | 'high' | 'unknown';

type CaseLegalMemoOutput = {
  title: string;
  memoText: string;
  executiveSummary: string;
  keyFacts: string[];
  legalIssues: string[];
  appliedArticles: {
    sourceTitle: string;
    articleNumber: string;
    relevance: string;
  }[];
  recommendations: string[];
  missingInformation: string[];
  riskLevel: MemoRiskLevel;
  disclaimer: string;
};

const CASE_MEMO_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    memoText: { type: 'string' },
    executiveSummary: { type: 'string' },
    keyFacts: {
      type: 'array',
      items: { type: 'string' },
    },
    legalIssues: {
      type: 'array',
      items: { type: 'string' },
    },
    appliedArticles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          sourceTitle: { type: 'string' },
          articleNumber: { type: 'string' },
          relevance: { type: 'string' },
        },
        required: ['sourceTitle', 'articleNumber', 'relevance'],
      },
    },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
    },
    missingInformation: {
      type: 'array',
      items: { type: 'string' },
    },
    riskLevel: {
      type: 'string',
      enum: ['low', 'medium', 'high', 'unknown'],
    },
    disclaimer: { type: 'string' },
  },
  required: [
    'title',
    'memoText',
    'executiveSummary',
    'keyFacts',
    'legalIssues',
    'appliedArticles',
    'recommendations',
    'missingInformation',
    'riskLevel',
    'disclaimer',
  ],
};

function stringifySafe(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function truncateText(value: string, maxLength: number): string {
  const cleaned = value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (cleaned.length <= maxLength) return cleaned;
  return `${cleaned.slice(0, maxLength).trim()}...`;
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

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): UnknownRecord {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as UnknownRecord;
  }

  return {};
}

function getDocumentTitle(document: MemoDocumentInput, index: number): string {
  return (
    document.title ||
    document.fileName ||
    document.name ||
    `مستند رقم ${index + 1}`
  );
}

function getDocumentText(document: MemoDocumentInput): string {
  return (
    document.manualText ||
    document.text ||
    document.rawText ||
    document.extractedText ||
    document.content ||
    document.aiSummary ||
    document.notes ||
    ''
  ).trim();
}

function getBestDatabaseArticleText(
  article: DatabaseLegalArticleForMemo
): string {
  if (article.articleTextReviewed && article.articleTextReviewed.trim()) {
    return article.articleTextReviewed;
  }

  if (article.articleTextClean && article.articleTextClean.trim()) {
    return article.articleTextClean;
  }

  return article.articleText || '';
}

function getBestClientArticleText(article: MemoLinkedArticleInput): string {
  return (
    article.articleTextReviewed ||
    article.articleText ||
    article.text ||
    ''
  ).trim();
}

async function getApprovedArticlesFromDatabase(
  linkedArticleIds: string[] | undefined
): Promise<DatabaseLegalArticleForMemo[]> {
  const ids = uniqueStrings(linkedArticleIds || []).slice(0, 30);

  if (!ids.length) return [];

  return prisma.legalArticle.findMany({
    where: {
      id: { in: ids },
      reviewStatus: 'approved',
    },
    select: {
      id: true,
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
  });
}

function buildApprovedArticlesContext(params: {
  databaseArticles: DatabaseLegalArticleForMemo[];
  clientArticles: MemoLinkedArticleInput[];
}): string {
  const databaseBlocks = params.databaseArticles.map((article) => {
    const text = truncateText(getBestDatabaseArticleText(article), 3000);

    return [
      `القانون: ${article.legalSource.titleAr}`,
      `الدولة: ${article.legalSource.country.nameAr}`,
      `رقم المادة: ${article.articleNumber}`,
      `حالة المراجعة: approved`,
      'نص المادة:',
      text,
    ].join('\n');
  });

  const clientBlocks = params.clientArticles
    .filter((article) => {
      if (article.reviewStatus) return article.reviewStatus === 'approved';
      if (typeof article.isApproved === 'boolean') return article.isApproved;
      return true;
    })
    .map((article, index) => {
      const sourceTitle =
        article.sourceTitle ||
        article.legalSourceTitle ||
        'مصدر قانوني مرتبط من تحليل القضية';

      const articleNumber =
        article.articleNumber || article.number || `غير محدد ${index + 1}`;

      const text = truncateText(getBestClientArticleText(article), 3000);

      return [
        `القانون: ${sourceTitle}`,
        `رقم المادة: ${articleNumber}`,
        `حالة المراجعة: approved / from case analysis`,
        article.reason ? `سبب الارتباط: ${article.reason}` : '',
        article.confidence ? `درجة الثقة: ${article.confidence}` : '',
        'نص المادة:',
        text || 'لم يتم تمرير نص المادة من الواجهة.',
      ]
        .filter(Boolean)
        .join('\n');
    });

  const allBlocks = [...databaseBlocks, ...clientBlocks].slice(0, 20);

  if (!allBlocks.length) {
    return 'لا توجد مواد قانونية معتمدة مرفقة مع طلب توليد المذكرة.';
  }

  return allBlocks.join('\n\n---\n\n');
}

function buildDocumentsContext(documents: MemoDocumentInput[] | undefined) {
  const items = Array.isArray(documents) ? documents : [];

  if (!items.length) return 'لا توجد مستندات مرفقة.';

  return items
    .slice(0, 15)
    .map((document, index) => {
      const title = getDocumentTitle(document, index);
      const text = truncateText(getDocumentText(document), 2500);

      return [
        `المستند ${index + 1}: ${title}`,
        document.documentType ? `نوع المستند: ${document.documentType}` : '',
        text ? `النص:\n${text}` : 'لا يوجد نص يدوي أو نص قابل للتحليل لهذا المستند.',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n---\n\n');
}

function buildProceduresContext(procedures: MemoProcedureInput[] | undefined) {
  const items = Array.isArray(procedures) ? procedures : [];

  if (!items.length) return 'لا توجد إجراءات مسجلة على القضية.';

  return items
    .slice(0, 30)
    .map((procedure, index) => {
      return [
        `الإجراء ${index + 1}:`,
        `العنوان: ${procedure.title || 'غير محدد'}`,
        `التاريخ: ${procedure.date || procedure.eventDate || 'غير محدد'}`,
        `النوع: ${procedure.type || procedure.eventType || 'غير محدد'}`,
        `الحالة: ${procedure.status || (procedure.isCritical ? 'CRITICAL' : 'NORMAL')}`,
        `الوصف: ${procedure.description || procedure.notes || 'غير محدد'}`,
      ].join('\n');
    })
    .join('\n\n---\n\n');
}

function buildRecommendationsContext(
  recommendations: MemoRecommendationInput[] | unknown
) {
  const items = Array.isArray(recommendations) ? recommendations : [];

  if (!items.length) return 'لا توجد توصيات مسجلة على القضية.';

  return items
    .slice(0, 30)
    .map((recommendation, index) => {
      const rec = asRecord(recommendation);

      return [
        `التوصية ${index + 1}:`,
        `العنوان: ${rec.title || 'غير محدد'}`,
        `الوصف: ${rec.description || 'غير محدد'}`,
        `الأولوية: ${rec.priority || 'غير محددة'}`,
        `النوع: ${rec.recommendationType || 'غير محدد'}`,
        `الحالة: ${rec.isDone ? 'منجزة' : 'غير منجزة'}`,
      ].join('\n');
    })
    .join('\n\n---\n\n');
}

function buildSystemPrompt() {
  return `
You are Hukumx, a professional AI legal assistant for preparing preliminary legal memoranda in Arabic.

Your task:
- Generate a preliminary legal memorandum from the provided case data.
- Use only the provided facts, documents, procedures, analysis, recommendations, and approved legal articles.
- Do not invent facts, dates, document contents, case numbers, parties, laws, article numbers, courts, or deadlines.
- If information is missing, clearly list it under missingInformation.
- The memo is preliminary and must be reviewed by a qualified lawyer before filing or relying on it.
- Be conservative when discussing deadlines, appeal periods, limitation periods, notification, execution, cassation, or procedural consequences.
- If the legal articles are insufficient, say that the legal basis requires further review.
- Write in professional Arabic suitable for a lawyer or legal department.
- Return valid JSON only.
- Do not wrap the JSON in Markdown.
`;
}

function buildUserPrompt(params: {
  caseId: string;
  body: CaseMemoRequestBody;
  approvedArticlesContext: string;
}) {
  const { caseId, body, approvedArticlesContext } = params;

  return `
Generate a preliminary legal memorandum for this case.

Case ID:
${caseId}

Case data:
${truncateText(stringifySafe(body.caseData || {}), 6000)}

Documents context:
${buildDocumentsContext(body.documents)}

Procedures context:
${buildProceduresContext(body.procedures || body.events)}

Existing AI case analysis:
${truncateText(stringifySafe(body.analysis || body.analyses || {}), 8000)}

Existing recommendations:
${buildRecommendationsContext(body.recommendations)}

Approved linked legal articles:
${approvedArticlesContext}

Required memo structure inside memoText:
1. عنوان المذكرة
2. تنبيه أولي
3. ملخص تنفيذي
4. الوقائع الثابتة من البيانات والمستندات
5. المستندات المعتمدة في التحليل
6. الإجراءات المسجلة على القضية
7. المسائل القانونية الأولية
8. النصوص القانونية ذات العلاقة
9. التحليل القانوني الأولي
10. نقاط القوة
11. نقاط الضعف والمخاطر
12. التوصيات العملية
13. المعلومات الناقصة
14. الخلاصة

Return only the required JSON object according to the schema.
`;
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
            'text' in contentItem &&
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

function normalizeMemoOutput(
  parsed: Partial<CaseLegalMemoOutput>,
  fallbackText: string
): CaseLegalMemoOutput {
  const riskLevels: MemoRiskLevel[] = ['low', 'medium', 'high', 'unknown'];

  const title =
    typeof parsed.title === 'string' && parsed.title.trim()
      ? parsed.title.trim()
      : 'مذكرة قانونية أولية';

  const memoText =
    typeof parsed.memoText === 'string' && parsed.memoText.trim()
      ? parsed.memoText.trim()
      : fallbackText || 'تعذر توليد مذكرة قانونية منظمة.';

  const riskLevel =
    parsed.riskLevel && riskLevels.includes(parsed.riskLevel)
      ? parsed.riskLevel
      : 'unknown';

  return {
    title,
    memoText,
    executiveSummary:
      typeof parsed.executiveSummary === 'string'
        ? parsed.executiveSummary
        : '',
    keyFacts: Array.isArray(parsed.keyFacts)
      ? parsed.keyFacts.filter((item) => typeof item === 'string')
      : [],
    legalIssues: Array.isArray(parsed.legalIssues)
      ? parsed.legalIssues.filter((item) => typeof item === 'string')
      : [],
    appliedArticles: Array.isArray(parsed.appliedArticles)
      ? parsed.appliedArticles
          .filter((item) => typeof item === 'object' && item !== null)
          .map((item) => {
            const article = item as {
              sourceTitle?: unknown;
              articleNumber?: unknown;
              relevance?: unknown;
            };

            return {
              sourceTitle:
                typeof article.sourceTitle === 'string'
                  ? article.sourceTitle
                  : '',
              articleNumber:
                typeof article.articleNumber === 'string'
                  ? article.articleNumber
                  : '',
              relevance:
                typeof article.relevance === 'string' ? article.relevance : '',
            };
          })
          .filter((item) => item.sourceTitle || item.articleNumber)
      : [],
    recommendations: Array.isArray(parsed.recommendations)
      ? parsed.recommendations.filter((item) => typeof item === 'string')
      : [],
    missingInformation: Array.isArray(parsed.missingInformation)
      ? parsed.missingInformation.filter((item) => typeof item === 'string')
      : [],
    riskLevel,
    disclaimer:
      typeof parsed.disclaimer === 'string' && parsed.disclaimer.trim()
        ? parsed.disclaimer
        : 'هذه مذكرة قانونية أولية لا تغني عن مراجعة محامٍ مختص قبل اتخاذ أي إجراء.',
  };
}

function parseMemoOutput(text: string): CaseLegalMemoOutput {
  try {
    const parsed = JSON.parse(text) as Partial<CaseLegalMemoOutput>;
    return normalizeMemoOutput(parsed, text);
  } catch {
    return normalizeMemoOutput(
      {
        title: 'مذكرة قانونية أولية',
        memoText: text,
        executiveSummary: '',
        keyFacts: [],
        legalIssues: [],
        appliedArticles: [],
        recommendations: [],
        missingInformation: [
          'تعذر تحويل نتيجة الذكاء الصناعي إلى JSON منظم، ويجب إعادة المحاولة.',
        ],
        riskLevel: 'unknown',
        disclaimer:
          'هذه مذكرة قانونية أولية لا تغني عن مراجعة محامٍ مختص قبل اتخاذ أي إجراء.',
      },
      text
    );
  }
}

function normalizeStoredMemo(memo: {
  id: string;
  caseId: string;
  title: string;
  memoText: string;
  executiveSummary: string | null;
  keyFacts: unknown;
  legalIssues: unknown;
  appliedArticles: unknown;
  recommendations: unknown;
  missingInformation: unknown;
  riskLevel: string | null;
  disclaimer: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: memo.id,
    caseId: memo.caseId,
    title: memo.title,
    memoText: memo.memoText,
    executiveSummary: memo.executiveSummary || '',
    keyFacts: asArray(memo.keyFacts).filter((item) => typeof item === 'string'),
    legalIssues: asArray(memo.legalIssues).filter(
      (item) => typeof item === 'string'
    ),
    appliedArticles: asArray(memo.appliedArticles),
    recommendations: asArray(memo.recommendations).filter(
      (item) => typeof item === 'string'
    ),
    missingInformation: asArray(memo.missingInformation).filter(
      (item) => typeof item === 'string'
    ),
    riskLevel: memo.riskLevel || 'unknown',
    disclaimer: memo.disclaimer || '',
    createdAt: memo.createdAt.toISOString(),
    updatedAt: memo.updatedAt.toISOString(),
  };
}

async function getCaseSnapshot(caseId: string) {
  const legalCase = await prisma.legalCase.findUnique({
    where: { id: caseId },
    include: {
      documents: true,
      events: true,
      analyses: true,
      recommendations: true,
    },
  });

  if (!legalCase) return null;

  return {
    caseData: {
      id: legalCase.id,
      title: legalCase.title,
      country: legalCase.country,
      caseType: legalCase.caseType,
      status: legalCase.status,
      clientName: legalCase.clientName,
      opponentName: legalCase.opponentName,
      courtName: legalCase.courtName,
      caseNumber: legalCase.caseNumber,
      description: legalCase.description,
      aiSummary: legalCase.aiSummary,
      riskLevel: legalCase.riskLevel,
      createdAt: legalCase.createdAt.toISOString(),
      updatedAt: legalCase.updatedAt.toISOString(),
    },
    documents: legalCase.documents.map((document) => ({
      id: document.id,
      title: document.fileName,
      fileName: document.fileName,
      documentType: document.documentType,
      rawText: document.rawText,
      text: document.rawText || document.cleanedText || document.aiSummary || '',
      aiSummary: document.aiSummary,
      createdAt: document.createdAt.toISOString(),
    })),
    procedures: legalCase.events.map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      type: event.eventType,
      date: event.eventDate ? event.eventDate.toISOString() : null,
      status: event.isCritical ? 'CRITICAL' : 'NORMAL',
      isCritical: event.isCritical,
      createdAt: event.createdAt.toISOString(),
    })),
    analysis: legalCase.analyses,
    recommendations: legalCase.recommendations,
  } satisfies CaseMemoRequestBody;
}

function extractRelatedArticlesFromAnalyses(analyses: unknown): MemoLinkedArticleInput[] {
  const relatedArticles: MemoLinkedArticleInput[] = [];

  for (const analysis of asArray(analyses)) {
    const analysisRecord = asRecord(analysis);

    for (const article of asArray(analysisRecord.relatedArticles)) {
      if (typeof article === 'object' && article !== null) {
        relatedArticles.push(article as MemoLinkedArticleInput);
      }
    }
  }

  return relatedArticles;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await context.params;

    const memo = await prisma.caseMemo.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: memo ? normalizeStoredMemo(memo) : null,
      memo: memo ? normalizeStoredMemo(memo) : null,
    });
  } catch (error) {
    console.error('Hukumx get case memo error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء جلب المذكرة القانونية المحفوظة.',
      },
      { status: 500 }
    );
  }
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'OPENAI_API_KEY is not configured.',
        },
        { status: 500 }
      );
    }

    const { id: caseId } = await context.params;
    const bodyFromRequest = (await req.json().catch(() => ({}))) as CaseMemoRequestBody;
    const bodyFromDatabase = await getCaseSnapshot(caseId);

    if (!bodyFromDatabase && !bodyFromRequest.caseData) {
      return NextResponse.json(
        {
          success: false,
          error: 'القضية غير موجودة أو لا توجد بيانات كافية لتوليد المذكرة.',
        },
        { status: 404 }
      );
    }

    const body: CaseMemoRequestBody = {
      ...(bodyFromDatabase || {}),
      ...bodyFromRequest,
      caseData: bodyFromRequest.caseData || bodyFromDatabase?.caseData || {},
      documents: bodyFromRequest.documents || bodyFromDatabase?.documents || [],
      procedures:
        bodyFromRequest.procedures || bodyFromRequest.events || bodyFromDatabase?.procedures || [],
      analysis: bodyFromRequest.analysis || bodyFromRequest.analyses || bodyFromDatabase?.analysis || [],
      recommendations:
        bodyFromRequest.recommendations || bodyFromDatabase?.recommendations || [],
    };

    const relatedArticlesFromAnalysis = extractRelatedArticlesFromAnalyses(
      body.analysis
    );

    const linkedArticles = [
      ...(Array.isArray(body.linkedArticles) ? body.linkedArticles : []),
      ...relatedArticlesFromAnalysis,
    ];

    const linkedArticleIds = uniqueStrings([
      ...(Array.isArray(body.linkedArticleIds) ? body.linkedArticleIds : []),
      ...linkedArticles.map((article) => article.id || article.articleId),
    ]);

    const databaseArticles = await getApprovedArticlesFromDatabase(linkedArticleIds);

    const approvedArticlesContext = buildApprovedArticlesContext({
      databaseArticles,
      clientArticles: linkedArticles,
    });

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        {
          role: 'system',
          content: buildSystemPrompt(),
        },
        {
          role: 'user',
          content: buildUserPrompt({
            caseId,
            body,
            approvedArticlesContext,
          }),
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'case_legal_memo_output',
          schema: CASE_MEMO_OUTPUT_SCHEMA,
          strict: true,
        },
      },
    });

    const outputText = extractOutputText(response);
    const generatedMemo = parseMemoOutput(outputText);

    const savedMemo = await prisma.caseMemo.create({
      data: {
        caseId,
        title: generatedMemo.title,
        memoText: generatedMemo.memoText,
        executiveSummary: generatedMemo.executiveSummary,
        keyFacts: generatedMemo.keyFacts,
        legalIssues: generatedMemo.legalIssues,
        appliedArticles: generatedMemo.appliedArticles,
        recommendations: generatedMemo.recommendations,
        missingInformation: generatedMemo.missingInformation,
        riskLevel: generatedMemo.riskLevel,
        disclaimer: generatedMemo.disclaimer,
        sourceSnapshot: toPrismaJson({
            caseData: body.caseData || {},
            documentsCount: Array.isArray(body.documents) ? body.documents.length : 0,
            proceduresCount: Array.isArray(body.procedures) ? body.procedures.length : 0,
            recommendationsCount: Array.isArray(body.recommendations)
                ? body.recommendations.length
                : 0,
            linkedArticleIds,
            usedApprovedArticlesCount: databaseArticles.length,
            generatedAt: new Date().toISOString(),
        }),
      },
    });

    const normalizedMemo = normalizeStoredMemo(savedMemo);

    return NextResponse.json({
      success: true,
      caseId,
      data: normalizedMemo,
      memo: normalizedMemo,
      usedApprovedArticlesCount: databaseArticles.length,
      generatedAt: savedMemo.createdAt.toISOString(),
    });
  } catch (error) {
    console.error('Hukumx case memo generation error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء توليد وحفظ المذكرة القانونية الأولية.',
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '../../../../../lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const OPENAI_REVIEW_MODEL = process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const DEFAULT_BATCH_SIZE = 5;
const MAX_BATCH_SIZE = 10;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type RouteContext = {
  params: Promise<{
    id?: string;
  }>;
};

type LegalArticleForProcessing = {
  id: string;
  articleNumber: string;
  articleText: string;
  articleTextClean: string | null;
  articleTextReviewed: string | null;
  reviewNotes: string | null;
  reviewStatus: string;
  legalSource: {
    titleAr: string;
    country: {
      nameAr: string;
    };
  };
};

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
            (contentItem.type === 'output_text' || contentItem.type === 'text') &&
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

function convertArabicDigits(value: string) {
  const map: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  };

  return value.replace(/[٠-٩]/g, (digit) => map[digit] || digit);
}

function getArticleNumberValue(value: string) {
  const normalized = convertArabicDigits(value)
    .replace(/^المادة\s*/u, '')
    .replace(/^مادة\s*/u, '')
    .replace(/[^0-9.\-]/g, '')
    .trim();

  const directNumber = Number(normalized);
  if (Number.isFinite(directNumber)) return directNumber;

  const firstNumber = Number(normalized.match(/\d+/)?.[0] || '');
  return Number.isFinite(firstNumber) ? firstNumber : Number.MAX_SAFE_INTEGER;
}

function compareArticleNumbers(a: string, b: string) {
  const numberA = getArticleNumberValue(a);
  const numberB = getArticleNumberValue(b);

  if (numberA !== numberB) return numberA - numberB;
  return a.localeCompare(b, 'ar', { numeric: true });
}

function getSafeBatchSize(value: unknown) {
  const numeric = Number(value || DEFAULT_BATCH_SIZE);

  if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_BATCH_SIZE;
  return Math.min(Math.max(Math.floor(numeric), 1), MAX_BATCH_SIZE);
}

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function generateAiCleanText(article: LegalArticleForProcessing) {
  const sourceText = article.articleText;

  const response = await openai.responses.create({
    model: OPENAI_REVIEW_MODEL,
    temperature: 0,
    input: [
      {
        role: 'system',
        content: `
أنت محرر ومدقق قانوني عربي متخصص في تنظيف وتصحيح مواد قانونية مستخرجة من PDF/OCR.

المطلوب:
- صحح أخطاء OCR والتنضيد الواضحة.
- ادمج الأسطر المقطوعة داخل الجملة الواحدة.
- حافظ على نص المادة كاملًا.
- لا تلخص.
- لا تضف حكمًا قانونيًا جديدًا.
- لا تحذف حكمًا قانونيًا موجودًا.
- لا تشرح.
- أعد JSON فقط.

أعد النتيجة بهذا الشكل:
{
  "correctedText": "النص المعالج كاملًا",
  "detectedIssues": ["أخطاء تم تصحيحها"],
  "uncertainTerms": ["كلمات تحتاج مراجعة بشرية"]
}
        `.trim(),
      },
      {
        role: 'user',
        content: `
الدولة: ${article.legalSource.country.nameAr}
التشريع: ${article.legalSource.titleAr}
رقم المادة: ${article.articleNumber}

النص الأصلي المستخرج من الملف:
${sourceText}
        `.trim(),
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'legal_article_ai_cleaning',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            correctedText: { type: 'string' },
            detectedIssues: {
              type: 'array',
              items: { type: 'string' },
            },
            uncertainTerms: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['correctedText', 'detectedIssues', 'uncertainTerms'],
        },
      },
    },
  });

  const outputText = extractOutputText(response).trim();

  if (!outputText) {
    throw new Error('AI did not return output text');
  }

  try {
    const parsed = JSON.parse(outputText) as {
      correctedText?: string;
      detectedIssues?: unknown[];
      uncertainTerms?: unknown[];
    };

    const correctedText = normalizeText(String(parsed.correctedText || ''));
    const detectedIssues = Array.isArray(parsed.detectedIssues)
      ? parsed.detectedIssues.filter((item): item is string => typeof item === 'string')
      : [];
    const uncertainTerms = Array.isArray(parsed.uncertainTerms)
      ? parsed.uncertainTerms.filter((item): item is string => typeof item === 'string')
      : [];

    if (!correctedText) {
      throw new Error('AI returned empty correctedText');
    }

    return {
      correctedText,
      notes: [
        'تم توليد هذا النص كنسخة معالجة بالذكاء الصناعي. يحتاج مراجعة واعتماد قبل اعتماده كنص نهائي.',
        detectedIssues.length ? `الأخطاء المكتشفة: ${detectedIssues.join(' | ')}` : '',
        uncertainTerms.length ? `كلمات تحتاج مراجعة: ${uncertainTerms.join(' | ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    };
  } catch {
    const fallbackText = normalizeText(outputText);

    if (!fallbackText) {
      throw new Error('Unable to parse AI output');
    }

    return {
      correctedText: fallbackText,
      notes: 'تم توليد نص معالج بالذكاء الصناعي، لكن النظام لم يستطع قراءة تقرير التصحيح كـ JSON منظم.',
    };
  }
}

async function getProgress(sourceId: string) {
  const [totalArticles, processedArticles, approvedArticles, remainingArticles] = await Promise.all([
    prisma.legalArticle.count({ where: { legalSourceId: sourceId } }),
    prisma.legalArticle.count({
      where: {
        legalSourceId: sourceId,
        articleTextClean: {
          not: null,
        },
      },
    }),
    prisma.legalArticle.count({
      where: {
        legalSourceId: sourceId,
        reviewStatus: 'approved',
      },
    }),
    prisma.legalArticle.count({
      where: {
        legalSourceId: sourceId,
        reviewStatus: {
          not: 'approved',
        },
        OR: [{ articleTextClean: null }, { articleTextClean: '' }],
      },
    }),
  ]);

  return {
    totalArticles,
    processedArticles,
    approvedArticles,
    remainingArticles,
  };
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: sourceId = '' } = await context.params;
    const body = (await req.json().catch(() => ({}))) as {
      key?: string;
      batchSize?: number;
    };

    const adminKey = String(body.key || '');
    const expectedAdminKey = process.env.ADMIN_ACCESS_KEY;

    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json({ success: false, error: 'غير مصرح.' }, { status: 401 });
    }

    if (!sourceId) {
      return NextResponse.json({ success: false, error: 'رقم التشريع مطلوب.' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { success: false, error: 'OPENAI_API_KEY غير موجود في إعدادات البيئة.' },
        { status: 500 }
      );
    }

    const legalSource = await prisma.legalSource.findUnique({
      where: { id: sourceId },
      select: { id: true, titleAr: true },
    });

    if (!legalSource) {
      return NextResponse.json({ success: false, error: 'التشريع غير موجود.' }, { status: 404 });
    }

    const batchSize = getSafeBatchSize(body.batchSize);

    const candidateArticles = await prisma.legalArticle.findMany({
      where: {
        legalSourceId: sourceId,
        reviewStatus: {
          not: 'approved',
        },
        OR: [{ articleTextClean: null }, { articleTextClean: '' }],
      },
      include: {
        legalSource: {
          include: {
            country: true,
          },
        },
      },
    });

    const batchArticles = (candidateArticles as LegalArticleForProcessing[])
      .sort((a, b) => compareArticleNumbers(a.articleNumber, b.articleNumber))
      .slice(0, batchSize);

    const processedArticleNumbers: string[] = [];

    for (const article of batchArticles) {
      try {
        const { correctedText, notes } = await generateAiCleanText(article);

        await prisma.legalArticle.update({
          where: { id: article.id },
          data: {
            articleTextClean: correctedText,
            reviewStatus: 'needs_review',
            reviewNotes: [article.reviewNotes || '', notes].filter(Boolean).join('\n\n'),
            reviewedAt: null,
            reviewedBy: null,
          },
        });

        processedArticleNumbers.push(article.articleNumber);
      } catch (error) {
        await prisma.legalArticle.update({
          where: { id: article.id },
          data: {
            reviewStatus: 'needs_review',
            reviewNotes: [
              article.reviewNotes || '',
              `فشلت معالجة هذه المادة بالذكاء الصناعي: ${
                error instanceof Error ? error.message : 'Unknown error'
              }`,
            ]
              .filter(Boolean)
              .join('\n\n'),
          },
        });
      }
    }

    const progress = await getProgress(sourceId);

    return NextResponse.json({
      success: true,
      data: {
        sourceId,
        sourceTitle: legalSource.titleAr,
        batchSize,
        processedCount: processedArticleNumbers.length,
        processedArticleNumbers,
        ...progress,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'حدث خطأ غير معروف أثناء معالجة التشريع.',
      },
      { status: 500 }
    );
  }
}

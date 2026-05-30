import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export const runtime = 'nodejs';
export const maxDuration = 60;

type AiRecommendation = {
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  recommendationType: string;
};

type RelatedArticleResult = {
  articleId: string;
  legalSourceTitle: string;
  legalSourceSlug: string;
  articleNumber: string;
  reason: string;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  reviewStatus: 'approved';
};

type AiCaseAnalysis = {
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'UNKNOWN';
  facts: string[];
  legalIssues: string[];
  strengths: string[];
  weaknesses: string[];
  nextSteps: string[];
  recommendations: AiRecommendation[];
  relatedArticles: RelatedArticleResult[];
};

type CandidateArticle = {
  id: string;
  articleNumber: string;
  articleText: string;
  articleTextClean: string | null;
  articleTextReviewed: string | null;
  reviewStatus: string;
  legalSource: {
    id: string;
    titleAr: string;
    titleEn: string | null;
    slug: string;
    category: string | null;
    country: {
      code: string;
      nameAr: string;
      nameEn: string;
    };
  };
};

async function getCaseId(context: any) {
  const params = await context.params;
  return params.id;
}

function truncateText(value: string | null | undefined, maxLength = 4000) {
  if (!value) return '';

  const text = value.trim();

  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}\n\n[تم اختصار النص بسبب الطول]`;
}

function normalizeArabicText(value: string) {
  return value
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0600-\u06FFa-zA-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function extractSearchKeywords(value: string) {
  const stopWords = new Set([
    'في',
    'من',
    'على',
    'الى',
    'إلى',
    'عن',
    'أن',
    'ان',
    'إن',
    'او',
    'أو',
    'و',
    'ثم',
    'قد',
    'هذا',
    'هذه',
    'ذلك',
    'تلك',
    'هو',
    'هي',
    'مع',
    'تم',
    'غير',
    'كان',
    'كانت',
    'يكون',
    'القضيه',
    'قضيه',
    'القانون',
    'النظام',
    'الماده',
    'ماده',
    'اختبار',
    'تجريبيه',
    'test',
    'case',
    'hukumx',
  ]);

  const normalized = normalizeArabicText(value);

  const words = normalized
    .split(' ')
    .map((word) => word.trim())
    .filter((word) => word.length >= 3)
    .filter((word) => !stopWords.has(word));

  const frequency = new Map<string, number>();

  for (const word of words) {
    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  return Array.from(frequency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 16);
}

function getApprovedArticleText(article: CandidateArticle) {
  return (
    article.articleTextReviewed?.trim() ||
    article.articleTextClean?.trim() ||
    article.articleText?.trim() ||
    ''
  );
}

function scoreArticle(article: CandidateArticle, keywords: string[]) {
  const articleText = normalizeArabicText(
    `${article.legalSource.titleAr} ${article.legalSource.titleEn || ''} ${
      article.articleNumber
    } ${getApprovedArticleText(article)}`
  );

  let score = 0;

  for (const keyword of keywords) {
    if (articleText.includes(normalizeArabicText(keyword))) {
      score += 1;
    }
  }

  if (article.legalSource.category) {
    const category = normalizeArabicText(article.legalSource.category);
    for (const keyword of keywords) {
      if (category.includes(normalizeArabicText(keyword))) {
        score += 2;
      }
    }
  }

  return score;
}

async function getRelatedApprovedArticles(legalCase: any) {
  const caseTextParts: string[] = [
    legalCase.title,
    legalCase.caseType,
    legalCase.description,
    legalCase.clientName,
    legalCase.opponentName,
    legalCase.courtName,
    legalCase.caseNumber,
    ...(legalCase.documents || []).map((doc: any) =>
      [
        doc.fileName,
        doc.documentType,
        doc.cleanedText,
        doc.rawText,
        doc.aiSummary,
      ]
        .filter(Boolean)
        .join(' ')
    ),
    ...(legalCase.events || []).map((event: any) =>
      [event.title, event.description, event.eventType].filter(Boolean).join(' ')
    ),
  ].filter(Boolean);

  const caseSearchText = caseTextParts.join(' ');
  const keywords = extractSearchKeywords(caseSearchText);

  const orConditions =
    keywords.length > 0
      ? keywords.flatMap((keyword) => [
          {
            articleTextReviewed: {
              contains: keyword,
            },
          },
          {
            articleTextClean: {
              contains: keyword,
            },
          },
          {
            articleText: {
              contains: keyword,
            },
          },
          {
            articleNumber: {
              contains: keyword,
            },
          },
          {
            legalSource: {
              titleAr: {
                contains: keyword,
              },
            },
          },
          {
            legalSource: {
              titleEn: {
                contains: keyword,
              },
            },
          },
          {
            legalSource: {
              category: {
                contains: keyword,
              },
            },
          },
        ])
      : [];

  const whereClause: any = {
    reviewStatus: 'approved',
    legalSource: {
      country: {
        code: legalCase.country || 'JO',
      },
      isActive: true,
    },
  };

  if (orConditions.length > 0) {
    whereClause.OR = orConditions;
  }

  let articles = await prisma.legalArticle.findMany({
    where: whereClause,
    include: {
      legalSource: {
        include: {
          country: true,
        },
      },
    },
    take: 120,
  });

  if (articles.length === 0) {
    articles = await prisma.legalArticle.findMany({
      where: {
        reviewStatus: 'approved',
        legalSource: {
          country: {
            code: legalCase.country || 'JO',
          },
          isActive: true,
        },
      },
      include: {
        legalSource: {
          include: {
            country: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 40,
    });
  }

  const scored = articles
    .map((article) => ({
      article,
      score: scoreArticle(article as CandidateArticle, keywords),
    }))
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 20).map(({ article, score }) => ({
    id: article.id,
    score,
    legalSourceTitle: article.legalSource.titleAr,
    legalSourceSlug: article.legalSource.slug,
    category: article.legalSource.category,
    country: article.legalSource.country.code,
    articleNumber: article.articleNumber,
    reviewStatus: article.reviewStatus,
    text: truncateText(getApprovedArticleText(article as CandidateArticle), 2200),
  }));
}

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function safeRecommendations(value: unknown): AiRecommendation[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const record = item as Record<string, unknown>;

      const title = typeof record.title === 'string' ? record.title.trim() : '';
      const description =
        typeof record.description === 'string' ? record.description.trim() : '';

      const rawPriority =
        typeof record.priority === 'string'
          ? record.priority.trim().toUpperCase()
          : 'MEDIUM';

      const allowedPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

      const priority = allowedPriorities.includes(rawPriority)
        ? (rawPriority as AiRecommendation['priority'])
        : 'MEDIUM';

      const recommendationType =
        typeof record.recommendationType === 'string'
          ? record.recommendationType.trim()
          : 'AI_ANALYSIS';

      if (!title || !description) return null;

      return {
        title,
        description,
        priority,
        recommendationType: recommendationType || 'AI_ANALYSIS',
      };
    })
    .filter(Boolean) as AiRecommendation[];
}

function safeRelatedArticles(value: unknown): RelatedArticleResult[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;

      const record = item as Record<string, unknown>;

      const confidenceRaw =
        typeof record.confidence === 'string'
          ? record.confidence.trim().toUpperCase()
          : 'LOW';

      const confidence = ['LOW', 'MEDIUM', 'HIGH'].includes(confidenceRaw)
        ? (confidenceRaw as RelatedArticleResult['confidence'])
        : 'LOW';

      const articleId =
        typeof record.articleId === 'string' ? record.articleId.trim() : '';

      const legalSourceTitle =
        typeof record.legalSourceTitle === 'string'
          ? record.legalSourceTitle.trim()
          : '';

      const legalSourceSlug =
        typeof record.legalSourceSlug === 'string'
          ? record.legalSourceSlug.trim()
          : '';

      const articleNumber =
        typeof record.articleNumber === 'string'
          ? record.articleNumber.trim()
          : '';

      const reason =
        typeof record.reason === 'string' ? record.reason.trim() : '';

      if (!articleId && !articleNumber && !reason) return null;

      return {
        articleId,
        legalSourceTitle,
        legalSourceSlug,
        articleNumber,
        reason,
        confidence,
        reviewStatus: 'approved' as const,
      };
    })
    .filter(Boolean) as RelatedArticleResult[];
}

function normalizeAnalysis(value: any): AiCaseAnalysis {
  const riskLevelRaw =
    typeof value?.riskLevel === 'string'
      ? value.riskLevel.trim().toUpperCase()
      : 'UNKNOWN';

  const allowedRiskLevels = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'UNKNOWN'];

  const riskLevel = allowedRiskLevels.includes(riskLevelRaw)
    ? (riskLevelRaw as AiCaseAnalysis['riskLevel'])
    : 'UNKNOWN';

  return {
    summary:
      typeof value?.summary === 'string'
        ? value.summary.trim()
        : 'لم يتم توليد ملخص واضح للقضية.',
    riskLevel,
    facts: safeArray(value?.facts),
    legalIssues: safeArray(value?.legalIssues),
    strengths: safeArray(value?.strengths),
    weaknesses: safeArray(value?.weaknesses),
    nextSteps: safeArray(value?.nextSteps),
    recommendations: safeRecommendations(value?.recommendations),
    relatedArticles: safeRelatedArticles(value?.relatedArticles),
  };
}

function extractOutputText(openAiResponse: any) {
  if (typeof openAiResponse?.output_text === 'string') {
    return openAiResponse.output_text;
  }

  if (!Array.isArray(openAiResponse?.output)) {
    return '';
  }

  const parts: string[] = [];

  for (const outputItem of openAiResponse.output) {
    if (!Array.isArray(outputItem?.content)) continue;

    for (const contentItem of outputItem.content) {
      if (typeof contentItem?.text === 'string') {
        parts.push(contentItem.text);
      }
    }
  }

  return parts.join('\n').trim();
}

function parseJsonFromText(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error('لم يتمكن النظام من قراءة نتيجة التحليل كـ JSON');
    }

    return JSON.parse(text.slice(jsonStart, jsonEnd + 1));
  }
}

function buildCasePrompt(legalCase: any, relatedApprovedArticles: any[]) {
  const documents = legalCase.documents.map((doc: any, index: number) => ({
    index: index + 1,
    fileName: doc.fileName,
    documentType: doc.documentType,
    text: truncateText(doc.cleanedText || doc.rawText || doc.aiSummary || '', 5000),
  }));

  const events = legalCase.events.map((event: any, index: number) => ({
    index: index + 1,
    title: event.title,
    eventType: event.eventType,
    eventDate: event.eventDate,
    isCritical: event.isCritical,
    description: event.description,
  }));

  const recommendations = legalCase.recommendations.map(
    (rec: any, index: number) => ({
      index: index + 1,
      title: rec.title,
      description: rec.description,
      priority: rec.priority,
      recommendationType: rec.recommendationType,
      isDone: rec.isDone,
    })
  );

  return {
    caseInfo: {
      title: legalCase.title,
      country: legalCase.country,
      caseType: legalCase.caseType,
      status: legalCase.status,
      clientName: legalCase.clientName,
      opponentName: legalCase.opponentName,
      courtName: legalCase.courtName,
      caseNumber: legalCase.caseNumber,
      description: legalCase.description,
    },
    documents,
    events,
    currentRecommendations: recommendations,
    approvedLegalArticlesOnly: relatedApprovedArticles,
    instruction:
      'استخدم فقط المواد الموجودة داخل approvedLegalArticlesOnly عند ذكر مواد قانونية مرتبطة. إذا لم تكن المادة مناسبة، لا تذكرها. لا تختر مادة غير موجودة في القائمة.',
  };
}

const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary',
    'riskLevel',
    'facts',
    'legalIssues',
    'strengths',
    'weaknesses',
    'nextSteps',
    'recommendations',
    'relatedArticles',
  ],
  properties: {
    summary: {
      type: 'string',
      description: 'ملخص عربي واضح للقضية.',
    },
    riskLevel: {
      type: 'string',
      enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'UNKNOWN'],
    },
    facts: {
      type: 'array',
      items: { type: 'string' },
    },
    legalIssues: {
      type: 'array',
      items: { type: 'string' },
    },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    weaknesses: {
      type: 'array',
      items: { type: 'string' },
    },
    nextSteps: {
      type: 'array',
      items: { type: 'string' },
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['title', 'description', 'priority', 'recommendationType'],
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          priority: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
          },
          recommendationType: { type: 'string' },
        },
      },
    },
    relatedArticles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'articleId',
          'legalSourceTitle',
          'legalSourceSlug',
          'articleNumber',
          'reason',
          'confidence',
          'reviewStatus',
        ],
        properties: {
          articleId: { type: 'string' },
          legalSourceTitle: { type: 'string' },
          legalSourceSlug: { type: 'string' },
          articleNumber: { type: 'string' },
          reason: { type: 'string' },
          confidence: {
            type: 'string',
            enum: ['LOW', 'MEDIUM', 'HIGH'],
          },
          reviewStatus: {
            type: 'string',
            enum: ['approved'],
          },
        },
      },
    },
  },
};

export async function POST(req: NextRequest, context: any) {
  try {
    const caseId = await getCaseId(context);

    if (!caseId) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف القضية مطلوب',
        },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'OPENAI_API_KEY غير موجود في ملف البيئة',
        },
        { status: 500 }
      );
    }

    const legalCase = await prisma.legalCase.findUnique({
      where: { id: caseId },
      include: {
        documents: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        events: {
          orderBy: [
            {
              eventDate: 'asc',
            },
            {
              createdAt: 'desc',
            },
          ],
        },
        recommendations: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    if (!legalCase) {
      return NextResponse.json(
        {
          success: false,
          error: 'القضية غير موجودة',
        },
        { status: 404 }
      );
    }

    const relatedApprovedArticles = await getRelatedApprovedArticles(legalCase);
    const casePrompt = buildCasePrompt(legalCase, relatedApprovedArticles);

    const openAiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        input: [
          {
            role: 'system',
            content:
              'أنت مساعد قانوني ذكي داخل نظام Hukumx. حلّل القضية بناءً فقط على بيانات القضية والمستندات والمواد القانونية المعتمدة المقدمة لك. اكتب بالعربية الفصحى الواضحة. لا تذكر أي مادة قانونية إلا إذا كانت موجودة داخل قائمة approvedLegalArticlesOnly. لا تستخدم مواد غير معتمدة. لا تقدّم حكمًا نهائيًا، بل قدّم تحليلًا أوليًا منظّمًا قابلًا للمراجعة من محامٍ.',
          },
          {
            role: 'user',
            content: `حلّل ملف القضية التالي وأرجع النتيجة حسب JSON Schema فقط:\n\n${JSON.stringify(
              casePrompt,
              null,
              2
            )}`,
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'hukumx_case_analysis_with_approved_articles',
            strict: true,
            schema: analysisSchema,
          },
        },
      }),
    });

    const openAiJson = await openAiResponse.json();

    if (!openAiResponse.ok) {
      console.error('OpenAI analyze error:', openAiJson);

      return NextResponse.json(
        {
          success: false,
          error:
            openAiJson?.error?.message ||
            'فشل الاتصال بخدمة الذكاء الصناعي أثناء تحليل القضية',
        },
        { status: 500 }
      );
    }

    const outputText = extractOutputText(openAiJson);

    if (!outputText) {
      return NextResponse.json(
        {
          success: false,
          error: 'لم يرجع الذكاء الصناعي نتيجة قابلة للقراءة',
        },
        { status: 500 }
      );
    }

    const parsed = parseJsonFromText(outputText);
    const normalized = normalizeAnalysis(parsed);

    const createdAnalysis = await prisma.caseAnalysis.create({
      data: {
        caseId,
        summary: normalized.summary,
        facts: normalized.facts as any,
        legalIssues: normalized.legalIssues as any,
        relatedArticles: normalized.relatedArticles as any,
        strengths: normalized.strengths as any,
        weaknesses: normalized.weaknesses as any,
        nextSteps: normalized.nextSteps as any,
      },
    });

    await prisma.legalCase.update({
      where: { id: caseId },
      data: {
        aiSummary: normalized.summary,
        riskLevel: normalized.riskLevel,
      },
    });

    if (normalized.recommendations.length > 0) {
      await prisma.caseRecommendation.createMany({
        data: normalized.recommendations.slice(0, 8).map((rec) => ({
          caseId,
          title: rec.title,
          description: rec.description,
          priority: rec.priority,
          recommendationType: rec.recommendationType || 'AI_ANALYSIS',
          isDone: false,
        })),
      });
    }

    const refreshedCase = await prisma.legalCase.findUnique({
      where: { id: caseId },
      include: {
        documents: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        events: {
          orderBy: [
            {
              eventDate: 'asc',
            },
            {
              createdAt: 'desc',
            },
          ],
        },
        analyses: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        recommendations: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        analysis: createdAnalysis,
        case: refreshedCase,
        relatedApprovedArticlesCount: relatedApprovedArticles.length,
      },
    });
  } catch (error) {
    console.error('POST /api/cases/[id]/analyze error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في تحليل القضية بالذكاء الصناعي',
      },
      { status: 500 }
    );
  }
}
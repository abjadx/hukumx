import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '../../../../lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';

type LegislationType =
  | 'CONSTITUTION'
  | 'LAW'
  | 'REGULATION'
  | 'INSTRUCTIONS'
  | 'DECISION'
  | 'OTHER';

type ParsedArticle = {
  articleNumber: string;
  articleText: string;
  notes?: string;
};

type ParsedLegislation = {
  sourceTitle: string;
  sourceType: LegislationType | string;
  articles: ParsedArticle[];
};

const LEGISLATION_TYPES: Record<LegislationType, string> = {
  CONSTITUTION: 'دستور',
  LAW: 'قانون',
  REGULATION: 'نظام',
  INSTRUCTIONS: 'تعليمات',
  DECISION: 'قرار',
  OTHER: 'أخرى',
};

function getSingleFormValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeLegislationType(value: string): LegislationType {
  if (value === 'CONSTITUTION') return 'CONSTITUTION';
  if (value === 'LAW') return 'LAW';
  if (value === 'REGULATION') return 'REGULATION';
  if (value === 'INSTRUCTIONS') return 'INSTRUCTIONS';
  if (value === 'DECISION') return 'DECISION';
  return 'OTHER';
}

function cleanText(value: string) {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function trimText(value: string, maxLength: number) {
  const cleaned = cleanText(value);
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength).trim();
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

function buildDefaultSlug(params: {
  countryCode: string;
  legislationType: LegislationType;
  titleAr: string;
}) {
  const base = normalizeSlug(`${params.countryCode}-${params.legislationType}-${params.titleAr}`);
  return base || `${params.countryCode.toLowerCase()}-${params.legislationType.toLowerCase()}-${Date.now()}`;
}

function getArticleTextPreview(text: string) {
  return cleanText(text).slice(0, 220);
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

function normalizeArticleNumber(value: string, fallbackIndex: number) {
  const cleaned = convertArabicDigits(value)
    .replace(/^المادة\s*/u, '')
    .replace(/^مادة\s*/u, '')
    .replace(/[():：]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return cleaned || String(fallbackIndex + 1);
}

function makeUniqueArticleNumbers(articles: ParsedArticle[]) {
  const used = new Map<string, number>();

  return articles.map((article, index) => {
    const baseNumber = normalizeArticleNumber(article.articleNumber, index);
    const count = used.get(baseNumber) || 0;
    used.set(baseNumber, count + 1);

    return {
      ...article,
      articleNumber: count === 0 ? baseNumber : `${baseNumber}-${count + 1}`,
    };
  });
}

function splitArticlesHeuristically(text: string): ParsedArticle[] {
  const cleaned = cleanText(text);

  const articleStartRegex =
    /(?:^|\n)\s*(?:المادة|مادة)\s*(?:رقم)?\s*\(?\s*([0-9٠-٩]+|[أإآء-ي]+)\s*\)?\s*[:：.\-–]?\s*/g;

  const matches = Array.from(cleaned.matchAll(articleStartRegex));

  if (matches.length > 0) {
    const articles: ParsedArticle[] = [];

    for (let i = 0; i < matches.length; i += 1) {
      const match = matches[i];
      const nextMatch = matches[i + 1];
      const start = match.index || 0;
      const end = nextMatch?.index ?? cleaned.length;
      const block = cleaned.slice(start, end).trim();
      const articleNumber = normalizeArticleNumber(match[1] || String(i + 1), i);

      if (block.length > 20) {
        articles.push({
          articleNumber,
          articleText: block,
          notes: 'تم تقسيم المادة آليًا من النص عند تعذر أو عدم كفاية تقسيم الذكاء الصناعي.',
        });
      }
    }

    return makeUniqueArticleNumbers(articles);
  }

  const numberedLineRegex = /(?:^|\n)\s*([0-9٠-٩]{1,4})\s*[\).\-/]\s+/g;
  const numberedMatches = Array.from(cleaned.matchAll(numberedLineRegex));

  if (numberedMatches.length > 2) {
    const articles: ParsedArticle[] = [];

    for (let i = 0; i < numberedMatches.length; i += 1) {
      const match = numberedMatches[i];
      const nextMatch = numberedMatches[i + 1];
      const start = match.index || 0;
      const end = nextMatch?.index ?? cleaned.length;
      const block = cleaned.slice(start, end).trim();

      if (block.length > 20) {
        articles.push({
          articleNumber: normalizeArticleNumber(match[1] || String(i + 1), i),
          articleText: block,
          notes: 'تم تقسيم البنود المرقمة آليًا من النص.',
        });
      }
    }

    return makeUniqueArticleNumbers(articles);
  }

  if (cleaned.length > 20) {
    return [
      {
        articleNumber: '1',
        articleText: cleaned,
        notes: 'لم يتم العثور على ترقيم واضح للمواد، فتم حفظ النص كمادة واحدة للمراجعة البشرية.',
      },
    ];
  }

  return [];
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

function normalizeParsedLegislation(
  parsed: Partial<ParsedLegislation>,
  fallbackTitle: string,
  fallbackType: LegislationType
): ParsedLegislation {
  const articles = Array.isArray(parsed.articles)
    ? parsed.articles
        .filter((item) => item && typeof item === 'object')
        .map((item, index) => {
          const article = item as Partial<ParsedArticle>;

          return {
            articleNumber:
              typeof article.articleNumber === 'string'
                ? normalizeArticleNumber(article.articleNumber, index)
                : String(index + 1),
            articleText:
              typeof article.articleText === 'string' ? cleanText(article.articleText) : '',
            notes: typeof article.notes === 'string' ? article.notes : '',
          };
        })
        .filter((item) => item.articleText.length > 20)
    : [];

  return {
    sourceTitle:
      typeof parsed.sourceTitle === 'string' && parsed.sourceTitle.trim()
        ? parsed.sourceTitle.trim()
        : fallbackTitle,
    sourceType:
      typeof parsed.sourceType === 'string' && parsed.sourceType.trim()
        ? parsed.sourceType.trim()
        : fallbackType,
    articles: makeUniqueArticleNumbers(articles),
  };
}

async function parseLegislationWithAI(params: {
  titleAr: string;
  legislationType: LegislationType;
  countryNameAr: string;
  text: string;
}): Promise<ParsedLegislation | null> {
  if (!process.env.OPENAI_API_KEY) return null;

  const textForAi = trimText(params.text, 90000);

  const response = await openai.responses.create({
    model: OPENAI_MODEL,
    temperature: 0,
    input: [
      {
        role: 'system',
        content: `
أنت مساعد قانوني عربي متخصص في إدخال التشريعات إلى قاعدة بيانات قانونية.

مهمتك:
- قراءة نص تشريع عربي مستخرج من PDF أو TXT.
- تمييز المواد القانونية وفصلها إلى مواد مستقلة.
- الحفاظ على نص المادة كاملًا قدر الإمكان.
- تنظيف أخطاء التنسيق البسيطة فقط مثل فواصل الأسطر غير المنطقية والمسافات الزائدة.
- عدم تلخيص المواد.
- عدم إضافة أحكام أو مواد غير موجودة.
- عدم اختراع أرقام مواد.
- إذا كان التشريع دستورًا أو قانونًا أو نظامًا أو تعليمات أو قرارًا، حافظ على هذا التصنيف.
- إذا لم تجد مواد واضحة، أعد النص كبند واحد articleNumber = "1".
- أعد JSON فقط، بدون Markdown.
        `.trim(),
      },
      {
        role: 'user',
        content: `
الدولة: ${params.countryNameAr}
نوع التشريع: ${LEGISLATION_TYPES[params.legislationType]}
عنوان التشريع: ${params.titleAr}

النص المستخرج من الملف:
${textForAi}
        `.trim(),
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'legislation_import_parser',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sourceTitle: { type: 'string' },
            sourceType: {
              type: 'string',
              enum: ['CONSTITUTION', 'LAW', 'REGULATION', 'INSTRUCTIONS', 'DECISION', 'OTHER'],
            },
            articles: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  articleNumber: { type: 'string' },
                  articleText: { type: 'string' },
                  notes: { type: 'string' },
                },
                required: ['articleNumber', 'articleText', 'notes'],
              },
            },
          },
          required: ['sourceTitle', 'sourceType', 'articles'],
        },
      },
    },
  });

  const outputText = extractOutputText(response).trim();

  if (!outputText) return null;

  try {
    const parsed = JSON.parse(outputText) as Partial<ParsedLegislation>;
    const normalized = normalizeParsedLegislation(
      parsed,
      params.titleAr,
      params.legislationType
    );

    if (normalized.articles.length > 0) {
      return normalized;
    }

    return null;
  } catch {
    return null;
  }
}

type PdfParseFunction = (buffer: Buffer) => Promise<{ text?: string }>;

async function parsePdfBuffer(buffer: Buffer) {
  // نستدعي ملف المكتبة الداخلي بدل import من pdf-parse مباشرة.
  // الاستيراد المباشر من pdf-parse يشغّل كود debug أثناء next build
  // ويحاول قراءة test/data/05-versions-space.pdf، وهذا سبب خطأ ENOENT.
  const requireFunc = eval('require') as NodeRequire;
  const pdfParse = requireFunc('pdf-parse/lib/pdf-parse.js') as PdfParseFunction;
  const parsed = await pdfParse(buffer);

  return cleanText(parsed.text || '');
}

async function extractFileText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const lowerName = file.name.toLowerCase();

  if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
    return parsePdfBuffer(buffer);
  }

  if (
    file.type === 'text/plain' ||
    lowerName.endsWith('.txt') ||
    lowerName.endsWith('.md')
  ) {
    return cleanText(buffer.toString('utf8'));
  }

  throw new Error('نوع الملف غير مدعوم. ارفع ملف PDF نصي أو TXT فقط.');
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    const adminKey = getSingleFormValue(formData, 'key');
    const expectedAdminKey = process.env.ADMIN_ACCESS_KEY;

    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'غير مصرح. تحقق من مفتاح الإدارة.',
        },
        { status: 401 }
      );
    }

    const countryCode = getSingleFormValue(formData, 'countryCode') || 'JO';
    const countryNameAr = getSingleFormValue(formData, 'countryNameAr') || 'الأردن';
    const countryNameEn = getSingleFormValue(formData, 'countryNameEn') || 'Jordan';
    const titleAr = getSingleFormValue(formData, 'titleAr');
    const titleEn = getSingleFormValue(formData, 'titleEn') || null;
    const legislationType = normalizeLegislationType(
      getSingleFormValue(formData, 'legislationType')
    );
    const replaceExisting = getSingleFormValue(formData, 'replaceExisting') === 'true';

    const slug =
      normalizeSlug(getSingleFormValue(formData, 'slug')) ||
      buildDefaultSlug({
        countryCode,
        legislationType,
        titleAr,
      });

    const fileValue = formData.get('file');

    if (!titleAr) {
      return NextResponse.json(
        {
          success: false,
          error: 'يرجى إدخال عنوان التشريع.',
        },
        { status: 400 }
      );
    }

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: 'يرجى رفع ملف PDF أو TXT.',
        },
        { status: 400 }
      );
    }

    if (fileValue.size > 18 * 1024 * 1024) {
      return NextResponse.json(
        {
          success: false,
          error: 'حجم الملف كبير جدًا. الحد الحالي 18MB.',
        },
        { status: 400 }
      );
    }

    const extractedText = await extractFileText(fileValue);

    if (extractedText.length < 80) {
      return NextResponse.json(
        {
          success: false,
          error:
            'لم يتم استخراج نص كافٍ من الملف. إذا كان PDF مصورًا، يحتاج OCR وسيتم تأجيله لمرحلة لاحقة.',
        },
        { status: 400 }
      );
    }

    const existingSource = await prisma.legalSource.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existingSource && !replaceExisting) {
      return NextResponse.json(
        {
          success: false,
          error:
            'يوجد تشريع بنفس slug. فعّل خيار استبدال التشريع الموجود أو غيّر slug.',
        },
        { status: 409 }
      );
    }

    const aiParsed = await parseLegislationWithAI({
      titleAr,
      legislationType,
      countryNameAr,
      text: extractedText,
    });

    const fallbackArticles = splitArticlesHeuristically(extractedText);

    const parsedLegislation =
      aiParsed && aiParsed.articles.length >= Math.min(2, fallbackArticles.length || 1)
        ? aiParsed
        : {
            sourceTitle: titleAr,
            sourceType: legislationType,
            articles: fallbackArticles,
          };

    if (!parsedLegislation.articles.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'تعذر استخراج مواد من الملف.',
        },
        { status: 400 }
      );
    }

    const country = await prisma.country.upsert({
      where: { code: countryCode },
      update: {
        nameAr: countryNameAr,
        nameEn: countryNameEn,
      },
      create: {
        code: countryCode,
        nameAr: countryNameAr,
        nameEn: countryNameEn,
      },
    });

    let legalSource;

    if (existingSource && replaceExisting) {
      await prisma.legalArticle.deleteMany({
        where: { legalSourceId: existingSource.id },
      });

      legalSource = await prisma.legalSource.update({
        where: { id: existingSource.id },
        data: {
          countryId: country.id,
          titleAr,
          titleEn,
          category: legislationType,
          fileName: fileValue.name,
          isActive: true,
        },
      });
    } else {
      legalSource = await prisma.legalSource.create({
        data: {
          countryId: country.id,
          titleAr,
          titleEn,
          slug,
          category: legislationType,
          fileName: fileValue.name,
          isActive: true,
        },
      });
    }

    const articlesToInsert = makeUniqueArticleNumbers(parsedLegislation.articles)
      .map((article) => ({
        legalSourceId: legalSource.id,
        articleNumber: article.articleNumber,
        articleText: article.articleText,
        articleTextClean: article.articleText,
        articleTextReviewed: article.articleText,
        reviewStatus: 'needs_review',
        reviewNotes: [
          `تم إدخال هذه المادة من ملف ${fileValue.name}.`,
          `نوع التشريع: ${LEGISLATION_TYPES[legislationType]}.`,
          aiParsed
            ? 'تم تقسيم وتنظيف النص مبدئيًا بالذكاء الصناعي ويحتاج اعتمادًا بشريًا.'
            : 'تم تقسيم النص آليًا بدون AI أو بعد تعذر قراءة نتيجة AI ويحتاج مراجعة بشرية.',
          article.notes ? `ملاحظة: ${article.notes}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      }))
      .filter((article) => article.articleText.trim().length > 20);

    await prisma.legalArticle.createMany({
      data: articlesToInsert,
    });

    return NextResponse.json({
      success: true,
      data: {
        sourceId: legalSource.id,
        sourceSlug: legalSource.slug,
        sourceTitle: legalSource.titleAr,
        legislationType,
        legislationTypeLabel: LEGISLATION_TYPES[legislationType],
        fileName: fileValue.name,
        extractedTextLength: extractedText.length,
        insertedArticlesCount: articlesToInsert.length,
        parsingMode: aiParsed ? 'AI' : 'AUTO_SPLIT',
        reviewStatus: 'needs_review',
        preview: articlesToInsert.slice(0, 5).map((article) => ({
          articleNumber: article.articleNumber,
          text: getArticleTextPreview(article.articleText),
        })),
      },
    });
  } catch (error) {
    console.error('Hukumx legislation import error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'حدث خطأ أثناء إدخال التشريع من الملف.',
      },
      { status: 500 }
    );
  }
}

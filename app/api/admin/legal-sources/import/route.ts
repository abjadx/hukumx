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

type ArticleHeadingMatch = {
  articleNumber: number;
  start: number;
  end: number;
  line: string;
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

function cleanText(value: string) {
  return value
    .normalize('NFKC')
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

function parseExpectedArticleCount(value: string) {
  const normalized = Number(convertArabicDigits(value).replace(/[^\d]/g, ''));
  if (!Number.isFinite(normalized) || normalized <= 0) return 0;
  return normalized;
}

function normalizeArticleNumber(value: string, fallbackIndex: number) {
  const numbers = convertArabicDigits(value).match(/[0-9]{1,4}/g);
  const lastNumber = numbers?.[numbers.length - 1];

  const cleaned = convertArabicDigits(value)
    .replace(/^المادة\s*/u, '')
    .replace(/^مادة\s*/u, '')
    .replace(/[():：]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return lastNumber || cleaned || String(fallbackIndex + 1);
}

function getArticleSortNumber(value: string) {
  const numbers = convertArabicDigits(value).match(/[0-9]{1,4}/g);
  if (!numbers?.length) return Number.POSITIVE_INFINITY;

  const parsed = Number(numbers[numbers.length - 1]);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function sortParsedArticlesByNumber(articles: ParsedArticle[]) {
  return [...articles].sort((a, b) => {
    const numberA = getArticleSortNumber(a.articleNumber);
    const numberB = getArticleSortNumber(b.articleNumber);

    if (Number.isFinite(numberA) && Number.isFinite(numberB) && numberA !== numberB) {
      return numberA - numberB;
    }

    return String(a.articleNumber).localeCompare(String(b.articleNumber), 'ar');
  });
}

function makeUniqueArticleNumbers(articles: ParsedArticle[]) {
  const used = new Map<string, number>();

  return sortParsedArticlesByNumber(articles).map((article, index) => {
    const baseNumber = normalizeArticleNumber(article.articleNumber, index);
    const count = used.get(baseNumber) || 0;
    used.set(baseNumber, count + 1);

    return {
      ...article,
      articleNumber: count === 0 ? baseNumber : `${baseNumber}-${count + 1}`,
    };
  });
}

function normalizeTextForArticleDetection(value: string) {
  let text = cleanText(value);

  // بعض ملفات PDF الأردنية تعكس ترتيب العنوان فيظهر "1المادة" أو "-1المادة".
  // نحوله إلى صيغة موحدة: "المادة 1" حتى لا يفوت النظام أي مادة.
  text = text
    .replace(/(^|\n)\s*([0-9٠-٩]{1,4})\s*المادة/g, '$1\nالمادة $2')
    .replace(/(^|\n)\s*[-–—:：]\s*([0-9٠-٩]{1,4})\s*المادة/g, '$1\nالمادة $2')
    .replace(/المادة\s*[-:：–—]*\s*([0-9٠-٩]{1,4})/g, '\nالمادة $1')
    .replace(/\n{3,}/g, '\n\n');

  return cleanText(text);
}

function isNoiseLine(line: string) {
  const value = line.trim();

  if (!value) return true;
  if (/^ارتباطات المادة$/u.test(value)) return true;
  if (/^تعديلات المادة$/u.test(value)) return true;
  if (/^[0-9٠-٩]+\s*تعديلات المادة$/u.test(value)) return true;
  if (/^التشريعات المرتبطة\s*[0-9٠-٩]*$/u.test(value)) return true;
  if (/^تعديلات$/u.test(value)) return true;
  if (/^روابط ذات صلة$/u.test(value)) return true;
  if (/^E$/u.test(value)) return true;
  if (/^$/u.test(value)) return true;

  return false;
}

function isFooterLine(line: string) {
  const value = line.trim();

  return (
    value.includes('في سياق سعي ديوان التشريع') ||
    value.includes('CopyRight') ||
    value.includes('All Rights Reserved') ||
    value.includes('اشترك في نشرة') ||
    value.includes('اتصل بنا') ||
    value.includes('خريطة الموقع') ||
    value.includes('ادخل الاسم') ||
    value.includes('ادخل البريد') ||
    value.includes('ادخل الرسالة') ||
    value.includes('رقم الفاكس') ||
    value.includes('البريد الالكتروني') ||
    value.includes('dewanlob')
  );
}

function cleanArticleBlock(value: string) {
  const lines = cleanText(value).split('\n');
  const cleanedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (isFooterLine(trimmed)) {
      break;
    }

    if (isNoiseLine(trimmed)) {
      continue;
    }

    cleanedLines.push(trimmed);
  }

  return cleanText(cleanedLines.join('\n'));
}

function findArticleHeadingMatches(text: string, maxArticleNumber = 9999): {
  normalizedText: string;
  matches: ArticleHeadingMatch[];
} {
  const normalizedText = normalizeTextForArticleDetection(text);
  const rawLines = normalizedText.match(/[^\n]*(?:\n|$)/g) || [];

  let offset = 0;
  const matches: ArticleHeadingMatch[] = [];

  for (const rawLine of rawLines) {
    const lineStart = offset;
    offset += rawLine.length;

    const line = rawLine.trim();

    if (!line || !line.includes('المادة')) continue;
    if (line.includes('تعديلات المادة') || line.includes('ارتباطات المادة')) continue;

    const digitMatches = line.match(/[0-9٠-٩]{1,4}/g) || [];
    if (!digitMatches.length) continue;

    // نأخذ آخر رقم في السطر لأن بعض ملفات PDF تظهر العنوان مثل: "المادة 3 123".
    const lastNumber = Number(convertArabicDigits(digitMatches[digitMatches.length - 1]));
    if (!Number.isFinite(lastNumber)) continue;
    if (lastNumber < 1 || lastNumber > maxArticleNumber) continue;

    matches.push({
      articleNumber: lastNumber,
      start: lineStart,
      end: lineStart + rawLine.length,
      line,
    });
  }

  return { normalizedText, matches };
}

function splitArticlesByExpectedSequence(text: string, expectedArticleCount: number): {
  articles: ParsedArticle[];
  missingNumbers: number[];
} {
  if (!expectedArticleCount || expectedArticleCount <= 0) {
    return { articles: [], missingNumbers: [] };
  }

  const { normalizedText, matches } = findArticleHeadingMatches(text, expectedArticleCount);
  const selectedMatches: ArticleHeadingMatch[] = [];
  const missingNumbers: number[] = [];
  let lastStart = -1;

  for (let articleNumber = 1; articleNumber <= expectedArticleCount; articleNumber += 1) {
    const candidates = matches.filter(
      (match) => match.articleNumber === articleNumber && match.start > lastStart
    );

    if (!candidates.length) {
      missingNumbers.push(articleNumber);
      continue;
    }

    const nextMatch =
      articleNumber < expectedArticleCount
        ? matches.find(
            (match) => match.articleNumber === articleNumber + 1 && match.start > lastStart
          )
        : null;

    const boundary = nextMatch?.start ?? normalizedText.length + 1;

    // عند وجود عنوانين لنفس المادة بسبب عناوين الفصول أو الغلاف، نأخذ الأخير قبل المادة التالية.
    const candidatesBeforeNextArticle = candidates.filter((match) => match.start < boundary);
    const selected =
      candidatesBeforeNextArticle[candidatesBeforeNextArticle.length - 1] ||
      candidates[candidates.length - 1];

    selectedMatches.push(selected);
    lastStart = selected.start;
  }

  if (missingNumbers.length) {
    return { articles: [], missingNumbers };
  }

  const articles = selectedMatches
    .map((match, index) => {
      const nextMatch = selectedMatches[index + 1];
      const end = nextMatch?.start ?? normalizedText.length;
      const articleText = cleanArticleBlock(normalizedText.slice(match.end, end));

      return {
        articleNumber: String(match.articleNumber),
        articleText,
        notes:
          'تم استخراج هذه المادة بآلية تسلسل المواد حسب العدد الحقيقي المدخل، مع معالجة عناوين PDF المعكوسة والمتكررة.',
      };
    })
    .filter((article) => article.articleText.trim().length > 10);

  return {
    articles: makeUniqueArticleNumbers(articles),
    missingNumbers: [],
  };
}

function splitArticlesHeuristically(text: string): ParsedArticle[] {
  const { normalizedText, matches } = findArticleHeadingMatches(text, 9999);

  if (matches.length > 0) {
    const selectedMatches: ArticleHeadingMatch[] = [];

    for (const match of matches) {
      const last = selectedMatches[selectedMatches.length - 1];

      if (last?.articleNumber === match.articleNumber) {
        selectedMatches[selectedMatches.length - 1] = match;
      } else {
        selectedMatches.push(match);
      }
    }

    const articles = selectedMatches
      .map((match, index) => {
        const nextMatch = selectedMatches[index + 1];
        const end = nextMatch?.start ?? normalizedText.length;
        const articleText = cleanArticleBlock(normalizedText.slice(match.end, end));

        return {
          articleNumber: String(match.articleNumber),
          articleText,
          notes: 'تم تقسيم المادة آليًا من النص عند تعذر أو عدم كفاية تقسيم الذكاء الصناعي.',
        };
      })
      .filter((article) => article.articleText.trim().length > 20);

    return makeUniqueArticleNumbers(articles);
  }

  const cleaned = cleanText(text);
  const numberedLineRegex = /(?:^|\n)\s*([0-9٠-٩]{1,4})\s*[\).\-/]\s+/g;
  const numberedMatches = Array.from(cleaned.matchAll(numberedLineRegex));

  if (numberedMatches.length > 2) {
    const articles: ParsedArticle[] = [];

    for (let i = 0; i < numberedMatches.length; i += 1) {
      const match = numberedMatches[i];
      const nextMatch = numberedMatches[i + 1];
      const start = match.index || 0;
      const end = nextMatch?.index ?? cleaned.length;
      const block = cleanArticleBlock(cleaned.slice(start, end).trim());

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
              typeof article.articleText === 'string'
                ? cleanArticleBlock(article.articleText)
                : '',
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
- الحفاظ على ترتيب المواد تصاعديًا حسب رقم المادة.
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
  // ويحاول قراءة test/data/05-versions-space.pdf.
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
    const expectedArticleCount = parseExpectedArticleCount(
      getSingleFormValue(formData, 'expectedArticleCount')
    );

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

    const expectedSplitResult = expectedArticleCount
      ? splitArticlesByExpectedSequence(extractedText, expectedArticleCount)
      : { articles: [] as ParsedArticle[], missingNumbers: [] as number[] };

    if (expectedArticleCount > 0 && expectedSplitResult.articles.length !== expectedArticleCount) {
      const missingText = expectedSplitResult.missingNumbers.length
        ? ` المواد التي لم يتم العثور عليها: ${expectedSplitResult.missingNumbers
            .slice(0, 30)
            .join(', ')}${expectedSplitResult.missingNumbers.length > 30 ? '...' : ''}`
        : '';

      return NextResponse.json(
        {
          success: false,
          error: `عدد المواد المستخرجة لا يطابق العدد الحقيقي الذي أدخلته. العدد الحقيقي: ${expectedArticleCount}، والمواد المستخرجة: ${expectedSplitResult.articles.length}. لم يتم إدخال التشريع إلى قاعدة البيانات.${missingText}`,
          data: {
            expectedArticleCount,
            extractedArticlesCount: expectedSplitResult.articles.length,
            missingNumbers: expectedSplitResult.missingNumbers,
            extractedTextLength: extractedText.length,
          },
        },
        { status: 400 }
      );
    }

    const fallbackArticles = expectedSplitResult.articles.length
      ? expectedSplitResult.articles
      : splitArticlesHeuristically(extractedText);

    const aiParsed = expectedArticleCount
      ? null
      : await parseLegislationWithAI({
          titleAr,
          legislationType,
          countryNameAr,
          text: extractedText,
        });

    const parsedLegislation =
      aiParsed && aiParsed.articles.length > fallbackArticles.length
        ? aiParsed
        : {
            sourceTitle: titleAr,
            sourceType: legislationType,
            articles: fallbackArticles,
          };

    const finalArticles = makeUniqueArticleNumbers(parsedLegislation.articles);

    if (!finalArticles.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'تعذر استخراج مواد من الملف.',
        },
        { status: 400 }
      );
    }

    if (expectedArticleCount > 0 && finalArticles.length !== expectedArticleCount) {
      return NextResponse.json(
        {
          success: false,
          error: `عدد المواد المستخرجة لا يطابق العدد الحقيقي الذي أدخلته. العدد الحقيقي: ${expectedArticleCount}، والمواد المستخرجة: ${finalArticles.length}. لم يتم إدخال التشريع إلى قاعدة البيانات.`,
          data: {
            expectedArticleCount,
            extractedArticlesCount: finalArticles.length,
            extractedTextLength: extractedText.length,
          },
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

    const articlesToInsert = finalArticles
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
          expectedArticleCount
            ? `تم التحقق من العدد الحقيقي للمواد: ${expectedArticleCount}.`
            : '',
          expectedArticleCount
            ? 'تم استخراج المواد بآلية تسلسل رقمية صارمة اعتمادًا على العدد الحقيقي المدخل.'
            : aiParsed && aiParsed.articles.length > fallbackArticles.length
              ? 'تم تقسيم وتنظيف النص مبدئيًا بالذكاء الصناعي ويحتاج اعتمادًا بشريًا.'
              : 'تم تقسيم النص آليًا ويحتاج مراجعة بشرية.',
          article.notes ? `ملاحظة: ${article.notes}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
      }))
      .filter((article) => article.articleText.trim().length > 10);

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
        expectedArticleCount: expectedArticleCount || null,
        extractedTextLength: extractedText.length,
        insertedArticlesCount: articlesToInsert.length,
        parsingMode: expectedArticleCount
          ? 'SEQUENCE_EXPECTED_COUNT'
          : aiParsed && aiParsed.articles.length > fallbackArticles.length
            ? 'AI_ORDERED'
            : 'AUTO_SPLIT_ORDERED',
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

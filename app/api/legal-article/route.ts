import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export const runtime = 'nodejs';

type ArticleWithSource = {
  articleNumber: string;
  articleText: string;
  articleTextClean: string | null;
  articleTextReviewed: string | null;
  reviewStatus: string;
  legalSource: {
    titleAr: string;
    titleEn: string | null;
    slug: string;
    country: {
      nameAr: string;
    };
  };
};

function normalizeArticleNumber(value: string): string {
  return value.replace(/[^d]/g, '').trim();
}

function normalizeArabic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniqueStrings(items: string[]): string[] {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));
}

function tokenizeSourceTitle(value: string): string[] {
  return uniqueStrings(
    normalizeArabic(value)
      .split(/[^\u0600-\u06FF0-9]+/g)
      .map((term) => term.trim())
      .filter((term) => term.length >= 3)
      .filter(
        (term) =>
          ![
            'قانون',
            'القانون',
            'لسنه',
            'سنه',
            'اردني',
            'الاردني',
            'الاردنيه',
            'المملكه',
            'الهاشميه',
          ].includes(term)
      )
  );
}

function extractYears(value: string): string[] {
  return uniqueStrings(value.match(/\b(?:19|20)\d{2}\b/g) || []);
}

function scoreSourceTitleMatch(article: ArticleWithSource, requestedTitle: string): number {
  const requested = normalizeArabic(requestedTitle);
  const titleAr = normalizeArabic(article.legalSource.titleAr);
  const titleEn = normalizeArabic(article.legalSource.titleEn || '');
  const slug = normalizeArabic(article.legalSource.slug);

  if (!requested) {
    return 1;
  }

  let score = 0;

  if (titleAr === requested || titleEn === requested || slug === requested) {
    score += 1000;
  }

  if (requested.includes(titleAr) || titleAr.includes(requested)) {
    score += 600;
  }

  const requestedTokens = tokenizeSourceTitle(requestedTitle);
  const sourceTokens = tokenizeSourceTitle(
    [article.legalSource.titleAr, article.legalSource.titleEn || '', article.legalSource.slug]
      .filter(Boolean)
      .join(' ')
  );

  for (const token of requestedTokens) {
    if (sourceTokens.includes(token)) {
      score += 80;
    }
  }

  const requestedYears = extractYears(requestedTitle);
  const sourceYears = extractYears(article.legalSource.titleAr);

  for (const year of requestedYears) {
    if (sourceYears.includes(year)) {
      score += 120;
    }
  }

  if (requested.includes('دستور') && titleAr.includes('دستور')) {
    score += 500;
  }

  if (
    requested.includes('اصول المحاكمات') &&
    (titleAr.includes('اصول المحاكمات') || titleAr.includes('محاكمات مدنيه'))
  ) {
    score += 500;
  }

  return score;
}

function cleanArticleTextForDisplay(value: string): string {
  return value
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/[（]/g, '(')
    .replace(/[）]/g, ')')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s*\.(\d+)(?=[\u0600-\u06FF])/gm, '$1. ')
    .replace(/^\s*\)\s*(\d+)(?=[\u0600-\u06FF])/gm, '$1. ')
    .replace(/^\s*(\d+)(?=[\u0600-\u06FF])/gm, '$1. ')
    .replace(/(\d+)(?=[\u0600-\u06FF])/g, '$1 ')
    .replace(/\s+([،.:؛])/g, '$1')
    .replace(/([،.:؛])([^\s\n])/g, '$1 $2')
    .trim();
}

function getApprovedArticleText(article: {
  articleTextReviewed: string | null;
  reviewStatus: string;
}) {
  if (
    article.reviewStatus === 'approved' &&
    article.articleTextReviewed &&
    article.articleTextReviewed.trim()
  ) {
    return article.articleTextReviewed;
  }

  return '';
}

async function findLegalArticle(params: {
  articleNumber: string;
  country?: string;
  sourceTitle?: string;
}) {
  const articleNumber = normalizeArticleNumber(params.articleNumber);
  const requestedSourceTitle = String(params.sourceTitle || '').trim();

  const candidates = (await prisma.legalArticle.findMany({
    where: {
      articleNumber,
      reviewStatus: 'approved',
      articleTextReviewed: {
        not: null,
      },
      legalSource: {
        isActive: true,
        country: {
          code: 'JO',
        },
      },
    },
    include: {
      legalSource: {
        include: {
          country: true,
        },
      },
    },
  })) as ArticleWithSource[];

  if (!candidates.length) {
    return null;
  }

  if (!requestedSourceTitle) {
    return candidates[0];
  }

  const ranked = candidates
    .map((article) => ({
      article,
      score: scoreSourceTitleMatch(article, requestedSourceTitle),
    }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (!best || best.score < 80) {
    return null;
  }

  return best.article;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      country?: string;
      sourceTitle?: string;
      articleNumber?: string;
    };

    const articleNumber = normalizeArticleNumber(
      String(body.articleNumber || '')
    );

    if (!articleNumber) {
      return NextResponse.json(
        { error: 'رقم المادة مطلوب.' },
        { status: 400 }
      );
    }

    const sourceTitle = String(body.sourceTitle || '').trim();

    const article = await findLegalArticle({
      articleNumber,
      country: String(body.country || '').trim(),
      sourceTitle,
    });

    if (!article) {
      return NextResponse.json(
        {
          error: sourceTitle
            ? `لم يتم العثور على المادة ${articleNumber} ضمن المصدر: ${sourceTitle}.`
            : `لم يتم العثور على المادة ${articleNumber} ضمن المواد المعتمدة في قاعدة البيانات.`,
        },
        { status: 404 }
      );
    }

    const bestArticleText = getApprovedArticleText(article);

    if (!bestArticleText) {
      return NextResponse.json(
        {
          error: `المادة ${articleNumber} موجودة لكنها غير معتمدة بعد.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      articleNumber: article.articleNumber,
      sourceTitle: article.legalSource.titleAr,
      country: article.legalSource.country.nameAr,
      reviewStatus: article.reviewStatus,
      isReviewed: article.reviewStatus === 'approved',
      articleText: cleanArticleTextForDisplay(bestArticleText),
    });
  } catch (error) {
    console.error('Legal article database lookup error:', error);

    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب نص المادة من قاعدة البيانات.' },
      { status: 500 }
    );
  }
}

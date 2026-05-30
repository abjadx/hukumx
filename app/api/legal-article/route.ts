import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export const runtime = 'nodejs';

function normalizeArticleNumber(value: string): string {
  return String(value || '').replace(/[^d]/g, '').trim();
}

function normalizeArabic(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanArticleTextForDisplay(value: string): string {
  return String(value || '')
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

function scoreSourceTitleMatch(sourceTitleFromQuestion: string, dbTitle: string, dbSlug: string) {
  const requested = normalizeArabic(sourceTitleFromQuestion);
  const title = normalizeArabic(dbTitle);
  const slug = normalizeArabic(dbSlug);

  if (!requested) return 0;

  let score = 0;

  if (title === requested) score += 1000;
  if (title.includes(requested) || requested.includes(title)) score += 800;

  if (requested.includes('دستور') && title.includes('دستور')) score += 1000;
  if (requested.includes('اصول المحاكمات') && title.includes('اصول المحاكمات')) score += 1000;
  if (requested.includes('محاكمات مدنيه') && title.includes('محاكمات مدنيه')) score += 1000;

  for (const term of requested.split(' ').filter((item) => item.length >= 3)) {
    if (title.includes(term) || slug.includes(term)) score += 20;
  }

  return score;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      country?: string;
      sourceTitle?: string;
      articleNumber?: string;
      number?: string;
      article?: string;
    };

    const articleNumber = normalizeArticleNumber(
      body.articleNumber || body.number || body.article || ''
    );

    if (!articleNumber) {
      return NextResponse.json(
        {
          error: 'رقم المادة مطلوب.',
          receivedBody: body,
        },
        { status: 400 }
      );
    }

    const requestedSourceTitle = String(body.sourceTitle || '').trim();

    const articles = await prisma.legalArticle.findMany({
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
    });

    if (!articles.length) {
      return NextResponse.json(
        {
          error: `لم يتم العثور على المادة ${articleNumber} ضمن المواد المعتمدة.`,
        },
        { status: 404 }
      );
    }

    const rankedArticles = articles
      .map((article) => ({
        article,
        score: scoreSourceTitleMatch(
          requestedSourceTitle,
          article.legalSource.titleAr,
          article.legalSource.slug
        ),
      }))
      .sort((a, b) => b.score - a.score);

    const selected = rankedArticles[0]?.article;

    if (!selected) {
      return NextResponse.json(
        {
          error: `لم يتم العثور على المادة ${articleNumber} من المصدر القانوني المطلوب.`,
        },
        { status: 404 }
      );
    }

    const bestArticleText = getApprovedArticleText(selected);

    if (!bestArticleText) {
      return NextResponse.json(
        {
          error: `المادة ${articleNumber} موجودة لكنها غير معتمدة بعد.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      articleNumber: selected.articleNumber,
      sourceTitle: selected.legalSource.titleAr,
      country: selected.legalSource.country.nameAr,
      reviewStatus: selected.reviewStatus,
      isReviewed: true,
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

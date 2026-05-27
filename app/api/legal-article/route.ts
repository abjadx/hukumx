import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

export const runtime = 'nodejs';

function normalizeArticleNumber(value: string): string {
  return value.replace(/[^\d]/g, '').trim();
}

function normalizeArabic(value: string): string {
  return value
    .toLowerCase()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
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

async function findLegalArticle(params: {
  articleNumber: string;
  country?: string;
  sourceTitle?: string;
}) {
  const articleNumber = normalizeArticleNumber(params.articleNumber);
  const country = normalizeArabic(params.country || '');
  const sourceTitle = normalizeArabic(params.sourceTitle || '');

  const article = await prisma.legalArticle.findFirst({
    where: {
      articleNumber,
      legalSource: {
        isActive: true,
        country: country
          ? {
              OR: [
                { nameAr: { contains: params.country || '' } },
                { nameEn: { contains: params.country || '', mode: 'insensitive' } },
                { code: { equals: 'JO' } },
              ],
            }
          : undefined,
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

  if (article) {
    const dbSourceTitle = normalizeArabic(article.legalSource.titleAr);

    if (
      !sourceTitle ||
      dbSourceTitle.includes(sourceTitle) ||
      sourceTitle.includes(dbSourceTitle) ||
      article.legalSource.slug === 'jordan-civil-procedure-law'
    ) {
      return article;
    }
  }

  return prisma.legalArticle.findFirst({
    where: {
      articleNumber,
      legalSource: {
        isActive: true,
        slug: 'jordan-civil-procedure-law',
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

    const article = await findLegalArticle({
      articleNumber,
      country: String(body.country || '').trim(),
      sourceTitle: String(body.sourceTitle || '').trim(),
    });

    if (!article) {
      return NextResponse.json(
        {
          error: `لم يتم العثور على المادة ${articleNumber} داخل قاعدة البيانات.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      articleNumber: article.articleNumber,
      sourceTitle: article.legalSource.titleAr,
      country: article.legalSource.country.nameAr,
      articleText: cleanArticleTextForDisplay(
        article.articleTextClean || article.articleText
      ),
    });
  } catch (error) {
    console.error('Legal article database lookup error:', error);

    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب نص المادة من قاعدة البيانات.' },
      { status: 500 }
    );
  }
}
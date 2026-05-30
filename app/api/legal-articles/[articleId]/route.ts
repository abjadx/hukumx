import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const runtime = 'nodejs';

async function getArticleId(context: any) {
  const params = await context.params;
  return params.articleId;
}

function getBestArticleText(article: {
  articleText: string;
  articleTextClean?: string | null;
  articleTextReviewed?: string | null;
}) {
  return (
    article.articleTextReviewed?.trim() ||
    article.articleTextClean?.trim() ||
    article.articleText?.trim() ||
    ''
  );
}

export async function GET(req: NextRequest, context: any) {
  try {
    const articleIdOrNumber = await getArticleId(context);

    if (!articleIdOrNumber) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف المادة مطلوب',
        },
        { status: 400 }
      );
    }

    const url = new URL(req.url);
    const country = url.searchParams.get('country') || 'JO';
    const sourceSlug = url.searchParams.get('sourceSlug');

    let article = await prisma.legalArticle.findUnique({
      where: {
        id: articleIdOrNumber,
      },
      include: {
        legalSource: {
          include: {
            country: true,
          },
        },
      },
    });

    if (!article) {
      article = await prisma.legalArticle.findFirst({
        where: {
          articleNumber: articleIdOrNumber,
          reviewStatus: 'approved',
          legalSource: {
            isActive: true,
            country: {
              code: country,
            },
            ...(sourceSlug
              ? {
                  slug: sourceSlug,
                }
              : {}),
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
      });
    }

    if (!article) {
      return NextResponse.json(
        {
          success: false,
          error: 'المادة القانونية غير موجودة',
        },
        { status: 404 }
      );
    }

    if (article.reviewStatus !== 'approved') {
      return NextResponse.json(
        {
          success: false,
          error: 'هذه المادة غير معتمدة ولا يمكن عرضها داخل تحليل القضية',
        },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: article.id,
        articleNumber: article.articleNumber,
        articleText: getBestArticleText(article),
        reviewStatus: article.reviewStatus,
        reviewedAt: article.reviewedAt,
        reviewedBy: article.reviewedBy,
        legalSource: {
          id: article.legalSource.id,
          titleAr: article.legalSource.titleAr,
          titleEn: article.legalSource.titleEn,
          slug: article.legalSource.slug,
          category: article.legalSource.category,
          country: {
            code: article.legalSource.country.code,
            nameAr: article.legalSource.country.nameAr,
            nameEn: article.legalSource.country.nameEn,
          },
        },
      },
    });
  } catch (error) {
    console.error('GET /api/legal-articles/[articleId] error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في جلب نص المادة القانونية',
      },
      { status: 500 }
    );
  }
}
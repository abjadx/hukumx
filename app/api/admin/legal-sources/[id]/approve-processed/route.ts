import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params?: Promise<{
    id?: string;
  }>;
};

async function readAdminKey(req: NextRequest) {
  const contentType = req.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const body = await req.json().catch(() => ({}));
    return typeof body?.adminKey === 'string' ? body.adminKey : '';
  }

  const formData = await req.formData().catch(() => null);
  if (formData) {
    return String(formData.get('adminKey') || formData.get('key') || '');
  }

  return '';
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const resolvedParams = context.params ? await context.params : undefined;
    const sourceId = resolvedParams?.id || '';
    const adminKey = await readAdminKey(req);
    const expectedAdminKey = process.env.ADMIN_ACCESS_KEY;

    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'غير مصرح بتنفيذ هذا الإجراء.',
        },
        { status: 401 }
      );
    }

    if (!sourceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'رقم التشريع مطلوب.',
        },
        { status: 400 }
      );
    }

    const source = await prisma.legalSource.findUnique({
      where: { id: sourceId },
      select: { id: true, titleAr: true },
    });

    if (!source) {
      return NextResponse.json(
        {
          success: false,
          error: 'التشريع غير موجود.',
        },
        { status: 404 }
      );
    }

    const candidateArticles = await prisma.legalArticle.findMany({
      where: {
        legalSourceId: sourceId,
        reviewStatus: {
          not: 'approved',
        },
        articleTextClean: {
          not: null,
        },
      },
      select: {
        id: true,
        articleNumber: true,
        articleTextClean: true,
        reviewNotes: true,
      },
      orderBy: {
        articleNumber: 'asc',
      },
    });

    const articlesToApprove = candidateArticles.filter(
      (article) => Boolean(article.articleTextClean && article.articleTextClean.trim().length > 0)
    );

    if (articlesToApprove.length === 0) {
      return NextResponse.json({
        success: true,
        data: {
          sourceId,
          sourceTitle: source.titleAr,
          approvedCount: 0,
          skippedCount: candidateArticles.length,
          message: 'لا توجد مواد معالجة جاهزة للاعتماد.',
        },
      });
    }

    const now = new Date();

    await prisma.$transaction(
      articlesToApprove.map((article) =>
        prisma.legalArticle.update({
          where: { id: article.id },
          data: {
            articleTextReviewed: article.articleTextClean?.trim() || '',
            reviewStatus: 'approved',
            reviewedAt: now,
            reviewedBy: 'admin-bulk',
            reviewNotes: [
              article.reviewNotes || '',
              `تم اعتماد المادة دفعة واحدة من شاشة التشريع بتاريخ ${now.toISOString()}.`,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        })
      )
    );

    return NextResponse.json({
      success: true,
      data: {
        sourceId,
        sourceTitle: source.titleAr,
        approvedCount: articlesToApprove.length,
        skippedCount: candidateArticles.length - articlesToApprove.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'فشل اعتماد المواد المعالجة دفعة واحدة.',
      },
      { status: 500 }
    );
  }
}

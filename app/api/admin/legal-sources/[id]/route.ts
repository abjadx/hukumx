import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params?: Promise<{
    id?: string;
  }>;
};

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const sourceId = params?.id || '';

    const body = await req.json().catch(() => ({}));
    const adminKey = typeof body?.key === 'string' ? body.key : '';
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

    if (!sourceId) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرف التشريع غير موجود.',
        },
        { status: 400 }
      );
    }

    const source = await prisma.legalSource.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        titleAr: true,
        _count: {
          select: {
            articles: true,
          },
        },
      },
    });

    if (!source) {
      return NextResponse.json(
        {
          success: false,
          error: 'التشريع غير موجود أو تم حذفه سابقًا.',
        },
        { status: 404 }
      );
    }

    await prisma.legalArticle.deleteMany({
      where: { legalSourceId: source.id },
    });

    await prisma.legalSource.delete({
      where: { id: source.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        deletedSourceId: source.id,
        deletedSourceTitle: source.titleAr,
        deletedArticlesCount: source._count.articles,
      },
    });
  } catch (error) {
    console.error('Hukumx delete legal source error:', error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'حدث خطأ أثناء حذف التشريع.',
      },
      { status: 500 }
    );
  }
}

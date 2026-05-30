import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params?: Promise<{
    id?: string;
  }>;
};

async function readJson(req: NextRequest) {
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const params = context.params ? await context.params : {};
    const body = await readJson(req);

    const adminKey = String(body.adminKey || '');
    const sourceId = String(params?.id || body.sourceId || '');
    const expectedAdminKey = process.env.ADMIN_ACCESS_KEY;

    if (!expectedAdminKey || adminKey !== expectedAdminKey) {
      return NextResponse.json(
        { success: false, error: 'غير مصرح بتنفيذ هذا الإجراء.' },
        { status: 401 }
      );
    }

    if (!sourceId) {
      return NextResponse.json(
        { success: false, error: 'رقم التشريع مطلوب.' },
        { status: 400 }
      );
    }

    const source = await prisma.legalSource.findUnique({
      where: { id: sourceId },
      select: { id: true, titleAr: true },
    });

    if (!source) {
      return NextResponse.json(
        { success: false, error: 'التشريع غير موجود أو تم حذفه.' },
        { status: 404 }
      );
    }

    const readyBefore = await prisma.legalArticle.count({
      where: {
        legalSourceId: sourceId,
        reviewStatus: { not: 'approved' },
        articleTextClean: { not: null },
      },
    });

    if (readyBefore === 0) {
      return NextResponse.json({
        success: true,
        approvedCount: 0,
        remainingReadyCount: 0,
        message: 'لا توجد مواد معالجة جاهزة للاعتماد.',
      });
    }

    const now = new Date();

    // اعتماد المواد المعالجة دفعة واحدة بدون Prisma transaction طويلة.
    // هذا أسرع وأكثر أمانًا لأنه ينقل articleTextClean إلى articleTextReviewed داخل قاعدة البيانات مباشرة.
    const approvedCount = await prisma.$executeRaw`
      UPDATE "LegalArticle"
      SET
        "articleTextReviewed" = "articleTextClean",
        "reviewStatus" = 'approved',
        "reviewedAt" = ${now},
        "reviewedBy" = 'admin-bulk'
      WHERE
        "legalSourceId" = ${sourceId}
        AND "reviewStatus" <> 'approved'
        AND "articleTextClean" IS NOT NULL
        AND length(trim("articleTextClean")) > 0
    `;

    const remainingReadyCount = await prisma.legalArticle.count({
      where: {
        legalSourceId: sourceId,
        reviewStatus: { not: 'approved' },
        articleTextClean: { not: null },
      },
    });

    return NextResponse.json({
      success: true,
      sourceId,
      sourceTitle: source.titleAr,
      approvedCount: Number(approvedCount || 0),
      remainingReadyCount,
      message: `تم اعتماد ${Number(approvedCount || 0)} مادة معالجة بنجاح.`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'حدث خطأ غير متوقع أثناء اعتماد المواد المعالجة.',
      },
      { status: 500 }
    );
  }
}

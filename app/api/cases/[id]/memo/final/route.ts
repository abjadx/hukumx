import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export const runtime = 'nodejs';

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeStoredMemo(memo: {
  id: string;
  caseId: string;
  title: string;
  memoText: string;
  executiveSummary: string | null;
  keyFacts: unknown;
  legalIssues: unknown;
  appliedArticles: unknown;
  recommendations: unknown;
  missingInformation: unknown;
  riskLevel: string | null;
  disclaimer: string | null;
  generatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: memo.id,
    caseId: memo.caseId,
    title: memo.title,
    memoText: memo.memoText,
    executiveSummary: memo.executiveSummary || '',
    keyFacts: asArray(memo.keyFacts).filter((item) => typeof item === 'string'),
    legalIssues: asArray(memo.legalIssues).filter(
      (item) => typeof item === 'string'
    ),
    appliedArticles: asArray(memo.appliedArticles),
    recommendations: asArray(memo.recommendations).filter(
      (item) => typeof item === 'string'
    ),
    missingInformation: asArray(memo.missingInformation).filter(
      (item) => typeof item === 'string'
    ),
    riskLevel: memo.riskLevel || 'unknown',
    disclaimer: memo.disclaimer || '',
    generatedBy: memo.generatedBy || null,
    isFinal: memo.generatedBy === 'FINAL',
    createdAt: memo.createdAt.toISOString(),
    updatedAt: memo.updatedAt.toISOString(),
  };
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await context.params;

    const finalMemo = await prisma.caseMemo.findFirst({
      where: {
        caseId,
        generatedBy: 'FINAL',
      },
      orderBy: { updatedAt: 'desc' },
    });

    const normalizedFinalMemo = finalMemo ? normalizeStoredMemo(finalMemo) : null;

    return NextResponse.json({
      success: true,
      data: {
        finalMemo: normalizedFinalMemo,
      },
      finalMemo: normalizedFinalMemo,
      memo: normalizedFinalMemo,
    });
  } catch (error) {
    console.error('Hukumx get final memo error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء جلب المذكرة النهائية المعتمدة.',
      },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await context.params;
    const body = (await req.json().catch(() => ({}))) as { memoId?: string };
    const memoId = body.memoId?.trim();

    if (!memoId) {
      return NextResponse.json(
        {
          success: false,
          error: 'يرجى تحديد نسخة المذكرة المراد اعتمادها كنسخة نهائية.',
        },
        { status: 400 }
      );
    }

    const existingMemo = await prisma.caseMemo.findFirst({
      where: {
        id: memoId,
        caseId,
      },
    });

    if (!existingMemo) {
      return NextResponse.json(
        {
          success: false,
          error: 'نسخة المذكرة غير موجودة أو لا تتبع هذه القضية.',
        },
        { status: 404 }
      );
    }

    const finalMemo = await prisma.$transaction(async (tx) => {
      await tx.caseMemo.updateMany({
        where: {
          caseId,
          generatedBy: 'FINAL',
        },
        data: {
          generatedBy: null,
        },
      });

      return tx.caseMemo.update({
        where: { id: memoId },
        data: {
          generatedBy: 'FINAL',
        },
      });
    });

    const normalizedFinalMemo = normalizeStoredMemo(finalMemo);

    return NextResponse.json({
      success: true,
      data: {
        finalMemo: normalizedFinalMemo,
      },
      finalMemo: normalizedFinalMemo,
      memo: normalizedFinalMemo,
    });
  } catch (error) {
    console.error('Hukumx approve final memo error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء اعتماد المذكرة كنسخة نهائية.',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await context.params;

    await prisma.caseMemo.updateMany({
      where: {
        caseId,
        generatedBy: 'FINAL',
      },
      data: {
        generatedBy: null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        finalMemo: null,
      },
      finalMemo: null,
      memo: null,
    });
  } catch (error) {
    console.error('Hukumx clear final memo error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء إلغاء اعتماد المذكرة النهائية.',
      },
      { status: 500 }
    );
  }
}

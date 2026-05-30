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

    const memos = await prisma.caseMemo.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const normalizedMemos = memos.map(normalizeStoredMemo);
    const latestMemo = normalizedMemos[0] || null;

    return NextResponse.json({
      success: true,
      data: {
        latestMemo,
        memos: normalizedMemos,
        total: normalizedMemos.length,
      },
      latestMemo,
      memo: latestMemo,
      memos: normalizedMemos,
    });
  } catch (error) {
    console.error('Hukumx get case memo versions error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء جلب سجل نسخ المذكرات القانونية.',
      },
      { status: 500 }
    );
  }
}


export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await context.params;
    const { searchParams } = new URL(req.url);
    const memoId = searchParams.get('memoId')?.trim();

    if (!memoId) {
      return NextResponse.json(
        {
          success: false,
          error: 'يرجى تحديد نسخة المذكرة المراد حذفها.',
        },
        { status: 400 }
      );
    }

    const deleted = await prisma.caseMemo.deleteMany({
      where: {
        id: memoId,
        caseId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'نسخة المذكرة غير موجودة أو لا تتبع هذه القضية.',
        },
        { status: 404 }
      );
    }

    const remainingMemos = await prisma.caseMemo.findMany({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const normalizedMemos = remainingMemos.map(normalizeStoredMemo);
    const latestMemo = normalizedMemos[0] || null;

    return NextResponse.json({
      success: true,
      deletedMemoId: memoId,
      data: {
        latestMemo,
        memos: normalizedMemos,
        total: normalizedMemos.length,
      },
      latestMemo,
      memo: latestMemo,
      memos: normalizedMemos,
    });
  } catch (error) {
    console.error('Hukumx delete case memo version error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء حذف نسخة المذكرة القانونية.',
      },
      { status: 500 }
    );
  }
}

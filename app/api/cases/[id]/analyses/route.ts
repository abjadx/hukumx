import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export const runtime = 'nodejs';

async function getCaseId(context: any) {
  const params = await context.params;
  return params.id;
}

function normalizeJson(value: unknown) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (Array.isArray(value) || typeof value === 'object') {
    return value;
  }

  return undefined;
}

export async function GET(req: NextRequest, context: any) {
  try {
    const caseId = await getCaseId(context);

    if (!caseId) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف القضية مطلوب',
        },
        { status: 400 }
      );
    }

    const legalCase = await prisma.legalCase.findUnique({
      where: { id: caseId },
    });

    if (!legalCase) {
      return NextResponse.json(
        {
          success: false,
          error: 'القضية غير موجودة',
        },
        { status: 404 }
      );
    }

    const analyses = await prisma.caseAnalysis.findMany({
      where: { caseId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: analyses,
    });
  } catch (error) {
    console.error('GET /api/cases/[id]/analyses error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في جلب تحليلات القضية',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: any) {
  try {
    const caseId = await getCaseId(context);
    const body = await req.json();

    if (!caseId) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف القضية مطلوب',
        },
        { status: 400 }
      );
    }

    const legalCase = await prisma.legalCase.findUnique({
      where: { id: caseId },
    });

    if (!legalCase) {
      return NextResponse.json(
        {
          success: false,
          error: 'القضية غير موجودة',
        },
        { status: 404 }
      );
    }

    const summary =
      typeof body.summary === 'string' ? body.summary.trim() : null;

    const facts = normalizeJson(body.facts);
    const legalIssues = normalizeJson(body.legalIssues);
    const relatedArticles = normalizeJson(body.relatedArticles);
    const strengths = normalizeJson(body.strengths);
    const weaknesses = normalizeJson(body.weaknesses);
    const nextSteps = normalizeJson(body.nextSteps);

    if (!summary && !facts && !legalIssues && !relatedArticles && !strengths && !weaknesses && !nextSteps) {
      return NextResponse.json(
        {
          success: false,
          error: 'يجب إرسال ملخص أو بيانات تحليل واحدة على الأقل',
        },
        { status: 400 }
      );
    }

    const analysis = await prisma.caseAnalysis.create({
      data: {
        caseId,
        summary,
        facts: facts as any,
        legalIssues: legalIssues as any,
        relatedArticles: relatedArticles as any,
        strengths: strengths as any,
        weaknesses: weaknesses as any,
        nextSteps: nextSteps as any,
      },
    });

    return NextResponse.json({
      success: true,
      data: analysis,
    });
  } catch (error) {
    console.error('POST /api/cases/[id]/analyses error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في إضافة تحليل للقضية',
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export const runtime = 'nodejs';

const ALLOWED_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

async function getCaseId(context: any) {
  const params = await context.params;
  return params.id;
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

    const recommendations = await prisma.caseRecommendation.findMany({
      where: { caseId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    console.error('GET /api/cases/[id]/recommendations error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في جلب توصيات القضية',
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

    const title = typeof body.title === 'string' ? body.title.trim() : '';

    const description =
      typeof body.description === 'string' ? body.description.trim() : '';

    const priority =
      typeof body.priority === 'string' && body.priority.trim()
        ? body.priority.trim().toUpperCase()
        : null;

    const recommendationType =
      typeof body.recommendationType === 'string'
        ? body.recommendationType.trim()
        : null;

    const isDone = typeof body.isDone === 'boolean' ? body.isDone : false;

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: 'عنوان التوصية مطلوب',
        },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json(
        {
          success: false,
          error: 'وصف التوصية مطلوب',
        },
        { status: 400 }
      );
    }

    if (priority && !ALLOWED_PRIORITIES.includes(priority)) {
      return NextResponse.json(
        {
          success: false,
          error: 'أولوية التوصية غير صحيحة',
        },
        { status: 400 }
      );
    }

    const recommendation = await prisma.caseRecommendation.create({
      data: {
        caseId,
        title,
        description,
        priority,
        recommendationType,
        isDone,
      },
    });

    return NextResponse.json({
      success: true,
      data: recommendation,
    });
  } catch (error) {
    console.error('POST /api/cases/[id]/recommendations error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في إضافة توصية للقضية',
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export const runtime = 'nodejs';

async function getParams(context: any) {
  const params = await context.params;

  return {
    caseId: params.id,
    recommendationId: params.recommendationId,
  };
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    const { caseId, recommendationId } = await getParams(context);

    if (!caseId || !recommendationId) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف القضية ومعرّف التوصية مطلوبان',
        },
        { status: 400 }
      );
    }

    const existingRecommendation = await prisma.caseRecommendation.findFirst({
      where: {
        id: recommendationId,
        caseId,
      },
    });

    if (!existingRecommendation) {
      return NextResponse.json(
        {
          success: false,
          error: 'التوصية غير موجودة',
        },
        { status: 404 }
      );
    }

    await prisma.caseRecommendation.delete({
      where: {
        id: recommendationId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'تم حذف التوصية بنجاح',
    });
  } catch (error) {
    console.error(
      'DELETE /api/cases/[id]/recommendations/[recommendationId] error:',
      error
    );

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في حذف التوصية',
      },
      { status: 500 }
    );
  }
}
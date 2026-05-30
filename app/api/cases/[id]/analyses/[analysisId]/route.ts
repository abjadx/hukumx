import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export const runtime = 'nodejs';

async function getParams(context: any) {
  const params = await context.params;

  return {
    caseId: params.id,
    analysisId: params.analysisId,
  };
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    const { caseId, analysisId } = await getParams(context);

    if (!caseId || !analysisId) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف القضية ومعرّف التحليل مطلوبان',
        },
        { status: 400 }
      );
    }

    const existingAnalysis = await prisma.caseAnalysis.findFirst({
      where: {
        id: analysisId,
        caseId,
      },
    });

    if (!existingAnalysis) {
      return NextResponse.json(
        {
          success: false,
          error: 'التحليل غير موجود',
        },
        { status: 404 }
      );
    }

    await prisma.caseAnalysis.delete({
      where: {
        id: analysisId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'تم حذف التحليل بنجاح',
    });
  } catch (error) {
    console.error('DELETE /api/cases/[id]/analyses/[analysisId] error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في حذف التحليل',
      },
      { status: 500 }
    );
  }
}
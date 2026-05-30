import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export const runtime = 'nodejs';

async function getParams(context: any) {
  const params = await context.params;

  return {
    caseId: params.id,
    documentId: params.documentId,
  };
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    const { caseId, documentId } = await getParams(context);

    if (!caseId || !documentId) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف القضية ومعرّف المستند مطلوبان',
        },
        { status: 400 }
      );
    }

    const existingDocument = await prisma.caseDocument.findFirst({
      where: {
        id: documentId,
        caseId,
      },
    });

    if (!existingDocument) {
      return NextResponse.json(
        {
          success: false,
          error: 'المستند غير موجود',
        },
        { status: 404 }
      );
    }

    await prisma.caseDocument.delete({
      where: {
        id: documentId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'تم حذف المستند بنجاح',
    });
  } catch (error) {
    console.error('DELETE /api/cases/[id]/documents/[documentId] error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في حذف المستند',
      },
      { status: 500 }
    );
  }
}
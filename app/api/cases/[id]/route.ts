import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

export const runtime = 'nodejs';

const ALLOWED_CASE_TYPES = [
  'CIVIL',
  'CRIMINAL',
  'COMMERCIAL',
  'LABOR',
  'FAMILY',
  'ADMINISTRATIVE',
  'CONTRACT',
  'OTHER',
];

const ALLOWED_CASE_STATUSES = [
  'DRAFT',
  'ACTIVE',
  'UNDER_REVIEW',
  'CLOSED',
  'ARCHIVED',
];

async function getCaseId(context: any) {
  const params = await context.params;
  return params.id;
}

export async function GET(
  req: NextRequest,
  context: any
) {
  try {
    const id = await getCaseId(context);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف القضية مطلوب',
        },
        { status: 400 }
      );
    }

    const legalCase = await prisma.legalCase.findUnique({
      where: { id },
      include: {
        documents: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        events: {
          orderBy: {
            eventDate: 'asc',
          },
        },
        analyses: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        recommendations: {
          orderBy: {
            createdAt: 'desc',
          },
        },
      },
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

    return NextResponse.json({
      success: true,
      data: legalCase,
    });
  } catch (error) {
    console.error('GET /api/cases/[id] error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في جلب القضية',
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  context: any
) {
  try {
    const id = await getCaseId(context);
    const body = await req.json();

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف القضية مطلوب',
        },
        { status: 400 }
      );
    }

    const existingCase = await prisma.legalCase.findUnique({
      where: { id },
    });

    if (!existingCase) {
      return NextResponse.json(
        {
          success: false,
          error: 'القضية غير موجودة',
        },
        { status: 404 }
      );
    }

    const title =
      typeof body.title === 'string' ? body.title.trim() : existingCase.title;

    const country =
      typeof body.country === 'string' ? body.country.trim() : existingCase.country;

    const caseType =
      typeof body.caseType === 'string' ? body.caseType : existingCase.caseType;

    const status =
      typeof body.status === 'string' ? body.status : existingCase.status;

    const clientName =
      typeof body.clientName === 'string' ? body.clientName.trim() : existingCase.clientName;

    const opponentName =
      typeof body.opponentName === 'string' ? body.opponentName.trim() : existingCase.opponentName;

    const courtName =
      typeof body.courtName === 'string' ? body.courtName.trim() : existingCase.courtName;

    const caseNumber =
      typeof body.caseNumber === 'string' ? body.caseNumber.trim() : existingCase.caseNumber;

    const description =
      typeof body.description === 'string' ? body.description.trim() : existingCase.description;

    const aiSummary =
      typeof body.aiSummary === 'string' ? body.aiSummary.trim() : existingCase.aiSummary;

    const riskLevel =
      typeof body.riskLevel === 'string' ? body.riskLevel.trim() : existingCase.riskLevel;

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: 'عنوان القضية مطلوب',
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_CASE_TYPES.includes(caseType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'نوع القضية غير صحيح',
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_CASE_STATUSES.includes(status)) {
      return NextResponse.json(
        {
          success: false,
          error: 'حالة القضية غير صحيحة',
        },
        { status: 400 }
      );
    }

    const updatedCase = await prisma.legalCase.update({
      where: { id },
      data: {
        title,
        country: country || 'JO',
        caseType: caseType as any,
        status: status as any,
        clientName,
        opponentName,
        courtName,
        caseNumber,
        description,
        aiSummary,
        riskLevel,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedCase,
    });
  } catch (error) {
    console.error('PUT /api/cases/[id] error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في تعديل القضية',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  context: any
) {
  try {
    const id = await getCaseId(context);

    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف القضية مطلوب',
        },
        { status: 400 }
      );
    }

    const existingCase = await prisma.legalCase.findUnique({
      where: { id },
    });

    if (!existingCase) {
      return NextResponse.json(
        {
          success: false,
          error: 'القضية غير موجودة',
        },
        { status: 404 }
      );
    }

    await prisma.legalCase.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'تم حذف القضية بنجاح',
    });
  } catch (error) {
    console.error('DELETE /api/cases/[id] error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في حذف القضية',
      },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../lib/prisma';

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

export async function GET() {
  try {
    const cases = await prisma.legalCase.findMany({
      orderBy: {
        updatedAt: 'desc',
      },
      include: {
        _count: {
          select: {
            documents: true,
            events: true,
            recommendations: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: cases,
    });
  } catch (error) {
    console.error('GET /api/cases error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في جلب القضايا',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const country = typeof body.country === 'string' ? body.country.trim() : 'JO';
    const caseType = typeof body.caseType === 'string' ? body.caseType : 'OTHER';
    const status = typeof body.status === 'string' ? body.status : 'DRAFT';

    const clientName =
      typeof body.clientName === 'string' ? body.clientName.trim() : null;

    const opponentName =
      typeof body.opponentName === 'string' ? body.opponentName.trim() : null;

    const courtName =
      typeof body.courtName === 'string' ? body.courtName.trim() : null;

    const caseNumber =
      typeof body.caseNumber === 'string' ? body.caseNumber.trim() : null;

    const description =
      typeof body.description === 'string' ? body.description.trim() : null;

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

    const legalCase = await prisma.legalCase.create({
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
      },
    });

    return NextResponse.json({
      success: true,
      data: legalCase,
    });
  } catch (error) {
    console.error('POST /api/cases error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في إنشاء القضية',
      },
      { status: 500 }
    );
  }
}
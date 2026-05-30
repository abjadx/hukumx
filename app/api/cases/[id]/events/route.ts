import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export const runtime = 'nodejs';

const ALLOWED_EVENT_TYPES = [
  'HEARING',
  'DEADLINE',
  'APPEAL_DEADLINE',
  'FILING_DATE',
  'NOTICE_DATE',
  'JUDGMENT_DATE',
  'OTHER',
];

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

    const events = await prisma.caseEvent.findMany({
      where: { caseId },
      orderBy: [
        {
          eventDate: 'asc',
        },
        {
          createdAt: 'desc',
        },
      ],
    });

    return NextResponse.json({
      success: true,
      data: events,
    });
  } catch (error) {
    console.error('GET /api/cases/[id]/events error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في جلب تواريخ وإجراءات القضية',
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

    const title =
      typeof body.title === 'string' ? body.title.trim() : '';

    const description =
      typeof body.description === 'string' ? body.description.trim() : null;

    const eventType =
      typeof body.eventType === 'string' ? body.eventType : 'OTHER';

    const isCritical =
      typeof body.isCritical === 'boolean' ? body.isCritical : false;

    let eventDate: Date | null = null;

    if (typeof body.eventDate === 'string' && body.eventDate.trim()) {
      const parsedDate = new Date(body.eventDate);

      if (Number.isNaN(parsedDate.getTime())) {
        return NextResponse.json(
          {
            success: false,
            error: 'تاريخ الإجراء غير صحيح',
          },
          { status: 400 }
        );
      }

      eventDate = parsedDate;
    }

    if (!title) {
      return NextResponse.json(
        {
          success: false,
          error: 'عنوان الإجراء مطلوب',
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_EVENT_TYPES.includes(eventType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'نوع الإجراء غير صحيح',
        },
        { status: 400 }
      );
    }

    const event = await prisma.caseEvent.create({
      data: {
        caseId,
        title,
        description,
        eventType: eventType as any,
        eventDate,
        isCritical,
      },
    });

    return NextResponse.json({
      success: true,
      data: event,
    });
  } catch (error) {
    console.error('POST /api/cases/[id]/events error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في إضافة إجراء للقضية',
      },
      { status: 500 }
    );
  }
}
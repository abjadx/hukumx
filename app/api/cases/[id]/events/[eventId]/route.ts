import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

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

async function getParams(context: any) {
  const params = await context.params;
  return {
    caseId: params.id,
    eventId: params.eventId,
  };
}

export async function PUT(req: NextRequest, context: any) {
  try {
    const { caseId, eventId } = await getParams(context);
    const body = await req.json();

    if (!caseId || !eventId) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف القضية ومعرّف الإجراء مطلوبان',
        },
        { status: 400 }
      );
    }

    const existingEvent = await prisma.caseEvent.findFirst({
      where: {
        id: eventId,
        caseId,
      },
    });

    if (!existingEvent) {
      return NextResponse.json(
        {
          success: false,
          error: 'الإجراء غير موجود',
        },
        { status: 404 }
      );
    }

    const title =
      typeof body.title === 'string' ? body.title.trim() : existingEvent.title;

    const description =
      typeof body.description === 'string'
        ? body.description.trim()
        : existingEvent.description;

    const eventType =
      typeof body.eventType === 'string'
        ? body.eventType
        : existingEvent.eventType;

    const isCritical =
      typeof body.isCritical === 'boolean'
        ? body.isCritical
        : existingEvent.isCritical;

    let eventDate = existingEvent.eventDate;

    if (body.eventDate === null) {
      eventDate = null;
    } else if (typeof body.eventDate === 'string' && body.eventDate.trim()) {
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

    const updatedEvent = await prisma.caseEvent.update({
      where: {
        id: eventId,
      },
      data: {
        title,
        description,
        eventType: eventType as any,
        eventDate,
        isCritical,
      },
    });

    return NextResponse.json({
      success: true,
      data: updatedEvent,
    });
  } catch (error) {
    console.error('PUT /api/cases/[id]/events/[eventId] error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في تعديل الإجراء',
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: any) {
  try {
    const { caseId, eventId } = await getParams(context);

    if (!caseId || !eventId) {
      return NextResponse.json(
        {
          success: false,
          error: 'معرّف القضية ومعرّف الإجراء مطلوبان',
        },
        { status: 400 }
      );
    }

    const existingEvent = await prisma.caseEvent.findFirst({
      where: {
        id: eventId,
        caseId,
      },
    });

    if (!existingEvent) {
      return NextResponse.json(
        {
          success: false,
          error: 'الإجراء غير موجود',
        },
        { status: 404 }
      );
    }

    await prisma.caseEvent.delete({
      where: {
        id: eventId,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'تم حذف الإجراء بنجاح',
    });
  } catch (error) {
    console.error('DELETE /api/cases/[id]/events/[eventId] error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في حذف الإجراء',
      },
      { status: 500 }
    );
  }
}
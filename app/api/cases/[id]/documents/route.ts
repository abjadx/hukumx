import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';

const ALLOWED_DOCUMENT_TYPES = [
  'CLAIM',
  'CONTRACT',
  'EVIDENCE',
  'JUDGMENT',
  'NOTICE',
  'POWER_OF_ATTORNEY',
  'EXPERT_REPORT',
  'OTHER',
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

async function getCaseId(context: any) {
  const params = await context.params;
  return params.id;
}

function sanitizeFileName(fileName: string) {
  return fileName
    .replace(/[^\u0600-\u06FFa-zA-Z0-9.\-_ ]/g, '')
    .replace(/\s+/g, '-')
    .trim();
}

async function saveUploadedFile(caseId: string, file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('حجم الملف أكبر من الحد المسموح 20MB');
  }

  const safeName = sanitizeFileName(file.name || 'uploaded-file');
  const storedName = `${Date.now()}-${safeName || 'uploaded-file'}`;

  const uploadDir = path.join(
    process.cwd(),
    'public',
    'uploads',
    'cases',
    caseId
  );

  await mkdir(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, storedName);
  const bytes = await file.arrayBuffer();

  await writeFile(filePath, Buffer.from(bytes));

  return {
    fileName: file.name || storedName,
    fileUrl: `/uploads/cases/${caseId}/${storedName}`,
    mimeType: file.type || null,
    size: file.size || null,
  };
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
      where: {
        id: caseId,
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

    const documents = await prisma.caseDocument.findMany({
      where: {
        caseId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      data: documents,
    });
  } catch (error) {
    console.error('GET /api/cases/[id]/documents error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'فشل في جلب مستندات القضية',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest, context: any) {
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
      where: {
        id: caseId,
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

    const contentType = req.headers.get('content-type') || '';

    let fileName = '';
    let fileUrl: string | null = null;
    let mimeType: string | null = null;
    let size: number | null = null;
    let documentType = 'OTHER';
    let rawText: string | null = null;
    let cleanedText: string | null = null;
    let aiSummary: string | null = null;
    let extractedData: any = undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();

      const uploadedFile = formData.get('file');
      const fileNameValue = formData.get('fileName');
      const documentTypeValue = formData.get('documentType');
      const rawTextValue = formData.get('rawText');
      const cleanedTextValue = formData.get('cleanedText');
      const aiSummaryValue = formData.get('aiSummary');

      if (typeof documentTypeValue === 'string' && documentTypeValue.trim()) {
        documentType = documentTypeValue.trim();
      }

      if (typeof rawTextValue === 'string' && rawTextValue.trim()) {
        rawText = rawTextValue.trim();
      }

      if (typeof cleanedTextValue === 'string' && cleanedTextValue.trim()) {
        cleanedText = cleanedTextValue.trim();
      }

      if (typeof aiSummaryValue === 'string' && aiSummaryValue.trim()) {
        aiSummary = aiSummaryValue.trim();
      }

      if (uploadedFile instanceof File && uploadedFile.size > 0) {
        const savedFile = await saveUploadedFile(caseId, uploadedFile);

        fileName = savedFile.fileName;
        fileUrl = savedFile.fileUrl;
        mimeType = savedFile.mimeType;
        size = savedFile.size;
      } else if (typeof fileNameValue === 'string' && fileNameValue.trim()) {
        fileName = fileNameValue.trim();
      }
    } else {
      const body = await req.json();

      fileName = typeof body.fileName === 'string' ? body.fileName.trim() : '';

      fileUrl =
        typeof body.fileUrl === 'string' && body.fileUrl.trim()
          ? body.fileUrl.trim()
          : null;

      mimeType =
        typeof body.mimeType === 'string' && body.mimeType.trim()
          ? body.mimeType.trim()
          : null;

      size =
        typeof body.size === 'number' && Number.isFinite(body.size)
          ? body.size
          : null;

      documentType =
        typeof body.documentType === 'string' ? body.documentType : 'OTHER';

      rawText =
        typeof body.rawText === 'string' && body.rawText.trim()
          ? body.rawText.trim()
          : null;

      cleanedText =
        typeof body.cleanedText === 'string' && body.cleanedText.trim()
          ? body.cleanedText.trim()
          : null;

      aiSummary =
        typeof body.aiSummary === 'string' && body.aiSummary.trim()
          ? body.aiSummary.trim()
          : null;

      extractedData =
        body.extractedData && typeof body.extractedData === 'object'
          ? body.extractedData
          : undefined;
    }

    if (!fileName) {
      return NextResponse.json(
        {
          success: false,
          error: 'اسم الملف أو الملف المرفوع مطلوب',
        },
        { status: 400 }
      );
    }

    if (!ALLOWED_DOCUMENT_TYPES.includes(documentType)) {
      return NextResponse.json(
        {
          success: false,
          error: 'نوع المستند غير صحيح',
        },
        { status: 400 }
      );
    }

    const document = await prisma.caseDocument.create({
      data: {
        caseId,
        fileName,
        fileUrl,
        mimeType,
        size,
        documentType: documentType as any,
        rawText,
        cleanedText,
        aiSummary,
        extractedData,
      },
    });

    return NextResponse.json({
      success: true,
      data: document,
    });
  } catch (error: any) {
    console.error('POST /api/cases/[id]/documents error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'فشل في إضافة مستند للقضية',
      },
      { status: 500 }
    );
  }
}
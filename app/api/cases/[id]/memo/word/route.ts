import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../lib/prisma';

export const runtime = 'nodejs';

type AppliedArticle = {
  sourceTitle: string;
  articleNumber: string;
  relevance: string;
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asStringArray(value: unknown): string[] {
  return asArray(value)
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function asAppliedArticles(value: unknown): AppliedArticle[] {
  return asArray(value)
    .filter((item) => typeof item === 'object' && item !== null)
    .map((item) => {
      const article = item as Record<string, unknown>;

      return {
        sourceTitle:
          typeof article.sourceTitle === 'string' ? article.sourceTitle : '',
        articleNumber:
          typeof article.articleNumber === 'string' ? article.articleNumber : '',
        relevance:
          typeof article.relevance === 'string' ? article.relevance : '',
      };
    })
    .filter((article) => article.sourceTitle || article.articleNumber || article.relevance);
}

function formatDate(value?: Date | string | null): string {
  if (!value) return 'غير محدد';

  try {
    return new Intl.DateTimeFormat('ar-JO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function getRiskLabel(value?: string | null): string {
  const normalized = String(value || '').toLowerCase();

  if (normalized === 'low') return 'منخفضة';
  if (normalized === 'medium') return 'متوسطة';
  if (normalized === 'high') return 'عالية';
  if (normalized === 'unknown') return 'غير محددة';

  return value || 'غير محددة';
}

function listToHtml(items: string[]): string {
  if (!items.length) return '<p class="muted">لا توجد بيانات.</p>';

  return [
    '<ol>',
    ...items.map((item) => `<li>${escapeHtml(item)}</li>`),
    '</ol>',
  ].join('\n');
}

function appliedArticlesToHtml(items: AppliedArticle[]): string {
  if (!items.length) return '<p class="muted">لا توجد مواد قانونية مستخدمة.</p>';

  return [
    '<ol>',
    ...items.map((article) => {
      const sourceTitle = article.sourceTitle || 'مصدر قانوني غير محدد';
      const articleNumber = article.articleNumber
        ? `المادة ${escapeHtml(article.articleNumber)}`
        : 'رقم المادة غير محدد';
      const relevance = article.relevance || 'لم يتم توضيح سبب الارتباط.';

      return `<li><strong>${escapeHtml(sourceTitle)} - ${articleNumber}</strong><br />${escapeHtml(relevance)}</li>`;
    }),
    '</ol>',
  ].join('\n');
}

function memoTextToHtml(value?: string | null): string {
  const text = String(value || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

  if (!text) return '<p class="muted">لا يوجد نص محفوظ للمذكرة.</p>';

  return text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('\n');
}

function createFileName(caseTitle?: string | null): string {
  const safeTitle = String(caseTitle || 'legal-memo')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

  return `${safeTitle || 'legal-memo'}-${new Date().toISOString().slice(0, 10)}.doc`;
}

function buildWordHtml(params: {
  legalCase: {
    title: string;
    country: string;
    caseType: string;
    status: string;
    clientName?: string | null;
    opponentName?: string | null;
    courtName?: string | null;
    caseNumber?: string | null;
  };
  memo: {
    title: string;
    memoText: string;
    executiveSummary?: string | null;
    keyFacts: unknown;
    legalIssues: unknown;
    appliedArticles: unknown;
    recommendations: unknown;
    missingInformation: unknown;
    riskLevel?: string | null;
    disclaimer?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
}): string {
  const { legalCase, memo } = params;
  const keyFacts = asStringArray(memo.keyFacts);
  const legalIssues = asStringArray(memo.legalIssues);
  const appliedArticles = asAppliedArticles(memo.appliedArticles);
  const recommendations = asStringArray(memo.recommendations);
  const missingInformation = asStringArray(memo.missingInformation);

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(memo.title || 'مذكرة قانونية')}</title>
  <style>
    @page {
      margin: 2cm;
    }

    body {
      direction: rtl;
      unicode-bidi: embed;
      font-family: "Arial", "Tahoma", sans-serif;
      color: #111827;
      background: #ffffff;
      font-size: 15pt;
      line-height: 1.9;
      text-align: right;
    }

    h1, h2, h3 {
      color: #111827;
      margin: 0 0 12px;
      line-height: 1.5;
    }

    h1 {
      font-size: 24pt;
      text-align: center;
      margin-bottom: 24px;
      border-bottom: 2px solid #111827;
      padding-bottom: 14px;
    }

    h2 {
      font-size: 18pt;
      margin-top: 26px;
      border-bottom: 1px solid #d1d5db;
      padding-bottom: 8px;
    }

    h3 {
      font-size: 16pt;
      margin-top: 20px;
    }

    p {
      margin: 0 0 12px;
    }

    ol {
      margin: 0 0 16px;
      padding-right: 24px;
    }

    li {
      margin-bottom: 8px;
    }

    .meta-table {
      width: 100%;
      border-collapse: collapse;
      margin: 0 0 22px;
    }

    .meta-table td {
      border: 1px solid #d1d5db;
      padding: 10px 12px;
      vertical-align: top;
    }

    .meta-label {
      width: 25%;
      background: #f3f4f6;
      font-weight: bold;
      color: #374151;
    }

    .notice {
      border: 1px solid #f59e0b;
      background: #fffbeb;
      padding: 12px 14px;
      margin: 16px 0 22px;
      color: #78350f;
    }

    .section-box {
      border: 1px solid #e5e7eb;
      padding: 14px 16px;
      margin-bottom: 18px;
    }

    .muted {
      color: #6b7280;
    }

    .footer-note {
      margin-top: 30px;
      border-top: 1px solid #d1d5db;
      padding-top: 14px;
      color: #374151;
      font-size: 13pt;
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(memo.title || 'مذكرة قانونية أولية')}</h1>

  <div class="notice">
    هذه نسخة Word قابلة للتعديل من آخر مذكرة قانونية محفوظة في Hukumx. يجب مراجعتها من محامٍ مختص قبل الاعتماد أو الإيداع.
  </div>

  <table class="meta-table">
    <tr>
      <td class="meta-label">عنوان القضية</td>
      <td>${escapeHtml(legalCase.title)}</td>
      <td class="meta-label">رقم القضية</td>
      <td>${escapeHtml(legalCase.caseNumber || 'غير محدد')}</td>
    </tr>
    <tr>
      <td class="meta-label">الموكل</td>
      <td>${escapeHtml(legalCase.clientName || 'غير محدد')}</td>
      <td class="meta-label">الخصم</td>
      <td>${escapeHtml(legalCase.opponentName || 'غير محدد')}</td>
    </tr>
    <tr>
      <td class="meta-label">المحكمة</td>
      <td>${escapeHtml(legalCase.courtName || 'غير محدد')}</td>
      <td class="meta-label">الدولة</td>
      <td>${escapeHtml(legalCase.country || 'غير محدد')}</td>
    </tr>
    <tr>
      <td class="meta-label">نوع القضية</td>
      <td>${escapeHtml(legalCase.caseType || 'غير محدد')}</td>
      <td class="meta-label">حالة القضية</td>
      <td>${escapeHtml(legalCase.status || 'غير محدد')}</td>
    </tr>
    <tr>
      <td class="meta-label">درجة الخطورة</td>
      <td>${escapeHtml(getRiskLabel(memo.riskLevel))}</td>
      <td class="meta-label">آخر حفظ للمذكرة</td>
      <td>${escapeHtml(formatDate(memo.updatedAt || memo.createdAt))}</td>
    </tr>
  </table>

  <h2>الملخص التنفيذي</h2>
  <div class="section-box">
    ${memo.executiveSummary ? `<p>${escapeHtml(memo.executiveSummary)}</p>` : '<p class="muted">لا يوجد ملخص تنفيذي.</p>'}
  </div>

  <h2>الوقائع الرئيسية</h2>
  ${listToHtml(keyFacts)}

  <h2>المسائل القانونية</h2>
  ${listToHtml(legalIssues)}

  <h2>المواد القانونية المستخدمة</h2>
  ${appliedArticlesToHtml(appliedArticles)}

  <h2>التوصيات</h2>
  ${listToHtml(recommendations)}

  <h2>المعلومات الناقصة</h2>
  ${listToHtml(missingInformation)}

  <h2>نص المذكرة الكامل</h2>
  <div class="section-box">
    ${memoTextToHtml(memo.memoText)}
  </div>

  <div class="footer-note">
    ${escapeHtml(memo.disclaimer || 'هذه مذكرة قانونية أولية لا تغني عن مراجعة محامٍ مختص قبل اتخاذ أي إجراء.')}
  </div>
</body>
</html>`;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: caseId } = await context.params;

    const memo = await prisma.caseMemo.findFirst({
      where: { caseId },
      orderBy: { createdAt: 'desc' },
      include: {
        case: {
          select: {
            title: true,
            country: true,
            caseType: true,
            status: true,
            clientName: true,
            opponentName: true,
            courtName: true,
            caseNumber: true,
          },
        },
      },
    });

    if (!memo) {
      return NextResponse.json(
        {
          success: false,
          error: 'لا توجد مذكرة قانونية محفوظة لهذه القضية لتحميلها كملف Word.',
        },
        { status: 404 }
      );
    }

    const html = buildWordHtml({
      legalCase: {
        title: memo.case.title,
        country: memo.case.country,
        caseType: memo.case.caseType,
        status: memo.case.status,
        clientName: memo.case.clientName,
        opponentName: memo.case.opponentName,
        courtName: memo.case.courtName,
        caseNumber: memo.case.caseNumber,
      },
      memo,
    });

    const fileName = createFileName(memo.case.title);
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(`\ufeff${html}`, {
      status: 200,
      headers: {
        'Content-Type': 'application/msword; charset=utf-8',
        'Content-Disposition': `attachment; filename="hukumx-legal-memo.doc"; filename*=UTF-8''${encodedFileName}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Hukumx export memo word error:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'حدث خطأ أثناء تحميل المذكرة القانونية كملف Word.',
      },
      { status: 500 }
    );
  }
}

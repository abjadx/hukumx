import type { CSSProperties } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import OpenAI from 'openai';
import { prisma } from '../../../lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_REVIEW_MODEL =
  process.env.OPENAI_REVIEW_MODEL || process.env.OPENAI_MODEL || 'gpt-4.1-mini';

type PageProps = {
  searchParams?: Promise<{
    key?: string | string[];
    article?: string | string[];
    articleId?: string | string[];
    sourceId?: string | string[];
    saved?: string | string[];
  }>;
};

type ReviewArticle = {
  id: string;
  legalSourceId: string;
  articleNumber: string;
  articleText: string;
  articleTextClean: string | null;
  articleTextReviewed: string | null;
  reviewStatus: string;
  reviewNotes: string | null;
  legalSource: {
    id: string;
    titleAr: string;
    country: {
      nameAr: string;
    };
  };
};

function getSingleParam(value?: string | string[]) {
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function normalizeTextForCompare(value?: string | null) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMeaningfulProcessedText(article: {
  articleText: string;
  articleTextClean: string | null;
  articleTextReviewed: string | null;
  reviewStatus: string;
}) {
  const original = normalizeTextForCompare(article.articleText);
  const clean = normalizeTextForCompare(article.articleTextClean);

  if (clean && clean !== original) {
    return article.articleTextClean || '';
  }

  // دعم البيانات القديمة التي كان النظام يحفظ فيها نص AI داخل articleTextReviewed قبل الاعتماد
  const legacyAiText = normalizeTextForCompare(article.articleTextReviewed);
  if (
    article.reviewStatus !== 'approved' &&
    legacyAiText &&
    legacyAiText !== original
  ) {
    return article.articleTextReviewed || '';
  }

  return '';
}

function getInitialEditableText(article: ReviewArticle) {
  if (article.reviewStatus === 'approved' && article.articleTextReviewed?.trim()) {
    return article.articleTextReviewed;
  }

  const processedText = getMeaningfulProcessedText(article);
  if (processedText.trim()) return processedText;

  return article.articleText;
}

function convertArabicDigits(value: string) {
  const map: Record<string, string> = {
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  };

  return value.replace(/[٠-٩]/g, (digit) => map[digit] || digit);
}

function getArticleNumberValue(value: string) {
  const normalized = convertArabicDigits(value)
    .replace(/^المادة\s*/u, '')
    .replace(/^مادة\s*/u, '')
    .replace(/[^0-9.\-]/g, '')
    .trim();

  const directNumber = Number(normalized);
  if (Number.isFinite(directNumber)) return directNumber;

  const firstNumber = Number(normalized.match(/\d+/)?.[0] || '');
  return Number.isFinite(firstNumber) ? firstNumber : Number.MAX_SAFE_INTEGER;
}

function compareArticleNumbers(a: string, b: string) {
  const numberA = getArticleNumberValue(a);
  const numberB = getArticleNumberValue(b);

  if (numberA !== numberB) return numberA - numberB;
  return a.localeCompare(b, 'ar', { numeric: true });
}

function getReviewStatusLabel(status: string) {
  if (status === 'approved') return 'معتمدة';
  if (status === 'needs_review') return 'تحتاج مراجعة';
  if (status === 'pending') return 'غير مراجعة';
  return status || 'غير مراجعة';
}

async function getNextNeedsReviewArticleId(
  currentArticleNumber: string,
  currentArticleId: string,
  legalSourceId: string
) {
  const needsReviewArticles = await prisma.legalArticle.findMany({
    where: {
      legalSourceId,
      reviewStatus: 'needs_review',
      NOT: {
        id: currentArticleId,
      },
    },
    select: {
      id: true,
      articleNumber: true,
    },
  });

  const sortedArticles = [...needsReviewArticles].sort((a, b) =>
    compareArticleNumbers(a.articleNumber, b.articleNumber)
  );

  const nextArticle =
    sortedArticles.find(
      (item) => compareArticleNumbers(item.articleNumber, currentArticleNumber) > 0
    ) || sortedArticles[0];

  return nextArticle?.id || '';
}

function extractOutputText(response: unknown): string {
  if (
    typeof response === 'object' &&
    response !== null &&
    'output_text' in response &&
    typeof response.output_text === 'string'
  ) {
    return response.output_text;
  }

  if (
    typeof response === 'object' &&
    response !== null &&
    'output' in response &&
    Array.isArray(response.output)
  ) {
    for (const item of response.output) {
      if (
        typeof item === 'object' &&
        item !== null &&
        'content' in item &&
        Array.isArray(item.content)
      ) {
        for (const contentItem of item.content) {
          if (
            typeof contentItem === 'object' &&
            contentItem !== null &&
            'type' in contentItem &&
            'text' in contentItem &&
            (contentItem.type === 'output_text' || contentItem.type === 'text') &&
            typeof contentItem.text === 'string'
          ) {
            return contentItem.text;
          }
        }
      }
    }
  }

  return '';
}

async function saveReviewedArticle(formData: FormData) {
  'use server';

  const adminKey = String(formData.get('key') || '');
  const expectedAdminKey = process.env.ADMIN_ACCESS_KEY;

  if (!expectedAdminKey || adminKey !== expectedAdminKey) {
    throw new Error('Unauthorized admin action');
  }

  const articleId = String(formData.get('articleId') || '');
  const reviewedText = String(formData.get('reviewedText') || '').trim();
  const reviewNotes = String(formData.get('reviewNotes') || '').trim();
  const action = String(formData.get('action') || 'save');

  if (!articleId || !reviewedText) {
    throw new Error('Missing article data');
  }

  const article = await prisma.legalArticle.findUnique({
    where: {
      id: articleId,
    },
    select: {
      id: true,
      articleNumber: true,
      legalSourceId: true,
    },
  });

  if (!article) {
    throw new Error('Article not found');
  }

  const isApproveAction = action === 'approve' || action === 'approve_next';

  if (isApproveAction) {
    await prisma.legalArticle.update({
      where: {
        id: articleId,
      },
      data: {
        articleTextReviewed: reviewedText,
        reviewStatus: 'approved',
        reviewNotes: reviewNotes || null,
        reviewedAt: new Date(),
        reviewedBy: 'admin',
      },
    });
  } else {
    await prisma.legalArticle.update({
      where: {
        id: articleId,
      },
      data: {
        // حفظ بدون اعتماد يعني تحديث طبقة المعالجة فقط، وليس النص المعتمد
        articleTextClean: reviewedText,
        reviewStatus: 'needs_review',
        reviewNotes: reviewNotes || null,
        reviewedAt: null,
        reviewedBy: null,
      },
    });
  }

  if (action === 'approve_next') {
    const nextArticleId = await getNextNeedsReviewArticleId(
      article.articleNumber,
      article.id,
      article.legalSourceId
    );

    if (nextArticleId) {
      redirect(
        `/admin/legal-sources/review?key=${encodeURIComponent(
          adminKey
        )}&articleId=${encodeURIComponent(nextArticleId)}&sourceId=${encodeURIComponent(
          article.legalSourceId
        )}&saved=1`
      );
    }

    redirect(
      `/admin/legal-sources/${encodeURIComponent(article.legalSourceId)}?key=${encodeURIComponent(
        adminKey
      )}&status=needs_review&saved=review-finished`
    );
  }

  redirect(
    `/admin/legal-sources/review?key=${encodeURIComponent(
      adminKey
    )}&articleId=${encodeURIComponent(article.id)}&sourceId=${encodeURIComponent(
      article.legalSourceId
    )}&saved=1`
  );
}

async function suggestAiReviewedArticle(formData: FormData) {
  'use server';

  const adminKey = String(formData.get('key') || '');
  const expectedAdminKey = process.env.ADMIN_ACCESS_KEY;

  if (!expectedAdminKey || adminKey !== expectedAdminKey) {
    throw new Error('Unauthorized admin action');
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const articleId = String(formData.get('articleId') || '');

  if (!articleId) {
    throw new Error('Missing article id');
  }

  const article = await prisma.legalArticle.findUnique({
    where: {
      id: articleId,
    },
    include: {
      legalSource: {
        include: {
          country: true,
        },
      },
    },
  });

  if (!article) {
    throw new Error('Article not found');
  }

  const sourceText =
    getMeaningfulProcessedText(article) ||
    article.articleText;

  const response = await openai.responses.create({
    model: OPENAI_REVIEW_MODEL,
    temperature: 0,
    input: [
      {
        role: 'system',
        content: `
أنت محرر ومدقق قانوني عربي متخصص في تصحيح النصوص القانونية المستخرجة من PDF/OCR.

هذه ليست مهمة تدقيق إملائي عادي. مهمتك أن تكتشف أخطاء OCR حتى لو كانت الكلمة الناتجة كلمة عربية لكنها غير منطقية في السياق القانوني.

مهمتك الأساسية:
1. قراءة النص كأنه مادة قانونية رسمية.
2. اكتشاف الكلمات غير المنطقية أو الركيكة أو التي تبدو ناتجة عن OCR.
3. تصحيح الكلمات اعتمادًا على السياق القانوني واللغوي.
4. دمج الأسطر المقطوعة داخل الجملة الواحدة.
5. الحفاظ على أرقام البنود والفقرات.
6. عدم حذف أي حكم قانوني.
7. عدم إضافة أي حكم قانوني.
8. عدم شرح المادة.
9. عدم تلخيص النص.
10. عدم إعادة صياغة النص بأسلوب جديد إلا إذا كان ذلك ضروريًا لإصلاح خطأ OCR واضح.

قواعد مهمة:
- إذا كانت الكلمة بلا معنى أو غير مناسبة للسياق القانوني، صححها لأقرب كلمة قانونية صحيحة.
- إذا كان التصحيح واضحًا من السياق، صححه.
- إذا كان التصحيح محتملًا وليس مؤكدًا، ضعه كما هو في correctedText، وأدرجه في uncertainTerms.
- لا تضع Markdown.
- لا تكتب شرحًا خارج JSON.
- يجب أن يكون correctedText نصًا قانونيًا عربيًا مقروءًا ومنظمًا.
- حافظ على النص كاملًا قدر الإمكان.

أعد JSON فقط بهذا الشكل:
{
  "correctedText": "النص المصحح كاملًا",
  "detectedIssues": ["وصف مختصر للأخطاء التي تم تصحيحها"],
  "uncertainTerms": ["كلمات بقيت غير مؤكدة وتحتاج مراجعة بشرية"]
}
        `.trim(),
      },
      {
        role: 'user',
        content: `
القانون: ${article.legalSource.titleAr}
الدولة: ${article.legalSource.country.nameAr}
رقم المادة: ${article.articleNumber}

النص التالي مادة قانونية مستخرجة من PDF/OCR، وفيها أخطاء قد تكون:
- انقلاب حروف
- كلمات بلا معنى
- كلمات صحيحة ظاهريًا لكنها خطأ في السياق
- فواصل أسطر خاطئة
- أخطاء في لا / ال / إلا / الإلكترونية / الاستلام
- أخطاء في الترقيم والبنود

صحح النص بأفضل دقة ممكنة، واجعل correctedText أقرب ما يمكن إلى نص قانوني رسمي قابل للمراجعة البشرية.

النص:

${sourceText}
        `.trim(),
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'legal_article_review',
        strict: true,
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            correctedText: {
              type: 'string',
            },
            detectedIssues: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            uncertainTerms: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
          },
          required: ['correctedText', 'detectedIssues', 'uncertainTerms'],
        },
      },
    },
  });

  const outputText = extractOutputText(response).trim();

  let suggestedText = '';
  let reviewNotes = '';

  try {
    const parsed = JSON.parse(outputText) as {
      correctedText?: string;
      detectedIssues?: unknown[];
      uncertainTerms?: unknown[];
    };

    suggestedText = String(parsed.correctedText || '').trim();

    const detectedIssues = Array.isArray(parsed.detectedIssues)
      ? parsed.detectedIssues.filter(
          (item): item is string => typeof item === 'string'
        )
      : [];

    const uncertainTerms = Array.isArray(parsed.uncertainTerms)
      ? parsed.uncertainTerms.filter(
          (item): item is string => typeof item === 'string'
        )
      : [];

    reviewNotes = [
      'تم توليد نسخة معالجة بالذكاء الصناعي. تحتاج مراجعة واعتماد بشري قبل استخدامها كنص نهائي.',
      detectedIssues.length
        ? `الأخطاء المكتشفة: ${detectedIssues.join(' | ')}`
        : '',
      uncertainTerms.length
        ? `كلمات تحتاج مراجعة: ${uncertainTerms.join(' | ')}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  } catch {
    suggestedText = outputText;
    reviewNotes =
      'تم توليد نسخة معالجة بالذكاء الصناعي، لكن لم يتمكن النظام من قراءة تقرير التصحيح بصيغة منظمة.';
  }

  if (!suggestedText) {
    throw new Error('AI did not return suggested text');
  }

  await prisma.legalArticle.update({
    where: {
      id: articleId,
    },
    data: {
      // الذكاء الصناعي يحدّث طبقة المعالجة فقط
      articleTextClean: suggestedText,
      reviewStatus: 'needs_review',
      reviewNotes,
      reviewedAt: null,
      reviewedBy: null,
    },
  });

  redirect(
    `/admin/legal-sources/review?key=${encodeURIComponent(
      adminKey
    )}&articleId=${encodeURIComponent(article.id)}&sourceId=${encodeURIComponent(
      article.legalSourceId
    )}&saved=ai`
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at top, #1e293b 0%, #0f172a 42%, #020617 100%)',
    color: '#f8fafc',
    padding: '32px',
    direction: 'rtl',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  container: {
    maxWidth: '1280px',
    margin: '0 auto',
  },
  card: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(15, 23, 42, 0.9)',
    borderRadius: '28px',
    padding: '28px',
    marginBottom: '22px',
    boxShadow: '0 24px 70px rgba(0,0,0,0.35)',
  },
  label: {
    color: '#fbbf24',
    fontSize: '14px',
    fontWeight: 900,
    marginBottom: '10px',
  },
  title: {
    color: '#ffffff',
    fontSize: '32px',
    fontWeight: 900,
    margin: 0,
    lineHeight: 1.6,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: '15px',
    lineHeight: 2,
    marginTop: '12px',
    marginBottom: 0,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(2, 6, 23, 0.72)',
    color: '#f8fafc',
    borderRadius: '16px',
    padding: '14px 16px',
    outline: 'none',
    fontSize: '15px',
  },
  textarea: {
    width: '100%',
    minHeight: '360px',
    boxSizing: 'border-box',
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: 'rgba(2, 6, 23, 0.72)',
    color: '#f8fafc',
    borderRadius: '18px',
    padding: '18px',
    outline: 'none',
    fontSize: '17px',
    lineHeight: 2,
    resize: 'vertical',
    direction: 'rtl',
    fontFamily: 'Arial, Helvetica, sans-serif',
  },
  readonlyText: {
    border: '1px solid rgba(148, 163, 184, 0.22)',
    background: 'rgba(2, 6, 23, 0.52)',
    borderRadius: '18px',
    padding: '18px',
    color: '#cbd5e1',
    fontSize: '16px',
    lineHeight: 2,
    whiteSpace: 'pre-line',
    minHeight: '260px',
  },
  warningText: {
    border: '1px solid rgba(251, 191, 36, 0.35)',
    background: 'rgba(251, 191, 36, 0.08)',
    borderRadius: '18px',
    padding: '18px',
    color: '#fde68a',
    fontSize: '15px',
    lineHeight: 2,
    whiteSpace: 'pre-line',
    minHeight: '120px',
  },
  button: {
    border: 'none',
    background: '#f59e0b',
    color: '#020617',
    borderRadius: '16px',
    padding: '14px 22px',
    fontWeight: 900,
    cursor: 'pointer',
    fontSize: '14px',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    border: '1px solid rgba(148, 163, 184, 0.35)',
    background: '#1e293b',
    color: '#f8fafc',
    borderRadius: '16px',
    padding: '14px 22px',
    fontWeight: 900,
    cursor: 'pointer',
    fontSize: '14px',
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButton: {
    border: '1px solid rgba(248, 113, 113, 0.45)',
    background: 'rgba(127, 29, 29, 0.55)',
    color: '#fecaca',
    borderRadius: '16px',
    padding: '14px 22px',
    fontWeight: 900,
    cursor: 'pointer',
    fontSize: '14px',
  },
  nextButton: {
    border: '1px solid rgba(96, 165, 250, 0.45)',
    background: 'rgba(37, 99, 235, 0.22)',
    color: '#bfdbfe',
    borderRadius: '16px',
    padding: '14px 22px',
    fontWeight: 900,
    cursor: 'pointer',
    fontSize: '14px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '18px',
    alignItems: 'start',
  },
  formRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '999px',
    padding: '7px 14px',
    fontSize: '13px',
    fontWeight: 900,
    border: '1px solid rgba(245, 158, 11, 0.45)',
    background: 'rgba(245, 158, 11, 0.12)',
    color: '#fbbf24',
  },
  success: {
    border: '1px solid rgba(34, 197, 94, 0.45)',
    background: 'rgba(34, 197, 94, 0.12)',
    color: '#bbf7d0',
    borderRadius: '18px',
    padding: '16px 18px',
    marginBottom: '18px',
    fontWeight: 800,
  },
  error: {
    border: '1px solid rgba(248, 113, 113, 0.5)',
    background: 'rgba(127, 29, 29, 0.25)',
    color: '#fecaca',
    borderRadius: '18px',
    padding: '16px 18px',
    marginBottom: '18px',
    fontWeight: 800,
  },
};

export default async function ArticleReviewPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const adminKey = getSingleParam(params?.key);
  const articleId = getSingleParam(params?.articleId).trim();
  const sourceId = getSingleParam(params?.sourceId).trim();
  const articleNumber = getSingleParam(params?.article).trim();
  const saved = getSingleParam(params?.saved);

  const expectedAdminKey = process.env.ADMIN_ACCESS_KEY;

  if (!expectedAdminKey) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <div style={styles.error}>
            المتغير ADMIN_ACCESS_KEY غير موجود داخل البيئة.
          </div>
        </div>
      </main>
    );
  }

  if (adminKey !== expectedAdminKey) {
    return (
      <main style={styles.page}>
        <div style={styles.container}>
          <section style={styles.card}>
            <p style={styles.label}>Hukumx Admin</p>
            <h1 style={styles.title}>دخول مراجعة المواد القانونية</h1>
            <p style={styles.subtitle}>أدخل مفتاح الإدارة للمتابعة.</p>

            <form method="GET" style={{ marginTop: '22px' }}>
              <input
                name="key"
                type="password"
                placeholder="ADMIN_ACCESS_KEY"
                style={styles.input}
              />

              <button type="submit" style={{ ...styles.button, marginTop: 12 }}>
                دخول
              </button>
            </form>
          </section>
        </div>
      </main>
    );
  }

  const article = articleId
    ? await prisma.legalArticle.findUnique({
        where: {
          id: articleId,
        },
        include: {
          legalSource: {
            include: {
              country: true,
            },
          },
        },
      })
    : articleNumber
      ? await prisma.legalArticle.findFirst({
          where: {
            articleNumber,
            ...(sourceId
              ? { legalSourceId: sourceId }
              : {
                  legalSource: {
                    isActive: true,
                  },
                }),
          },
          include: {
            legalSource: {
              include: {
                country: true,
              },
            },
          },
        })
      : null;

  const typedArticle = article as ReviewArticle | null;
  const processedText = typedArticle ? getMeaningfulProcessedText(typedArticle) : '';
  const editableText = typedArticle ? getInitialEditableText(typedArticle) : '';
  const backToSourceHref = typedArticle
    ? `/admin/legal-sources/${encodeURIComponent(
        typedArticle.legalSourceId
      )}?key=${encodeURIComponent(adminKey)}`
    : sourceId
      ? `/admin/legal-sources/${encodeURIComponent(sourceId)}?key=${encodeURIComponent(adminKey)}`
      : `/admin/legal-sources?key=${encodeURIComponent(adminKey)}`;

  const nextReviewArticleId = typedArticle
    ? await getNextNeedsReviewArticleId(
        typedArticle.articleNumber,
        typedArticle.id,
        typedArticle.legalSourceId
      )
    : '';

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <section style={styles.card}>
          <p style={styles.label}>Hukumx Admin</p>
          <h1 style={styles.title}>مراجعة وتعديل مادة قانونية</h1>
          <p style={styles.subtitle}>
            تعتمد هذه الصفحة على رقم تعريف المادة الداخلي حتى لا يحدث خلط بين مواد
            لها نفس الرقم في تشريعات مختلفة.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '12px',
              flexWrap: 'wrap',
              marginTop: '18px',
            }}
          >
            <Link href={`/admin/legal-sources?key=${encodeURIComponent(adminKey)}`} style={styles.secondaryButton}>
              العودة إلى كل التشريعات
            </Link>

            <Link href={backToSourceHref} style={styles.secondaryButton}>
              العودة إلى التشريع
            </Link>

            {nextReviewArticleId && typedArticle && (
              <Link
                href={`/admin/legal-sources/review?key=${encodeURIComponent(
                  adminKey
                )}&articleId=${encodeURIComponent(nextReviewArticleId)}&sourceId=${encodeURIComponent(
                  typedArticle.legalSourceId
                )}`}
                style={styles.nextButton}
              >
                المادة التالية التي تحتاج مراجعة
              </Link>
            )}
          </div>
        </section>

        {saved === '1' && (
          <div style={styles.success}>تم حفظ مراجعة المادة بنجاح.</div>
        )}

        {saved === 'ai' && (
          <div style={styles.success}>
            تم توليد نص معالج بالذكاء الصناعي. راجع النص ثم اضغط حفظ واعتماد المادة.
          </div>
        )}

        <section style={styles.card}>
          <form method="GET" style={styles.formRow}>
            <input name="key" type="hidden" value={adminKey} />
            {sourceId && <input name="sourceId" type="hidden" value={sourceId} />}

            <input
              name="article"
              defaultValue={articleNumber}
              placeholder="اكتب رقم المادة، مثال: 5"
              style={styles.input}
            />

            <button type="submit" style={styles.button}>
              فتح المادة
            </button>
          </form>
        </section>

        {(articleId || articleNumber) && !typedArticle && (
          <div style={styles.error}>
            لم يتم العثور على المادة المطلوبة. ارجع إلى صفحة التشريع واضغط زر
            مراجعة المادة من نفس البطاقة.
          </div>
        )}

        {typedArticle && (
          <>
            <section style={styles.card}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <div>
                  <p style={styles.label}>
                    {typedArticle.legalSource.country.nameAr} —{' '}
                    {typedArticle.legalSource.titleAr}
                  </p>

                  <h2 style={{ ...styles.title, fontSize: 26 }}>
                    المادة {typedArticle.articleNumber}
                  </h2>
                </div>

                <span style={styles.statusBadge}>
                  الحالة: {getReviewStatusLabel(typedArticle.reviewStatus)}
                </span>
              </div>
            </section>

            <form action={saveReviewedArticle}>
              <input name="key" type="hidden" value={adminKey} />
              <input name="articleId" type="hidden" value={typedArticle.id} />

              <section style={styles.row}>
                <div style={styles.card}>
                  <p style={styles.label}>النص كما استخرج من الملف</p>
                  <div style={styles.readonlyText}>
                    {typedArticle.articleText}
                  </div>
                </div>

                <div style={styles.card}>
                  <p style={styles.label}>النص المعالج بالذكاء الصناعي</p>
                  {processedText ? (
                    <div style={styles.readonlyText}>{processedText}</div>
                  ) : (
                    <div style={styles.warningText}>
                      لم يتم توليد نص معالج بالذكاء الصناعي لهذه المادة بعد.
                      يمكنك الضغط على زر "اقتراح نص مصحح بالذكاء الصناعي" في الأسفل.
                    </div>
                  )}
                </div>

                <div style={styles.card}>
                  <p style={styles.label}>النص المعتمد بعد المراجعة</p>

                  <textarea
                    name="reviewedText"
                    defaultValue={editableText}
                    style={styles.textarea}
                    required
                  />
                </div>
              </section>

              <section style={styles.card}>
                <p style={styles.label}>ملاحظات المراجعة</p>

                <textarea
                  name="reviewNotes"
                  defaultValue={typedArticle.reviewNotes || ''}
                  placeholder="مثال: تم تصحيح أخطاء OCR في الكلمات..."
                  style={{
                    ...styles.textarea,
                    minHeight: '140px',
                    fontSize: '15px',
                  }}
                />

                <div
                  style={{
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap',
                    marginTop: '18px',
                  }}
                >
                  <button
                    formAction={suggestAiReviewedArticle}
                    style={{
                      ...styles.secondaryButton,
                      background: 'rgba(59, 130, 246, 0.18)',
                      border: '1px solid rgba(96, 165, 250, 0.45)',
                      color: '#bfdbfe',
                    }}
                  >
                    اقتراح نص مصحح بالذكاء الصناعي
                  </button>

                  <button name="action" value="approve" style={styles.button}>
                    حفظ واعتماد المادة
                  </button>

                  <button
                    name="action"
                    value="approve_next"
                    style={styles.nextButton}
                  >
                    اعتماد والانتقال للمادة التالية
                  </button>

                  <button
                    name="action"
                    value="save"
                    style={styles.secondaryButton}
                  >
                    حفظ معالجة بدون اعتماد
                  </button>

                  <button
                    name="action"
                    value="needs_review"
                    style={styles.dangerButton}
                  >
                    تعليم كمادة تحتاج مراجعة
                  </button>
                </div>
              </section>
            </form>
          </>
        )}
      </div>
    </main>
  );
}

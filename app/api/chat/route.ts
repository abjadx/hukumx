import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

const client = new Anthropic();

const MAX_QUESTION_LENGTH = 2000;
const MAX_CONTEXT_FIELD_LENGTH = 100;

const SYSTEM_PROMPT = `
أنت Hukumx، مساعد قانوني ذكي باللغة العربية، مصمم لتقديم إرشاد قانوني أولي منظم وآمن وواضح للمستخدمين في العالم العربي.

هويتك:
- أنت مساعد قانوني رقمي، ولست محاميًا مرخصًا.
- لا تصدر أحكامًا قانونية نهائية.
- لا تستبدل المحامي أو المحكمة أو الجهة الرسمية.
- هدفك هو مساعدة المستخدم على فهم موقفه القانوني بشكل أولي، وتصنيف حالته، ومعرفة المعلومات الناقصة، والخطوات العملية الآمنة قبل مراجعة محامٍ مختص.

مهمتك الأساسية:
1. فهم سؤال المستخدم.
2. تحديد الدولة ونوع القضية من البيانات المرسلة.
3. تصنيف الحالة قانونيًا بشكل أولي.
4. تحديد ما إذا كانت المعلومات كافية.
5. تقديم إرشاد عام وآمن.
6. توضيح المعلومات الناقصة.
7. اقتراح خطوات عملية غير خطرة.
8. تنبيه المستخدم عند وجود ضرورة لمراجعة محامٍ أو جهة رسمية.
9. تجنب الجزم في المسائل القانونية الحساسة.
10. عدم اختراع قوانين أو مواد أو سوابق قضائية.

====================
قواعد أمان قانونية صارمة
====================

1. لا تقدم نفسك كمحامٍ مرخص.
2. لا تقل للمستخدم إن الإجابة نهائية أو مضمونة أو مؤكدة.
3. لا تخترع مواد قانونية أو أرقام قوانين أو أسماء محاكم أو سوابق قضائية.
4. إذا لم تكن متأكدًا من نص قانوني محدد، قل: "أحتاج إلى الرجوع إلى النص القانوني الرسمي للتأكد."
5. لا تقدم نصيحة تساعد على مخالفة القانون أو إخفاء الحقائق.
6. إذا كانت الحالة عاجلة، وجّه المستخدم فورًا إلى محامٍ أو الجهة المختصة.

====================
التعامل مع الدولة والقانون المختص
====================

إذا كانت الدولة غير مذكورة أو غير واضحة، أعطِ توجيهًا عامًا واطلب تحديد الدولة.

الدول المستهدفة: الأردن، السعودية، الإمارات، مصر، العراق، ودول عربية أخرى.

====================
المواعيد والمدد القانونية
====================

عند سؤال المستخدم عن مدة قانونية:
1. لا تعطِ مدة محددة بثقة إلا إذا كنت متأكدًا من النص الرسمي.
2. استخدم صياغة حذرة.
3. إذا كانت المدة قد تؤدي إلى سقوط حق، قل: "يجب مراجعة محامٍ أو قلم المحكمة فورًا."

====================
شكل الإجابة الإلزامي
====================

للحالات العادية:
## ملخص الحالة
## التصنيف القانوني المحتمل
## التوجيه الأولي
## المعلومات الناقصة
## الخطوات المقترحة
## متى تحتاج إلى محامٍ؟
## تنبيه مهم

للحالات عالية الخطورة (مدد، طعن، أحكام):
## تنبيه عاجل
## ملخص الحالة
## التوجيه الأولي
## المعلومات الناقصة
## الخطوات المقترحة
## متى تحتاج إلى محامٍ؟
## تنبيه مهم

====================
الأسئلة المقترحة
====================

في نهاية كل إجابة أضف:

---SUGGESTED_QUESTIONS---
سؤال قانوني مقترح قصير ومباشر متعلق بنفس الحالة
سؤال قانوني مقترح قصير ومباشر متعلق بنفس الحالة
سؤال قانوني مقترح قصير ومباشر متعلق بنفس الحالة
---END_SUGGESTED---
`;

type ChatRequestBody = {
  question?: unknown;
  country?: unknown;
  caseType?: unknown;
  intakeData?: {
    verdictType: string;
    notificationDate: string;
    court: string;
    role: string;
    details: string;
  } | null;
};

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as ChatRequestBody | null;

    if (!body || typeof body !== 'object') {
      return jsonError('طلب غير صالح', 400);
    }

    const question = normalizeText(body.question);
    const country = normalizeText(body.country);
    const caseType = normalizeText(body.caseType);
    const intakeData = body.intakeData || null;

    if (!question || !country || !caseType) {
      return jsonError('يرجى اختيار الدولة ونوع القضية وكتابة سؤالك', 400);
    }

    if (country === 'غير محدد' || caseType === 'غير محدد') {
      return jsonError('يرجى اختيار الدولة ونوع القضية قبل إرسال السؤال', 400);
    }

    if (question.length < 5) {
      return jsonError('السؤال قصير جداً، يرجى توضيح استفسارك', 400);
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      return jsonError(`السؤال طويل جداً، الحد الأقصى ${MAX_QUESTION_LENGTH} حرف`, 400);
    }

    if (country.length > MAX_CONTEXT_FIELD_LENGTH || caseType.length > MAX_CONTEXT_FIELD_LENGTH) {
      return jsonError('بيانات الدولة أو نوع القضية غير صالحة', 400);
    }

    // كشف إذا كان السؤال عن استئناف أو حكم
    if (!intakeData) {
      const detectMessage = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 10,
        messages: [{
          role: 'user',
          content: `هل هذا السؤال يتعلق باستئناف حكم قضائي أو تنفيذ حكم أو الطعن في حكم؟ أجب بـ YES أو NO فقط. السؤال: "${question}"`,
        }],
      });

      const detection = detectMessage.content[0].type === 'text'
        ? detectMessage.content[0].text.trim().toUpperCase()
        : 'NO';

      if (detection.includes('YES')) {
        return NextResponse.json({ needsIntake: true });
      }
    }

    // بناء السؤال الكامل
    const contentParts = [
      'بيانات الحالة القانونية:',
      `الدولة: ${country}`,
      `نوع القضية: ${caseType}`,
      `السؤال: ${question}`,
    ];

    if (intakeData) {
      contentParts.push('');
      contentParts.push('تفاصيل الحكم:');
      contentParts.push(`- نوع الحكم: ${intakeData.verdictType}`);
      contentParts.push(`- تاريخ التبليغ: ${intakeData.notificationDate}`);
      contentParts.push(`- المحكمة: ${intakeData.court}`);
      contentParts.push(`- صفة المستخدم: ${intakeData.role}`);
      contentParts.push(`- تفاصيل إضافية: ${intakeData.details || 'لا يوجد'}`);
    }

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: contentParts.join('\n') }],
    });

    const firstContent = message.content[0];
    const fullText = firstContent?.type === 'text' ? firstContent.text : '';

    if (!fullText.trim()) {
      return jsonError('لم نتمكن من توليد إجابة، حاول مرة أخرى', 500);
    }

    const [rawAnswer, rawSuggestionsSection] = fullText.split('---SUGGESTED_QUESTIONS---');
    const answer = rawAnswer.trim();

    let suggestions: string[] = [];
    if (rawSuggestionsSection) {
      const suggestionsText = rawSuggestionsSection.split('---END_SUGGESTED---')[0].trim();
      suggestions = suggestionsText
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0)
        .slice(0, 3);
    }

    return NextResponse.json({ answer, suggestions });

  } catch (error: unknown) {
    console.error('Hukumx API Error:', error);

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('authentication') || msg.includes('api key')) {
        return jsonError('خطأ في الاتصال بالخدمة', 500);
      }
      if (msg.includes('rate_limit') || msg.includes('rate limit')) {
        return jsonError('الخدمة مشغولة حالياً، حاول بعد لحظة', 429);
      }
      if (msg.includes('overloaded') || msg.includes('timeout')) {
        return jsonError('الخدمة مشغولة حالياً، يرجى المحاولة بعد قليل', 503);
      }
    }

    return jsonError('حدث خطأ غير متوقع، يرجى المحاولة مرة أخرى', 500);
  }
}
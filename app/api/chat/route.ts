import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1';
const JORDAN_LAWS_VECTOR_STORE_ID =
  process.env.OPENAI_VECTOR_STORE_JORDAN_LAWS;

const MAX_QUESTION_LENGTH = 2000;
const MAX_CONTEXT_FIELD_LENGTH = 120;
const MAX_DETAILS_LENGTH = 1000;

const SYSTEM_PROMPT = `
أنت Hukumx، مساعد قانوني ذكي باللغة العربية، مصمم لتقديم إرشاد قانوني أولي منظم وآمن وواضح للمستخدمين في العالم العربي.

هويتك:
- أنت مساعد قانوني رقمي، ولست محاميًا مرخصًا.
- لا تصدر أحكامًا قانونية نهائية.
- لا تستبدل المحامي أو المحكمة أو الجهة الرسمية.
- هدفك هو مساعدة المستخدم على فهم موقفه القانوني بشكل أولي، وتصنيف حالته، ومعرفة المعلومات الناقصة، والخطوات العملية الآمنة قبل مراجعة محامٍ مختص.

قواعد أساسية:
1. لا تقدم نفسك كمحامٍ مرخص.
2. لا تقل إن الإجابة نهائية أو مضمونة أو مؤكدة.
3. لا تخترع مواد قانونية أو أرقام قوانين أو سوابق قضائية.
4. إذا لم تكن متأكدًا من نص قانوني محدد، قل: "أحتاج إلى الرجوع إلى النص القانوني الرسمي للتأكد."
5. لا تقدم توجيهًا يساعد على مخالفة القانون أو إخفاء الحقائق أو تضليل جهة رسمية.
6. لا تطلب بيانات شخصية حساسة مثل الرقم الوطني، رقم الحساب البنكي، كلمة المرور، العنوان الدقيق، أو أي بيانات شديدة الخصوصية.
7. إذا كانت الحالة عاجلة أو قد تؤدي إلى ضياع حق قانوني، وجّه المستخدم فورًا إلى محامٍ أو المحكمة أو الجهة المختصة.

====================
التعامل مع الدولة والقانون المختص
====================

القوانين تختلف من دولة لأخرى.

إذا كانت الدولة غير مذكورة أو غير واضحة:
- لا تعطِ جوابًا تفصيليًا كأنه قانون دولة معينة.
- أعطِ توجيهًا عامًا جدًا.
- اطلب من المستخدم تحديد الدولة.

إذا ذُكرت الدولة:
- اربط الإجابة بها بشكل عام.
- لا تذكر مواد قانونية أو أرقام قوانين إلا إذا كنت واثقًا جدًا.
- إذا لم يتوفر مصدر رسمي داخل النظام، لا تصغ الإجابة كأنها فتوى نهائية.

====================
المواعيد والمدد القانونية
====================

المواعيد القانونية من أكثر المسائل حساسية، وتشمل مدد الاستئناف والاعتراض والطعن والتمييز والتبليغ والتقادم والتنفيذ وتقديم اللوائح أو الطلبات.

عند سؤال المستخدم عن مدة قانونية:
1. لا تعطِ مدة محددة بثقة إلا إذا كنت متأكدًا من النص القانوني الرسمي.
2. إذا لم يكن لديك مصدر رسمي داخل النظام، لا تصغ المدة كحقيقة نهائية.
3. استخدم صياغة حذرة مثل: "قد تختلف المدة حسب نوع الحكم، المحكمة، طريقة صدوره، وطريقة تبليغه."
4. إذا كان فوات المدة قد يؤدي إلى سقوط حق، قل بوضوح: "يجب مراجعة محامٍ أو قلم المحكمة فورًا لأن فوات المدة قد يؤدي إلى سقوط الحق."
5. لا تجعل المستخدم يعتمد على رقم زمني دون تحقق رسمي.

إذا كان السؤال عن مدة قانونية أو استئناف أو اعتراض أو طعن:
- ابدأ answer بقسم "## تنبيه عاجل".
- لا تجعل الإجابة طويلة.
- لا تذكر مدة رقمية إلا بصيغة حذرة جدًا ومع التنبيه إلى ضرورة التحقق الرسمي.
- اجعل أول خطوة مقترحة هي مراجعة محامٍ أو قلم المحكمة فورًا.

====================
الأحكام والقضايا المنظورة
====================

إذا كان السؤال عن حكم صدر أو قضية منظورة:
- لا تفترض نتيجة القضية.
- لا تجزم بإمكانية الاستئناف أو النجاح.
- اسأل عن نوع الحكم، طريقة صدوره، تاريخ التبليغ، والمحكمة.
- وجّه المستخدم لمراجعة محامٍ إذا كان هناك موعد طعن أو تنفيذ.
- إذا كان هناك تنفيذ أو تبليغ تنفيذ، شدد على ضرورة التصرف العاجل ومراجعة محامٍ أو دائرة التنفيذ.
- إذا لم يكن لدى المستخدم نسخة من الحكم، اجعل الحصول عليها خطوة أساسية.

====================
مسار العقود والشركات
====================

إذا كانت الحالة متعلقة بعقد أو شركة أو شراكة أو اتفاق تجاري:
- لا تجزم بصحة العقد أو بطلانه.
- لا تقل إن المستخدم يستطيع الفسخ فورًا دون مراجعة شروط العقد والقانون المختص.
- ركّز على مراجعة كامل العقد وليس بندًا منفردًا.
- انتبه للشروط الجزائية، الاختصاص القضائي، القانون الواجب التطبيق، الملكية الفكرية، السرية، عدم المنافسة، مدة العقد، وطريقة الإنهاء.
- إذا كان العقد قبل التوقيع، اجعل النصيحة وقائية.
- إذا حدث خلاف بالفعل، اجعل النصيحة عملية وإجرائية.
- إذا توجد مبالغ مالية أو شرط جزائي أو خلاف شركاء، وجّه لمراجعة محامٍ قبل التصرف.
- لا تعطِ حكمًا قطعيًا مثل "البند باطل" أو "العقد صحيح 100%" أو "لن تتحمل مسؤولية".

إذا كانت حالة العقود عالية الخطورة، ابدأ answer بقسم:
## تنبيه مهم قبل التصرف

وتعتبر الحالة عالية الخطورة إذا تضمنت:
- توقيع عقد قبل المراجعة
- فسخ عقد
- شرط جزائي كبير
- مطالبة مالية كبيرة
- خلاف شركاء
- تصفية شركة
- نقل ملكية فكرية
- عدم منافسة
- تحكيم أو اختصاص أجنبي
- التزام طويل المدى

====================
الأدلة والمستندات
====================

عند الحديث عن الأدلة:
- شجع المستخدم على حفظ المستندات والرسائل والعقود والإيصالات.
- لا تشجعه على تعديل أو حذف أو إخفاء أي دليل.
- لا تقترح تسجيل مكالمات أو تصوير أشخاص دون تنبيه أن ذلك قد يكون مقيدًا قانونيًا حسب الدولة.
- قل دائمًا إن استخدام الأدلة يجب أن يكون بطريقة قانونية.

====================
شكل الإجابة داخل answer
====================

للحالات العادية استخدم:

## ملخص الحالة
## التصنيف القانوني المحتمل
## التوجيه الأولي
## المعلومات الناقصة
## الخطوات المقترحة
## متى تحتاج إلى محامٍ؟
## تنبيه مهم

لحالات الأحكام والاستئناف والطعون والتنفيذ استخدم:

## تنبيه عاجل
## ملخص الحالة
## التوجيه الأولي
## المعلومات الناقصة
## الخطوات المقترحة
## متى تحتاج إلى محامٍ؟
## ملخص مختصر للمحامي
## تنبيه مهم

لحالات العقود والشركات استخدم:

## ملخص الحالة
## التصنيف القانوني المحتمل
## أهم المخاطر
## التوجيه الأولي
## البنود أو المعلومات التي يجب مراجعتها
## الخطوات المقترحة
## متى تحتاج إلى محامٍ؟
## ملخص مختصر للمحامي
## تنبيه مهم

في قسم "تنبيه مهم" اكتب دائمًا:
"هذه إجابة إرشادية أولية وليست استشارة قانونية نهائية. تختلف النتيجة حسب الدولة، المستندات، والوقائع التفصيلية، لذلك يُفضّل مراجعة محامٍ مختص قبل اتخاذ أي إجراء."

====================
الاعتماد على المصادر القانونية
====================

إذا توفرت مصادر قانونية مسترجعة من قاعدة القوانين، يجب الاعتماد عليها عند ذكر أي مادة قانونية أو مدة طعن أو إجراء محدد.

قواعد إلزامية:
- لا تذكر رقم مادة أو مدة قانونية أو إجراء محدد على أنه مؤكد إلا إذا كان مدعومًا من النصوص القانونية المسترجعة.
- إذا لم تجد في المصادر نصًا كافيًا، قل بوضوح: "لا تحتوي قاعدة المصادر الحالية على نص كافٍ لتأكيد الإجابة بدقة."
- لا تخترع مواد أو أرقام قوانين أو مددًا.
- إذا تعارضت معرفة النموذج العامة مع النصوص المسترجعة، اعتمد على النصوص المسترجعة.
- حتى عند وجود نص مسترجع، ابقَ حذرًا لأن التطبيق العملي قد يعتمد على نوع الحكم، طريقة صدوره، تاريخ التبليغ، العطل الرسمية، ووقائع الملف.

====================
صيغة الإخراج الإلزامية
====================

يجب أن يكون الإخراج النهائي JSON فقط، بدون Markdown خارج JSON، وبدون أي نص إضافي قبله أو بعده.

أعد النتيجة بهذه الحقول فقط:

{
  "answer": "الإجابة القانونية الكاملة بصيغة Markdown عربية واضحة",
  "suggestions": [
    "سؤال متابعة قصير ومباشر متعلق بنفس الحالة",
    "سؤال متابعة قصير ومباشر متعلق بنفس الحالة",
    "سؤال متابعة قصير ومباشر متعلق بنفس الحالة"
  ],
  "lawyerSummary": "ملخص مختصر منظم يصلح أن يرسله المستخدم لمحامٍ، بدون بيانات شخصية حساسة"
}

قواعد answer:
- اكتب الإجابة كاملة باللغة العربية.
- استخدم عناوين Markdown المناسبة حسب نوع الحالة.
- لا تضع قسم الأسئلة المقترحة داخل answer.
- إذا كانت الحالة من مسار الأحكام أو العقود، يجب أن تحتوي answer على قسم "## ملخص مختصر للمحامي" أيضًا، ولكن لا مانع من تكرار نفس الملخص في lawyerSummary بشكل مختصر.

قواعد suggestions:
- يجب أن تكون 3 أسئلة فقط.
- لا تستخدم ترقيمًا.
- لا تستخدم Markdown.
- يجب أن تكون مرتبطة بنفس الحالة.

قواعد lawyerSummary:
- لا تضع بيانات شخصية حساسة.
- اجعله عمليًا ومختصرًا.
- يجب أن يذكر الدولة، نوع القضية، والسؤال/المشكلة إذا كانت متاحة.
`;

type IntakeType = 'judgmentAppeal' | 'contractsBusiness';

type JudgmentIntakeData = {
  verdictType?: unknown;
  appearanceType?: unknown;
  notificationStatus?: unknown;
  notificationDate?: unknown;
  court?: unknown;
  role?: unknown;
  hasExecution?: unknown;
  hasJudgmentCopy?: unknown;
  details?: unknown;
};

type ContractIntakeData = {
  contractType?: unknown;
  userRole?: unknown;
  hasWrittenContract?: unknown;
  isSigned?: unknown;
  mainIssue?: unknown;
  hasMoney?: unknown;
  moneyDetails?: unknown;
  hasPenaltyClause?: unknown;
  hasDuration?: unknown;
  durationDetails?: unknown;
  hasJurisdictionClause?: unknown;
  hasIpOrConfidentiality?: unknown;
  stage?: unknown;
  details?: unknown;
};

type ChatRequestBody = {
  question?: unknown;
  country?: unknown;
  caseType?: unknown;
  intakeType?: IntakeType | null;
  judgmentIntakeData?: JudgmentIntakeData | null;
  contractIntakeData?: ContractIntakeData | null;

  // Backward compatibility with the first flow
  intakeData?: JudgmentIntakeData | null;
};

type LegalAiOutput = {
  answer: string;
  suggestions: string[];
  lawyerSummary: string;
};

const LEGAL_AI_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    answer: {
      type: 'string',
      description: 'The full legal guidance answer in Arabic Markdown.',
    },
    suggestions: {
      type: 'array',
      description: 'Three short Arabic follow-up legal questions.',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'string',
      },
    },
    lawyerSummary: {
      type: 'string',
      description:
        'A concise Arabic summary the user can send to a specialized lawyer.',
    },
  },
  required: ['answer', 'suggestions', 'lawyerSummary'],
} as const;

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim();
}

function isJudgmentOrAppealQuestion(question: string) {
  const keywords = [
    'استئناف',
    'اعتراض',
    'تمييز',
    'طعن',
    'حكم',
    'محكمة',
    'تبليغ',
    'تنفيذ',
    'مدة',
    'ميعاد',
    'قرار قضائي',
  ];

  return keywords.some((keyword) => question.includes(keyword));
}

function isContractOrBusinessQuestion(question: string) {
  const keywords = [
    'عقد',
    'العقد',
    'اتفاق',
    'اتفاقية',
    'بند',
    'بنود',
    'شرط',
    'شروط',
    'فسخ',
    'إنهاء العقد',
    'إلغاء العقد',
    'تعديل العقد',
    'مخالفة العقد',
    'خرق العقد',
    'التزام',
    'التزامات',
    'مسودة عقد',
    'توقيع العقد',
    'توقيع إلكتروني',

    'عقد خدمات',
    'عقد عمل',
    'عقد شراكة',
    'عقد توريد',
    'عقد بيع',
    'عقد استثمار',
    'عقد مقاولة',
    'عقد وكالة',
    'عقد توزيع',
    'اتفاقية سرية',
    'NDA',
    'nda',
    'freelancer',
    'فريلانسر',
    'مستقل',

    'شركة',
    'شركات',
    'شريك',
    'شركاء',
    'شراكة',
    'مؤسس',
    'مؤسسين',
    'حصص',
    'نسبة شراكة',
    'أرباح',
    'توزيع أرباح',
    'خسائر',
    'إدارة الشركة',
    'خروج شريك',
    'دخول شريك',
    'تصفية شركة',
    'تأسيس شركة',

    'دفعة',
    'مبلغ',
    'مستحقات',
    'مطالبة مالية',
    'شرط جزائي',
    'غرامة تأخير',
    'تعويض',
    'تأخير الدفع',
    'عدم الدفع',
    'دفعات',
    'أتعاب',
    'عمولة',
    'نسبة',
    'مخالصة',

    'سرية',
    'عدم إفشاء',
    'ملكية فكرية',
    'حقوق الملكية',
    'حقوق النشر',
    'تصميم',
    'شعار',
    'كود',
    'برمجة',
    'تطبيق',
    'موقع',
    'استخدام المحتوى',
    'عدم منافسة',
    'non compete',
    'confidentiality',
  ];

  const normalizedQuestion = question.toLowerCase();

  return keywords.some((keyword) =>
    normalizedQuestion.includes(keyword.toLowerCase())
  );
}

function normalizeJudgmentIntakeData(intakeData: JudgmentIntakeData | null) {
  if (!intakeData || typeof intakeData !== 'object') return null;

  const verdictType = normalizeText(intakeData.verdictType);
  const appearanceType = normalizeText(intakeData.appearanceType);
  const notificationStatus = normalizeText(intakeData.notificationStatus);
  const notificationDate =
    normalizeText(intakeData.notificationDate) || 'غير محدد';
  const court = normalizeText(intakeData.court);
  const role = normalizeText(intakeData.role);
  const hasExecution = normalizeText(intakeData.hasExecution);
  const hasJudgmentCopy = normalizeText(intakeData.hasJudgmentCopy);
  const details = normalizeText(intakeData.details) || 'لا يوجد';

  if (
    !verdictType ||
    !appearanceType ||
    !notificationStatus ||
    !court ||
    !role ||
    !hasExecution ||
    !hasJudgmentCopy
  ) {
    return null;
  }

  const fields = [
    verdictType,
    appearanceType,
    notificationStatus,
    notificationDate,
    court,
    role,
    hasExecution,
    hasJudgmentCopy,
  ];

  if (fields.some((field) => field.length > MAX_CONTEXT_FIELD_LENGTH)) {
    return null;
  }

  if (details.length > MAX_DETAILS_LENGTH) {
    return null;
  }

  return {
    verdictType,
    appearanceType,
    notificationStatus,
    notificationDate,
    court,
    role,
    hasExecution,
    hasJudgmentCopy,
    details,
  };
}

function normalizeContractIntakeData(intakeData: ContractIntakeData | null) {
  if (!intakeData || typeof intakeData !== 'object') return null;

  const contractType = normalizeText(intakeData.contractType);
  const userRole = normalizeText(intakeData.userRole);
  const hasWrittenContract = normalizeText(intakeData.hasWrittenContract);
  const isSigned = normalizeText(intakeData.isSigned);
  const mainIssue = normalizeText(intakeData.mainIssue);
  const hasMoney = normalizeText(intakeData.hasMoney) || 'غير محدد';
  const moneyDetails = normalizeText(intakeData.moneyDetails) || 'غير محدد';
  const hasPenaltyClause =
    normalizeText(intakeData.hasPenaltyClause) || 'غير محدد';
  const hasDuration = normalizeText(intakeData.hasDuration) || 'غير محدد';
  const durationDetails =
    normalizeText(intakeData.durationDetails) || 'غير محدد';
  const hasJurisdictionClause =
    normalizeText(intakeData.hasJurisdictionClause) || 'غير محدد';
  const hasIpOrConfidentiality =
    normalizeText(intakeData.hasIpOrConfidentiality) || 'غير محدد';
  const stage = normalizeText(intakeData.stage);
  const details = normalizeText(intakeData.details) || 'لا يوجد';

  if (
    !contractType ||
    !userRole ||
    !hasWrittenContract ||
    !isSigned ||
    !mainIssue ||
    !stage
  ) {
    return null;
  }

  const fields = [
    contractType,
    userRole,
    hasWrittenContract,
    isSigned,
    mainIssue,
    hasMoney,
    hasPenaltyClause,
    hasDuration,
    hasJurisdictionClause,
    hasIpOrConfidentiality,
    stage,
  ];

  if (fields.some((field) => field.length > MAX_CONTEXT_FIELD_LENGTH)) {
    return null;
  }

  if (
    moneyDetails.length > MAX_DETAILS_LENGTH ||
    durationDetails.length > MAX_DETAILS_LENGTH ||
    details.length > MAX_DETAILS_LENGTH
  ) {
    return null;
  }

  return {
    contractType,
    userRole,
    hasWrittenContract,
    isSigned,
    mainIssue,
    hasMoney,
    moneyDetails,
    hasPenaltyClause,
    hasDuration,
    durationDetails,
    hasJurisdictionClause,
    hasIpOrConfidentiality,
    stage,
    details,
  };
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

    if (!question) {
      return jsonError('يرجى كتابة سؤالك القانوني', 400);
    }

    if (!country || country === 'غير محدد') {
      return jsonError('يرجى اختيار الدولة قبل إرسال السؤال', 400);
    }

    if (!caseType || caseType === 'غير محدد') {
      return jsonError('يرجى اختيار نوع القضية قبل إرسال السؤال', 400);
    }

    if (question.length < 5) {
      return jsonError('السؤال قصير جداً، يرجى توضيح استفسارك', 400);
    }

    if (question.length > MAX_QUESTION_LENGTH) {
      return jsonError(
        `السؤال طويل جداً، الحد الأقصى ${MAX_QUESTION_LENGTH} حرف`,
        400
      );
    }

    if (
      country.length > MAX_CONTEXT_FIELD_LENGTH ||
      caseType.length > MAX_CONTEXT_FIELD_LENGTH
    ) {
      return jsonError('بيانات الدولة أو نوع القضية غير صالحة', 400);
    }

    const judgmentSource = body.judgmentIntakeData || body.intakeData || null;
    const normalizedJudgmentIntake =
      normalizeJudgmentIntakeData(judgmentSource);

    const normalizedContractIntake = normalizeContractIntakeData(
      body.contractIntakeData || null
    );

    if (
      (body.intakeType === 'judgmentAppeal' ||
        body.judgmentIntakeData ||
        body.intakeData) &&
      !normalizedJudgmentIntake
    ) {
      return jsonError(
        'بيانات نموذج الحكم أو الاستئناف غير مكتملة أو غير صالحة',
        400
      );
    }

    if (body.intakeType === 'contractsBusiness' && !normalizedContractIntake) {
      return jsonError(
        'بيانات نموذج العقود والشركات غير مكتملة أو غير صالحة',
        400
      );
    }

    if (!normalizedJudgmentIntake && !normalizedContractIntake) {
      if (isJudgmentOrAppealQuestion(question)) {
        return NextResponse.json({
          needsIntake: true,
          intakeType: 'judgmentAppeal',
        });
      }

      if (isContractOrBusinessQuestion(question)) {
        return NextResponse.json({
          needsIntake: true,
          intakeType: 'contractsBusiness',
        });
      }
    }

    const contentParts = [
      'بيانات الحالة القانونية المقدمة من المستخدم:',
      `الدولة: ${country}`,
      `نوع القضية: ${caseType}`,
      `السؤال: ${question}`,
    ];

    if (country === 'الأردن' && JORDAN_LAWS_VECTOR_STORE_ID) {
      contentParts.push('');
      contentParts.push(
        'ملاحظة مهمة: توجد قاعدة مصادر قانونية أردنية مرتبطة بهذا الطلب. استخدم أداة file_search للبحث داخل قانون أصول المحاكمات المدنية الأردني عند الإجابة عن المدد، التبليغ، الاستئناف، الطعن، الاختصاص، والإجراءات.'
      );
    }

    if (normalizedJudgmentIntake) {
      contentParts.push('');
      contentParts.push('تفاصيل نموذج الحكم أو الاستئناف:');
      contentParts.push(
        `- نوع الحكم أو القرار: ${normalizedJudgmentIntake.verdictType}`
      );
      contentParts.push(
        `- طريقة صدور الحكم: ${normalizedJudgmentIntake.appearanceType}`
      );
      contentParts.push(
        `- حالة التبليغ: ${normalizedJudgmentIntake.notificationStatus}`
      );
      contentParts.push(
        `- تاريخ التبليغ أو التاريخ المتاح: ${normalizedJudgmentIntake.notificationDate}`
      );
      contentParts.push(
        `- المحكمة أو الجهة: ${normalizedJudgmentIntake.court}`
      );
      contentParts.push(
        `- صفة المستخدم في القضية: ${normalizedJudgmentIntake.role}`
      );
      contentParts.push(
        `- هل يوجد تنفيذ أو تبليغ تنفيذ: ${normalizedJudgmentIntake.hasExecution}`
      );
      contentParts.push(
        `- هل لدى المستخدم نسخة من الحكم: ${normalizedJudgmentIntake.hasJudgmentCopy}`
      );
      contentParts.push(
        `- تفاصيل إضافية: ${normalizedJudgmentIntake.details}`
      );
      contentParts.push('');
      contentParts.push(
        'تعامل مع هذه الحالة كمسألة عالية الحساسية مرتبطة بحكم أو مدة قانونية. لا تعطِ مدة قطعية دون مصدر رسمي، وركّز على التحقق من التبليغ ونوع الحكم والجهة المختصة والتنفيذ ونسخة الحكم.'
      );
    }

    if (normalizedContractIntake) {
      contentParts.push('');
      contentParts.push('تفاصيل نموذج العقود والشركات:');
      contentParts.push(
        `- نوع العقد أو العلاقة: ${normalizedContractIntake.contractType}`
      );
      contentParts.push(
        `- صفة المستخدم في العلاقة: ${normalizedContractIntake.userRole}`
      );
      contentParts.push(
        `- هل يوجد عقد مكتوب: ${normalizedContractIntake.hasWrittenContract}`
      );
      contentParts.push(
        `- هل تم توقيع العقد: ${normalizedContractIntake.isSigned}`
      );
      contentParts.push(
        `- المشكلة الرئيسية: ${normalizedContractIntake.mainIssue}`
      );
      contentParts.push(
        `- هل توجد مبالغ مالية أو مستحقات: ${normalizedContractIntake.hasMoney}`
      );
      contentParts.push(
        `- تفاصيل المبلغ أو المستحقات: ${normalizedContractIntake.moneyDetails}`
      );
      contentParts.push(
        `- هل يوجد شرط جزائي أو غرامة تأخير: ${normalizedContractIntake.hasPenaltyClause}`
      );
      contentParts.push(
        `- هل توجد مدة محددة للعقد: ${normalizedContractIntake.hasDuration}`
      );
      contentParts.push(
        `- مدة العقد أو تاريخ الانتهاء: ${normalizedContractIntake.durationDetails}`
      );
      contentParts.push(
        `- هل يوجد بند اختصاص أو قانون واجب التطبيق: ${normalizedContractIntake.hasJurisdictionClause}`
      );
      contentParts.push(
        `- هل توجد سرية أو ملكية فكرية: ${normalizedContractIntake.hasIpOrConfidentiality}`
      );
      contentParts.push(
        `- مرحلة العلاقة: ${normalizedContractIntake.stage}`
      );
      contentParts.push(
        `- تفاصيل إضافية: ${normalizedContractIntake.details}`
      );
      contentParts.push('');
      contentParts.push(
        'تعامل مع هذه الحالة كمسألة عقود وشركات. لا تجزم بصحة العقد أو بطلان البند. ركّز على المخاطر، البنود الواجب مراجعتها، الخطوات العملية، وما يجب عرضه على محامٍ قبل التوقيع أو الفسخ أو المطالبة.'
      );
    }
    const shouldUseJordanLegalSources =
      country === 'الأردن' && Boolean(JORDAN_LAWS_VECTOR_STORE_ID);

    const response = await openai.responses.create({
      model: OPENAI_MODEL,
      instructions: SYSTEM_PROMPT,
      input: contentParts.join('\n'),
      max_output_tokens: 2400,
      ...(shouldUseJordanLegalSources
        ? {
            tools: [
              {
                type: 'file_search' as const,
                vector_store_ids: [JORDAN_LAWS_VECTOR_STORE_ID as string],
                max_num_results: 6,
              },
            ],
          }
        : {}),
      text: {
        format: {
          type: 'json_schema',
          name: 'legal_ai_output',
          strict: true,
          schema: LEGAL_AI_OUTPUT_SCHEMA,
        },
      },
    });

    const fullText = response.output_text || '';

    if (!fullText.trim()) {
      return jsonError('لم نتمكن من توليد إجابة، حاول مرة أخرى', 500);
    }

    let parsedOutput: LegalAiOutput;

    try {
      parsedOutput = JSON.parse(fullText) as LegalAiOutput;
    } catch {
      return jsonError('تعذر قراءة مخرجات الذكاء الصناعي، حاول مرة أخرى', 500);
    }

    const answer = parsedOutput.answer?.trim();

    const suggestions = Array.isArray(parsedOutput.suggestions)
      ? parsedOutput.suggestions
          .map((suggestion) => suggestion.trim())
          .filter((suggestion) => suggestion.length > 0)
          .slice(0, 3)
      : [];

    const lawyerSummary = parsedOutput.lawyerSummary?.trim() || '';

    if (!answer) {
      return jsonError('لم نتمكن من توليد إجابة، حاول مرة أخرى', 500);
    }

    return NextResponse.json({
      answer,
      suggestions,
      lawyerSummary,
    });
  } catch (error: unknown) {
    console.error('Hukumx API Error:', error);

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();

      if (
        msg.includes('authentication') ||
        msg.includes('api key') ||
        msg.includes('unauthorized') ||
        msg.includes('invalid_api_key')
      ) {
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
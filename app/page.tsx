'use client';

import { useState } from 'react';
import { COUNTRIES, CASE_TYPES } from './data/legal-options';
import {
  ContractIntakeData,
  EMPTY_CONTRACT_INTAKE,
  EMPTY_JUDGMENT_INTAKE,
  IntakeType,
  JudgmentIntakeData,
} from './types/legal';

import CountrySelector from './components/CountrySelector';
import CaseTypeSelector from './components/CaseTypeSelector';
import QuestionBox from './components/QuestionBox';
import FormError from './components/FormError';
import LoadingSkeleton from './components/LoadingSkeleton';
import AnswerBox from './components/AnswerBox';
import SuggestedQuestions from './components/SuggestedQuestions';

export default function Home() {
  const [country, setCountry] = useState('');
  const [caseType, setCaseType] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState('');

  const [intakeType, setIntakeType] = useState<IntakeType>(null);
  const [activeAnswerIntakeType, setActiveAnswerIntakeType] =
    useState<IntakeType>(null);
  const [pendingQuestion, setPendingQuestion] = useState('');

  const [judgmentIntakeData, setJudgmentIntakeData] =
    useState<JudgmentIntakeData>(EMPTY_JUDGMENT_INTAKE);

  const [contractIntakeData, setContractIntakeData] =
    useState<ContractIntakeData>(EMPTY_CONTRACT_INTAKE);

  const selectedCountry = COUNTRIES.find((c) => c.code === country);
  const selectedCaseType = CASE_TYPES.find((c) => c.code === caseType);

  const hasJudgmentIntakeData =
    judgmentIntakeData.verdictType ||
    judgmentIntakeData.appearanceType ||
    judgmentIntakeData.notificationStatus ||
    judgmentIntakeData.notificationDate ||
    judgmentIntakeData.court ||
    judgmentIntakeData.role ||
    judgmentIntakeData.hasExecution ||
    judgmentIntakeData.hasJudgmentCopy ||
    judgmentIntakeData.details;

  const hasContractIntakeData =
    contractIntakeData.contractType ||
    contractIntakeData.userRole ||
    contractIntakeData.hasWrittenContract ||
    contractIntakeData.isSigned ||
    contractIntakeData.mainIssue ||
    contractIntakeData.hasMoney ||
    contractIntakeData.moneyDetails ||
    contractIntakeData.hasPenaltyClause ||
    contractIntakeData.hasDuration ||
    contractIntakeData.durationDetails ||
    contractIntakeData.hasJurisdictionClause ||
    contractIntakeData.hasIpOrConfidentiality ||
    contractIntakeData.stage ||
    contractIntakeData.details;

  const hasAnyIntakeData = hasJudgmentIntakeData || hasContractIntakeData;

  const startNewQuestion = () => {
    setCountry('');
    setCaseType('');
    setQuestion('');
    setAnswer('');
    setSuggestions([]);
    setLoading(false);
    setFormError('');
    setIntakeType(null);
    setActiveAnswerIntakeType(null);
    setPendingQuestion('');
    setJudgmentIntakeData(EMPTY_JUDGMENT_INTAKE);
    setContractIntakeData(EMPTY_CONTRACT_INTAKE);
  };

  const editIntakeDetails = () => {
    setAnswer('');
    setSuggestions([]);

    if (activeAnswerIntakeType) {
      setIntakeType(activeAnswerIntakeType);
    }

    if (!pendingQuestion && question) {
      setPendingQuestion(question);
    }
  };

  const askQuestion = async (
    q?: string,
    submittedIntakeType?: IntakeType,
    judgmentData?: JudgmentIntakeData | null,
    contractData?: ContractIntakeData | null
  ) => {
    const finalQuestion = q || question;

    if (!finalQuestion.trim()) {
      setFormError('يرجى كتابة سؤالك القانوني أولًا');
      return;
    }

    setFormError('');

    if (!country) {
      setFormError('يرجى اختيار الدولة أولًا 👆');
      return;
    }

    if (!caseType) {
      setFormError('يرجى اختيار نوع القضية أولًا 👆');
      return;
    }

    setLoading(true);
    setAnswer('');
    setSuggestions([]);
    setIntakeType(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: finalQuestion,
          country: selectedCountry?.name || 'غير محدد',
          caseType: selectedCaseType?.name || 'غير محدد',
          intakeType: submittedIntakeType,
          judgmentIntakeData: judgmentData || null,
          contractIntakeData: contractData || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAnswer(`> ⚠️ **${data.error || 'حدث خطأ'}**`);
        return;
      }

      if (data.needsIntake) {
        setPendingQuestion(finalQuestion);

        if (data.intakeType === 'judgmentAppeal') {
          setJudgmentIntakeData(EMPTY_JUDGMENT_INTAKE);
          setIntakeType('judgmentAppeal');
        } else if (data.intakeType === 'contractsBusiness') {
          setContractIntakeData(EMPTY_CONTRACT_INTAKE);
          setIntakeType('contractsBusiness');
        }

        return;
      }

      setQuestion(finalQuestion);
      setAnswer(data.answer || '');
      setSuggestions(data.suggestions || []);
      setActiveAnswerIntakeType(submittedIntakeType || null);
    } catch {
      setAnswer('> ⚠️ **تعذّر الاتصال بالخادم، تحقق من اتصالك بالإنترنت**');
    } finally {
      setLoading(false);
    }
  };

  const submitJudgmentIntake = () => {
    if (
      !judgmentIntakeData.verdictType ||
      !judgmentIntakeData.appearanceType ||
      !judgmentIntakeData.notificationStatus ||
      !judgmentIntakeData.court ||
      !judgmentIntakeData.role ||
      !judgmentIntakeData.hasExecution ||
      !judgmentIntakeData.hasJudgmentCopy
    ) {
      setFormError('يرجى تعبئة الحقول المطلوبة في نموذج الحكم أو الاستئناف');
      return;
    }

    setFormError('');
    askQuestion(
      pendingQuestion,
      'judgmentAppeal',
      judgmentIntakeData,
      null
    );
  };

  const submitContractIntake = () => {
    if (
      !contractIntakeData.contractType ||
      !contractIntakeData.userRole ||
      !contractIntakeData.hasWrittenContract ||
      !contractIntakeData.isSigned ||
      !contractIntakeData.mainIssue ||
      !contractIntakeData.stage
    ) {
      setFormError('يرجى تعبئة الحقول المطلوبة في نموذج العقود والشركات');
      return;
    }

    setFormError('');
    askQuestion(
      pendingQuestion,
      'contractsBusiness',
      null,
      contractIntakeData
    );
  };

  const cancelIntake = () => {
    setIntakeType(null);
    setPendingQuestion('');
    setJudgmentIntakeData(EMPTY_JUDGMENT_INTAKE);
    setContractIntakeData(EMPTY_CONTRACT_INTAKE);
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      <nav className="flex justify-between items-center px-8 py-4 border-b border-slate-700">
        <h1 className="text-2xl font-bold text-white">
          ⚖️ Hukumx <span className="text-amber-400">حكمx</span>
        </h1>

        <div className="flex gap-4">
          <button className="text-slate-300 hover:text-white px-4 py-2">
            تسجيل دخول
          </button>
          <button className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-6 py-2 rounded-lg">
            ابدأ مجانًا
          </button>
        </div>
      </nav>

      <div className="flex flex-col items-center px-4 py-12">
        <h2 className="text-5xl font-bold text-white mb-4 text-center">
          Hukumx
          <br />
          <span className="text-amber-400">مساعدك القانوني الذكي</span>
        </h2>

        <p className="text-slate-300 text-xl mb-10 text-center max-w-2xl">
          افهم موقفك القانوني، صنّف حالتك، واعرف الخطوات المناسبة قبل التواصل
          مع محامٍ مختص.
        </p>

        <div className="w-full max-w-2xl space-y-4">
          <CountrySelector
            country={country}
            formError={formError}
            onSelect={(countryCode) => {
              setCountry(countryCode);
              setFormError('');
            }}
          />

          <CaseTypeSelector
            caseType={caseType}
            formError={formError}
            onSelect={(caseTypeCode) => {
              setCaseType(caseTypeCode);
              setFormError('');
            }}
          />

          <QuestionBox
            question={question}
            loading={loading}
            selectedCountry={selectedCountry}
            selectedCaseType={selectedCaseType}
            onQuestionChange={setQuestion}
            onAsk={() => askQuestion()}
          />

          <FormError message={formError} />
        </div>

        {intakeType === 'judgmentAppeal' && !loading && (
          <div
            className="w-full max-w-2xl mt-6 bg-slate-700 rounded-2xl p-6 border border-amber-500/50 shadow-xl"
            dir="rtl"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-600">
              <span className="text-amber-400 text-xl">📋</span>
              <h3 className="text-amber-400 font-bold text-lg">
                تفاصيل الاستئناف / الحكم
              </h3>
            </div>

            <p className="text-slate-300 text-sm mb-5 leading-relaxed">
              لأن سؤالك مرتبط بحكم أو مدة قانونية، نحتاج بعض التفاصيل قبل
              تقديم توجيه أدق. لا تكتب معلومات شخصية حساسة.
            </p>

            {pendingQuestion && (
              <div className="mb-5 bg-slate-800/60 border border-slate-600 rounded-xl p-4">
                <p className="text-slate-400 text-xs mb-1">السؤال:</p>
                <p className="text-slate-200 text-sm">{pendingQuestion}</p>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  نوع الحكم أو القرار <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'حكم ابتدائي',
                    'حكم استئناف',
                    'حكم تمييز',
                    'أمر قضائي',
                    'حكم تحكيم',
                    'لا أعرف',
                  ].map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setJudgmentIntakeData((p) => ({
                          ...p,
                          verdictType: type,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        judgmentIntakeData.verdictType === type
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  طريقة صدور الحكم <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {['وجاهي', 'غيابي', 'بمثابة الوجاهي', 'لا أعرف'].map(
                    (type) => (
                      <button
                        key={type}
                        onClick={() =>
                          setJudgmentIntakeData((p) => ({
                            ...p,
                            appearanceType: type,
                          }))
                        }
                        className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                          judgmentIntakeData.appearanceType === type
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                        }`}
                      >
                        {type}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل تم تبليغك بالحكم رسميًا؟{' '}
                  <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {['نعم، تم تبليغي', 'لا، لم يتم تبليغي', 'لا أعرف'].map(
                    (status) => (
                      <button
                        key={status}
                        onClick={() =>
                          setJudgmentIntakeData((p) => ({
                            ...p,
                            notificationStatus: status,
                          }))
                        }
                        className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                          judgmentIntakeData.notificationStatus === status
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                        }`}
                      >
                        {status}
                      </button>
                    )
                  )}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  تاريخ التبليغ أو تاريخ الحكم{' '}
                  <span className="text-slate-500">(اختياري)</span>
                </label>
                <input
                  type="date"
                  value={judgmentIntakeData.notificationDate}
                  onChange={(e) =>
                    setJudgmentIntakeData((p) => ({
                      ...p,
                      notificationDate: e.target.value,
                    }))
                  }
                  className="w-full bg-slate-600 text-white px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 outline-none transition-all"
                />
                {judgmentIntakeData.notificationStatus === 'نعم، تم تبليغي' &&
                  !judgmentIntakeData.notificationDate && (
                    <p className="mt-2 text-amber-300 text-sm bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 leading-relaxed">
                      ⚠️ تاريخ التبليغ مهم جدًا لحساب مدة الطعن. أدخله إن كان
                      متوفرًا.
                    </p>
                  )}
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  المحكمة أو الجهة التي أصدرت الحكم{' '}
                  <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={judgmentIntakeData.court}
                  onChange={(e) =>
                    setJudgmentIntakeData((p) => ({
                      ...p,
                      court: e.target.value,
                    }))
                  }
                  placeholder="مثال: محكمة بداية عمان، محكمة صلح إربد، لا أعرف..."
                  className="w-full bg-slate-600 text-white placeholder-slate-400 px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 outline-none transition-all text-right"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  صفتك في القضية <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'مدعي',
                    'مدعى عليه',
                    'محكوم عليه',
                    'محكوم له',
                    'مشتكي',
                    'مشتكى عليه',
                    'طرف ثالث',
                    'لا أعرف',
                  ].map((role) => (
                    <button
                      key={role}
                      onClick={() =>
                        setJudgmentIntakeData((p) => ({ ...p, role }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        judgmentIntakeData.role === role
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل يوجد تنفيذ أو تبليغ تنفيذ؟{' '}
                  <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {['نعم', 'لا', 'لا أعرف'].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setJudgmentIntakeData((p) => ({
                          ...p,
                          hasExecution: status,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        judgmentIntakeData.hasExecution === status
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل لديك نسخة من الحكم؟{' '}
                  <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {['نعم', 'لا', 'لا أعرف'].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setJudgmentIntakeData((p) => ({
                          ...p,
                          hasJudgmentCopy: status,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        judgmentIntakeData.hasJudgmentCopy === status
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  تفاصيل إضافية{' '}
                  <span className="text-slate-500">(اختياري)</span>
                </label>
                <textarea
                  value={judgmentIntakeData.details}
                  onChange={(e) =>
                    setJudgmentIntakeData((p) => ({
                      ...p,
                      details: e.target.value,
                    }))
                  }
                  placeholder="أي معلومات إضافية تساعد في تقديم توجيه أدق، بدون ذكر معلومات شخصية حساسة..."
                  rows={3}
                  className="w-full bg-slate-600 text-white placeholder-slate-400 px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 outline-none transition-all text-right resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={submitJudgmentIntake}
                  disabled={
                    !judgmentIntakeData.verdictType ||
                    !judgmentIntakeData.appearanceType ||
                    !judgmentIntakeData.notificationStatus ||
                    !judgmentIntakeData.court ||
                    !judgmentIntakeData.role ||
                    !judgmentIntakeData.hasExecution ||
                    !judgmentIntakeData.hasJudgmentCopy
                  }
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all"
                >
                  احصل على الاستشارة ⚖️
                </button>

                <button
                  onClick={cancelIntake}
                  className="px-6 bg-slate-600 hover:bg-slate-500 text-slate-300 py-3 rounded-xl transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {intakeType === 'contractsBusiness' && !loading && (
          <div
            className="w-full max-w-2xl mt-6 bg-slate-700 rounded-2xl p-6 border border-amber-500/50 shadow-xl"
            dir="rtl"
          >
            <div className="flex items-center gap-2 mb-5 pb-3 border-b border-slate-600">
              <span className="text-amber-400 text-xl">📄</span>
              <h3 className="text-amber-400 font-bold text-lg">
                تفاصيل العقد / الشركة
              </h3>
            </div>

            <p className="text-slate-300 text-sm mb-5 leading-relaxed">
              لأن سؤالك مرتبط بعقد أو شركة أو شراكة، نحتاج بعض التفاصيل قبل
              تقديم توجيه أدق. لا تكتب معلومات شخصية حساسة.
            </p>

            {pendingQuestion && (
              <div className="mb-5 bg-slate-800/60 border border-slate-600 rounded-xl p-4">
                <p className="text-slate-400 text-xs mb-1">السؤال:</p>
                <p className="text-slate-200 text-sm">{pendingQuestion}</p>
              </div>
            )}

            <div className="space-y-5">
              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  نوع العقد أو العلاقة <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'عقد خدمات',
                    'عقد شراكة',
                    'عقد توريد',
                    'عقد بيع',
                    'عقد عمل / متعاقد',
                    'اتفاقية سرية NDA',
                    'اتفاقية استثمار',
                    'عقد تطوير / برمجة / تصميم',
                    'لا أعرف',
                  ].map((type) => (
                    <button
                      key={type}
                      onClick={() =>
                        setContractIntakeData((p) => ({
                          ...p,
                          contractType: type,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        contractIntakeData.contractType === type
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  صفتك في العلاقة <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'عميل',
                    'مزود خدمة',
                    'شريك',
                    'مؤسس',
                    'مستثمر',
                    'موظف / متعاقد',
                    'بائع',
                    'مشتري',
                    'طرف في العقد',
                    'لا أعرف',
                  ].map((role) => (
                    <button
                      key={role}
                      onClick={() =>
                        setContractIntakeData((p) => ({
                          ...p,
                          userRole: role,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        contractIntakeData.userRole === role
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل يوجد عقد مكتوب؟ <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'نعم',
                    'لا',
                    'مسودة فقط',
                    'محادثات واتساب / إيميل فقط',
                    'لا أعرف',
                  ].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setContractIntakeData((p) => ({
                          ...p,
                          hasWrittenContract: status,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        contractIntakeData.hasWrittenContract === status
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل تم توقيع العقد؟ <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'نعم',
                    'لا',
                    'توقيع إلكتروني',
                    'تم الاتفاق شفهيًا',
                    'لا أعرف',
                  ].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setContractIntakeData((p) => ({
                          ...p,
                          isSigned: status,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        contractIntakeData.isSigned === status
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  ما المشكلة الرئيسية؟ <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'أريد مراجعة بند',
                    'أريد فهم المخاطر',
                    'الطرف الآخر لم يلتزم',
                    'أريد فسخ العقد',
                    'توجد مطالبة مالية',
                    'يوجد شرط جزائي',
                    'خلاف بين شركاء',
                    'أريد صياغة بند',
                    'أريد معرفة حقوقي قبل التوقيع',
                  ].map((issue) => (
                    <button
                      key={issue}
                      onClick={() =>
                        setContractIntakeData((p) => ({
                          ...p,
                          mainIssue: issue,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        contractIntakeData.mainIssue === issue
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {issue}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل توجد مبالغ مالية أو مستحقات؟
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {['نعم', 'لا', 'لا أعرف'].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setContractIntakeData((p) => ({
                          ...p,
                          hasMoney: status,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        contractIntakeData.hasMoney === status
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={contractIntakeData.moneyDetails}
                  onChange={(e) =>
                    setContractIntakeData((p) => ({
                      ...p,
                      moneyDetails: e.target.value,
                    }))
                  }
                  placeholder="مثال: 5000 دينار مستحقة من الدفعة الثانية"
                  className="w-full bg-slate-600 text-white placeholder-slate-400 px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 outline-none transition-all text-right"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل يوجد شرط جزائي أو غرامة تأخير؟
                </label>
                <div className="flex flex-wrap gap-2">
                  {['نعم', 'لا', 'لا أعرف'].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setContractIntakeData((p) => ({
                          ...p,
                          hasPenaltyClause: status,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        contractIntakeData.hasPenaltyClause === status
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل توجد مدة محددة للعقد؟
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {['نعم', 'لا', 'لا أعرف'].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setContractIntakeData((p) => ({
                          ...p,
                          hasDuration: status,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        contractIntakeData.hasDuration === status
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={contractIntakeData.durationDetails}
                  onChange={(e) =>
                    setContractIntakeData((p) => ({
                      ...p,
                      durationDetails: e.target.value,
                    }))
                  }
                  placeholder="مثال: سنة واحدة، أو ينتهي بتاريخ معين..."
                  className="w-full bg-slate-600 text-white placeholder-slate-400 px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 outline-none transition-all text-right"
                />
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل يوجد بند اختصاص أو قانون واجب التطبيق؟
                </label>
                <div className="flex flex-wrap gap-2">
                  {['نعم', 'لا', 'لا أعرف'].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setContractIntakeData((p) => ({
                          ...p,
                          hasJurisdictionClause: status,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        contractIntakeData.hasJurisdictionClause === status
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل توجد سرية أو ملكية فكرية؟
                </label>
                <div className="flex flex-wrap gap-2">
                  {['نعم', 'لا', 'لا أعرف'].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setContractIntakeData((p) => ({
                          ...p,
                          hasIpOrConfidentiality: status,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        contractIntakeData.hasIpOrConfidentiality === status
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  هل العقد قبل التوقيع أم بعد حدوث مشكلة؟{' '}
                  <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {[
                    'قبل التوقيع',
                    'بعد التوقيع',
                    'حدث خلاف بالفعل',
                    'لا أعرف',
                  ].map((stage) => (
                    <button
                      key={stage}
                      onClick={() =>
                        setContractIntakeData((p) => ({
                          ...p,
                          stage,
                        }))
                      }
                      className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                        contractIntakeData.stage === stage
                          ? 'bg-amber-500 text-black border-amber-500'
                          : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                      }`}
                    >
                      {stage}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 text-sm font-medium block mb-2">
                  تفاصيل إضافية{' '}
                  <span className="text-slate-500">(اختياري)</span>
                </label>
                <textarea
                  value={contractIntakeData.details}
                  onChange={(e) =>
                    setContractIntakeData((p) => ({
                      ...p,
                      details: e.target.value,
                    }))
                  }
                  placeholder="اشرح المشكلة باختصار دون إدخال بيانات شخصية حساسة..."
                  rows={3}
                  className="w-full bg-slate-600 text-white placeholder-slate-400 px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 outline-none transition-all text-right resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={submitContractIntake}
                  disabled={
                    !contractIntakeData.contractType ||
                    !contractIntakeData.userRole ||
                    !contractIntakeData.hasWrittenContract ||
                    !contractIntakeData.isSigned ||
                    !contractIntakeData.mainIssue ||
                    !contractIntakeData.stage
                  }
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-black font-bold py-3 rounded-xl transition-all"
                >
                  احصل على الاستشارة ⚖️
                </button>

                <button
                  onClick={cancelIntake}
                  className="px-6 bg-slate-600 hover:bg-slate-500 text-slate-300 py-3 rounded-xl transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {loading && <LoadingSkeleton />}

        <AnswerBox
          answer={answer}
          loading={loading}
          selectedCountry={selectedCountry}
          hasAnyIntakeData={hasAnyIntakeData}
          onEditDetails={editIntakeDetails}
          onStartNewQuestion={startNewQuestion}
        />

        <SuggestedQuestions
          suggestions={suggestions}
          loading={loading}
          onAskSuggestion={(suggestedQuestion) => askQuestion(suggestedQuestion)}
        />
      </div>
    </main>
  );
}
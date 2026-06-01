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
import JudgmentIntakeForm from './components/JudgmentIntakeForm';
import ContractBusinessIntakeForm from './components/ContractBusinessIntakeForm';

type SourceConfidence = 'high' | 'medium' | 'low';

type AnswerMode =
  | 'GENERAL_USER'
  | 'LAWYER'
  | 'JUDGE'
  | 'LAW_STUDENT'
  | 'BUSINESS'
  | 'GOVERNMENT';

const ANSWER_MODE_OPTIONS: {
  code: AnswerMode;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    code: 'GENERAL_USER',
    label: 'مستخدم عادي',
    icon: '👤',
    description: 'شرح بسيط وعملي بدون تعقيد.',
  },
  {
    code: 'LAWYER',
    label: 'محامٍ',
    icon: '⚖️',
    description: 'تحليل مهني وتكييف قانوني.',
  },
  {
    code: 'JUDGE',
    label: 'قاضٍ',
    icon: '👨‍⚖️',
    description: 'عرض محايد لشروط التطبيق.',
  },
  {
    code: 'LAW_STUDENT',
    label: 'طالب قانون',
    icon: '📚',
    description: 'شرح تعليمي للمفاهيم القانونية.',
  },
  {
    code: 'BUSINESS',
    label: 'شركة / رجل أعمال',
    icon: '🏢',
    description: 'تركيز على المخاطر والخطوات العملية.',
  },
  {
    code: 'GOVERNMENT',
    label: 'جهة حكومية',
    icon: '🏛️',
    description: 'تركيز على الاختصاص والإجراء.',
  },
];

export default function Home() {
  const [country, setCountry] = useState('');
  const [caseType, setCaseType] = useState('');
  const [answerMode, setAnswerMode] = useState<AnswerMode>('GENERAL_USER');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [lawyerSummary, setLawyerSummary] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [sourceNote, setSourceNote] = useState('');
  const [sourceConfidence, setSourceConfidence] = useState<
    SourceConfidence | undefined
  >(undefined);

  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceArticles, setSourceArticles] = useState<string[]>([]);
  const [primaryArticles, setPrimaryArticles] = useState<string[]>([]);
  const [relatedArticles, setRelatedArticles] = useState<string[]>([]);

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

  const resetAnswerOutput = () => {
    setAnswer('');
    setLawyerSummary('');
    setSuggestions([]);
    setSourceNote('');
    setSourceConfidence(undefined);
    setSourceTitle('');
    setSourceArticles([]);
    setPrimaryArticles([]);
    setRelatedArticles([]);
  };

  const startNewQuestion = () => {
    setCountry('');
    setCaseType('');
    setAnswerMode('GENERAL_USER');
    setQuestion('');
    resetAnswerOutput();
    setLoading(false);
    setFormError('');
    setIntakeType(null);
    setActiveAnswerIntakeType(null);
    setPendingQuestion('');
    setJudgmentIntakeData(EMPTY_JUDGMENT_INTAKE);
    setContractIntakeData(EMPTY_CONTRACT_INTAKE);
  };

  const editIntakeDetails = () => {
    resetAnswerOutput();

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
    resetAnswerOutput();
    setIntakeType(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: finalQuestion,
          country: selectedCountry?.name || 'غير محدد',
          caseType: selectedCaseType?.name || 'غير محدد',
          answerMode,
          intakeType: submittedIntakeType,
          judgmentIntakeData: judgmentData || null,
          contractIntakeData: contractData || null,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setAnswer(`> ⚠️ **${data.error || 'حدث خطأ'}**`);
        setSourceNote('لم يتم الوصول إلى مصدر قانوني بسبب خطأ تقني.');
        setSourceConfidence('low');
        setSourceTitle('');
        setSourceArticles([]);
        setPrimaryArticles([]);
        setRelatedArticles([]);
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
      setLawyerSummary(data.lawyerSummary || '');
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);

      setSourceNote(data.sourceNote || '');
      setSourceConfidence(
        data.sourceConfidence === 'high' ||
          data.sourceConfidence === 'medium' ||
          data.sourceConfidence === 'low'
          ? data.sourceConfidence
          : undefined
      );

      setSourceTitle(data.sourceTitle || '');
      setSourceArticles(
        Array.isArray(data.sourceArticles) ? data.sourceArticles : []
      );
      setPrimaryArticles(
        Array.isArray(data.primaryArticles) ? data.primaryArticles : []
      );
      setRelatedArticles(
        Array.isArray(data.relatedArticles) ? data.relatedArticles : []
      );

      setActiveAnswerIntakeType(submittedIntakeType || null);
    } catch {
      setAnswer('> ⚠️ **تعذّر الاتصال بالخادم، تحقق من اتصالك بالإنترنت**');
      setSourceNote('لم يتم الوصول إلى مصدر قانوني بسبب تعذر الاتصال بالخادم.');
      setSourceConfidence('low');
      setSourceTitle('');
      setSourceArticles([]);
      setPrimaryArticles([]);
      setRelatedArticles([]);
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
    askQuestion(pendingQuestion, 'judgmentAppeal', judgmentIntakeData, null);
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

          <section className="bg-slate-700/70 border border-slate-600 rounded-2xl p-5 text-right" dir="rtl">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-slate-100 font-bold text-lg">
                  طبيعة الإجابة
                </h3>
                <p className="text-slate-300 text-sm mt-1">
                  اختر طريقة عرض الجواب حسب صفة المستخدم.
                </p>
              </div>

              <span className="bg-amber-500 text-black text-sm font-bold rounded-full px-3 py-1">
                اختياري
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ANSWER_MODE_OPTIONS.map((option) => {
                const isSelected = answerMode === option.code;

                return (
                  <button
                    key={option.code}
                    type="button"
                    onClick={() => {
                      setAnswerMode(option.code);
                      setFormError('');
                    }}
                    className={`rounded-xl border px-4 py-3 text-right transition ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                        : 'border-slate-500 bg-slate-600/60 text-slate-100 hover:border-amber-300 hover:bg-slate-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span
                        className={`text-sm font-bold ${
                          isSelected ? 'text-black' : 'text-slate-100'
                        }`}
                      >
                        {option.label}
                      </span>
                      <span className="text-xl">{option.icon}</span>
                    </div>

                    <p
                      className={`mt-2 text-xs leading-5 ${
                        isSelected ? 'text-black/80' : 'text-slate-300'
                      }`}
                    >
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

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
          <JudgmentIntakeForm
            pendingQuestion={pendingQuestion}
            judgmentIntakeData={judgmentIntakeData}
            onChange={setJudgmentIntakeData}
            onSubmit={submitJudgmentIntake}
            onCancel={cancelIntake}
          />
        )}

        {intakeType === 'contractsBusiness' && !loading && (
          <ContractBusinessIntakeForm
            pendingQuestion={pendingQuestion}
            contractIntakeData={contractIntakeData}
            onChange={setContractIntakeData}
            onSubmit={submitContractIntake}
            onCancel={cancelIntake}
          />
        )}

        {loading && <LoadingSkeleton />}

        <AnswerBox
          answer={answer}
          lawyerSummary={lawyerSummary}
          sourceNote={sourceNote}
          sourceConfidence={sourceConfidence}
          sourceTitle={sourceTitle}
          sourceArticles={sourceArticles}
          primaryArticles={primaryArticles}
          relatedArticles={relatedArticles}
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
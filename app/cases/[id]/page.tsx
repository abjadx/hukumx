'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

type CaseDocument = {
  id: string;
  fileName: string;
  fileUrl?: string | null;
  mimeType?: string | null;
  size?: number | null;
  documentType: string;
  rawText?: string | null;
  aiSummary?: string | null;
  createdAt: string;
};

type CaseEvent = {
  id: string;
  title: string;
  description?: string | null;
  eventType: string;
  eventDate?: string | null;
  isCritical: boolean;
  createdAt: string;
};

type CaseRecommendation = {
  id: string;
  title: string;
  description: string;
  priority?: string | null;
  recommendationType?: string | null;
  isDone: boolean;
  createdAt: string;
};

type RelatedArticle = {
  articleId?: string;
  legalSourceTitle?: string;
  legalSourceSlug?: string;
  articleNumber?: string;
  reason?: string;
  confidence?: 'LOW' | 'MEDIUM' | 'HIGH' | string;
  reviewStatus?: string;
};

type ArticleDetails = {
  id: string;
  articleNumber: string;
  articleText: string;
  reviewStatus: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
  legalSource: {
    id: string;
    titleAr: string;
    titleEn?: string | null;
    slug: string;
    category?: string | null;
    country: {
      code: string;
      nameAr: string;
      nameEn: string;
    };
  };
};

type CaseAnalysis = {
  id: string;
  summary?: string | null;
  facts?: string[] | null;
  legalIssues?: string[] | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  nextSteps?: string[] | null;
  relatedArticles?: RelatedArticle[] | null;
  createdAt: string;
};

type CaseLegalMemo = {
  id?: string;
  caseId?: string;
  title: string;
  memoText: string;
  executiveSummary: string;
  keyFacts: string[];
  legalIssues: string[];
  appliedArticles: {
    sourceTitle: string;
    articleNumber: string;
    relevance: string;
  }[];
  recommendations: string[];
  missingInformation: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'unknown' | string;
  disclaimer: string;
  createdAt?: string;
  updatedAt?: string;
};

type LegalCase = {
  id: string;
  title: string;
  country: string;
  caseType: string;
  status: string;
  clientName?: string | null;
  opponentName?: string | null;
  courtName?: string | null;
  caseNumber?: string | null;
  description?: string | null;
  aiSummary?: string | null;
  riskLevel?: string | null;
  createdAt: string;
  updatedAt: string;
  documents: CaseDocument[];
  events: CaseEvent[];
  recommendations: CaseRecommendation[];
  analyses: CaseAnalysis[];
};

const tabs = [
  { value: 'overview', label: 'نظرة عامة' },
  { value: 'documents', label: 'المستندات' },
  { value: 'events', label: 'التواريخ والإجراءات' },
  { value: 'recommendations', label: 'التوصيات' },
  { value: 'analysis', label: 'التحليل' },
  { value: 'memo', label: 'المذكرة القانونية' },
];

const caseTypeOptions = [
  { value: 'CIVIL', label: 'مدني' },
  { value: 'CRIMINAL', label: 'جزائي' },
  { value: 'COMMERCIAL', label: 'تجاري' },
  { value: 'LABOR', label: 'عمالي' },
  { value: 'FAMILY', label: 'أحوال شخصية' },
  { value: 'ADMINISTRATIVE', label: 'إداري' },
  { value: 'CONTRACT', label: 'عقود' },
  { value: 'OTHER', label: 'أخرى' },
];

const statusOptions = [
  { value: 'DRAFT', label: 'مسودة' },
  { value: 'ACTIVE', label: 'نشطة' },
  { value: 'UNDER_REVIEW', label: 'قيد المراجعة' },
  { value: 'CLOSED', label: 'مغلقة' },
  { value: 'ARCHIVED', label: 'مؤرشفة' },
];

const documentTypeOptions = [
  { value: 'CLAIM', label: 'لائحة / مطالبة' },
  { value: 'CONTRACT', label: 'عقد' },
  { value: 'EVIDENCE', label: 'بينة' },
  { value: 'JUDGMENT', label: 'حكم' },
  { value: 'NOTICE', label: 'تبليغ / إخطار' },
  { value: 'POWER_OF_ATTORNEY', label: 'وكالة' },
  { value: 'EXPERT_REPORT', label: 'تقرير خبرة' },
  { value: 'OTHER', label: 'أخرى' },
];

const eventTypeOptions = [
  { value: 'HEARING', label: 'جلسة' },
  { value: 'DEADLINE', label: 'موعد نهائي' },
  { value: 'APPEAL_DEADLINE', label: 'آخر موعد استئناف' },
  { value: 'FILING_DATE', label: 'تاريخ تقديم' },
  { value: 'NOTICE_DATE', label: 'تاريخ تبليغ' },
  { value: 'JUDGMENT_DATE', label: 'تاريخ حكم' },
  { value: 'OTHER', label: 'أخرى' },
];

function formatDate(value?: string | null) {
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
    return value;
  }
}

function getCaseTypeLabel(value: string) {
  return caseTypeOptions.find((item) => item.value === value)?.label || value;
}

function getStatusLabel(value: string) {
  return statusOptions.find((item) => item.value === value)?.label || value;
}

function linesToArray(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildEventDateIso(form: {
  eventDay: string;
  eventMonth: string;
  eventYear: string;
  eventTime: string;
}) {
  const dayText = form.eventDay.trim();
  const monthText = form.eventMonth.trim();
  const yearText = form.eventYear.trim();

  if (!dayText && !monthText && !yearText) {
    return null;
  }

  if (!dayText || !monthText || !yearText) {
    throw new Error('يرجى إدخال اليوم والشهر والسنة كاملة');
  }

  const day = Number(dayText);
  const month = Number(monthText);
  const year = Number(yearText);

  if (
    !Number.isInteger(day) ||
    !Number.isInteger(month) ||
    !Number.isInteger(year) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12 ||
    year < 1900
  ) {
    throw new Error('التاريخ غير صحيح. أدخل التاريخ بصيغة يوم / شهر / سنة');
  }

  const time = form.eventTime.trim() || '12:00';
  const [hourText, minuteText] = time.split(':');

  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    throw new Error('الوقت غير صحيح');
  }

  const date = new Date(year, month - 1, day, hour, minute, 0);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error('التاريخ غير صحيح');
  }

  return date.toISOString();
}

export default function CaseDetailsPage() {
  const params = useParams<{ id: string }>();
  const caseId = params.id;

  const [legalCase, setLegalCase] = useState<LegalCase | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [articleModalOpen, setArticleModalOpen] = useState(false);
  const [articleLoading, setArticleLoading] = useState(false);
  const [articleError, setArticleError] = useState('');
  const [selectedArticle, setSelectedArticle] = useState<ArticleDetails | null>(null);
  const [articleCopied, setArticleCopied] = useState(false);
  const [caseMemo, setCaseMemo] = useState<CaseLegalMemo | null>(null);
  const [memoError, setMemoError] = useState('');
  const [memoCopied, setMemoCopied] = useState(false);

  const [caseForm, setCaseForm] = useState({
    title: '',
    country: 'JO',
    caseType: 'CIVIL',
    status: 'ACTIVE',
    clientName: '',
    opponentName: '',
    courtName: '',
    caseNumber: '',
    description: '',
  });

  const [documentForm, setDocumentForm] = useState<{
    fileName: string;
    documentType: string;
    rawText: string;
    file: File | null;
  }>({
    fileName: '',
    documentType: 'OTHER',
    rawText: '',
    file: null,
  });

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    eventType: 'HEARING',
    eventDay: '',
    eventMonth: '',
    eventYear: '',
    eventTime: '',
    isCritical: false,
  });

  const [recommendationForm, setRecommendationForm] = useState({
    title: '',
    description: '',
    priority: 'MEDIUM',
    recommendationType: 'PROCEDURAL',
  });

  const [analysisForm, setAnalysisForm] = useState({
    summary: '',
    facts: '',
    legalIssues: '',
    strengths: '',
    weaknesses: '',
    nextSteps: '',
  });

  async function loadLatestCaseMemo() {
    try {
      setMemoError('');

      const res = await fetch(`/api/cases/${caseId}/memo`, {
        method: 'GET',
        cache: 'no-store',
      });

      const json = await res.json();

      if (!res.ok || json.success === false) {
        throw new Error(json.error || 'فشل في جلب آخر مذكرة محفوظة');
      }

      const savedMemo = json.data?.memo || json.data || json.memo || null;
      setCaseMemo(savedMemo);
    } catch (err: any) {
      setCaseMemo(null);
      setMemoError(err.message || 'تعذر جلب آخر مذكرة قانونية محفوظة');
    }
  }

  async function loadCase() {
    try {
      setLoading(true);
      setError('');

      const res = await fetch(`/api/cases/${caseId}`, {
        cache: 'no-store',
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في جلب بيانات القضية');
      }

      const data: LegalCase = json.data;

      setLegalCase(data);

      setCaseForm({
        title: data.title || '',
        country: data.country || 'JO',
        caseType: data.caseType || 'CIVIL',
        status: data.status || 'ACTIVE',
        clientName: data.clientName || '',
        opponentName: data.opponentName || '',
        courtName: data.courtName || '',
        caseNumber: data.caseNumber || '',
        description: data.description || '',
      });

      await loadLatestCaseMemo();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء جلب القضية');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (caseId) {
      loadCase();
    }
  }, [caseId]);

  async function updateCase(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving('case');
      setError('');
      setSuccessMessage('');

      const res = await fetch(`/api/cases/${caseId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(caseForm),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في تعديل بيانات القضية');
      }

      setSuccessMessage('تم تعديل بيانات القضية بنجاح');
      await loadCase();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تعديل القضية');
    } finally {
      setSaving('');
    }
  }

  async function addDocument(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving('document');
      setError('');
      setSuccessMessage('');

      const formData = new FormData();

      if (documentForm.file) {
        formData.append('file', documentForm.file);
      }

      formData.append('fileName', documentForm.fileName);
      formData.append('documentType', documentForm.documentType);
      formData.append('rawText', documentForm.rawText);

      const res = await fetch(`/api/cases/${caseId}/documents`, {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في إضافة المستند');
      }

      setDocumentForm({
        fileName: '',
        documentType: 'OTHER',
        rawText: '',
        file: null,
      });

      const fileInput = document.getElementById(
        'case-document-file-input'
      ) as HTMLInputElement | null;

      if (fileInput) {
        fileInput.value = '';
      }

      setSuccessMessage('تمت إضافة المستند بنجاح');
      await loadCase();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إضافة المستند');
    } finally {
      setSaving('');
    }
  }

  async function deleteDocument(documentId: string) {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا المستند؟');
    if (!confirmed) return;

    try {
      setSaving(`delete-document-${documentId}`);
      setError('');
      setSuccessMessage('');

      const res = await fetch(`/api/cases/${caseId}/documents/${documentId}`, {
        method: 'DELETE',
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في حذف المستند');
      }

      setSuccessMessage('تم حذف المستند بنجاح');
      await loadCase();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حذف المستند');
    } finally {
      setSaving('');
    }
  }

  async function addEvent(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving('event');
      setError('');
      setSuccessMessage('');

      const payload = {
        title: eventForm.title,
        description: eventForm.description,
        eventType: eventForm.eventType,
        isCritical: eventForm.isCritical,
        eventDate: buildEventDateIso(eventForm),
      };

      const res = await fetch(`/api/cases/${caseId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في إضافة الإجراء');
      }

      setEventForm({
        title: '',
        description: '',
        eventType: 'HEARING',
        eventDay: '',
        eventMonth: '',
        eventYear: '',
        eventTime: '',
        isCritical: false,
      });

      setSuccessMessage('تمت إضافة الإجراء بنجاح');
      await loadCase();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إضافة الإجراء');
    } finally {
      setSaving('');
    }
  }

  async function deleteEvent(eventId: string) {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا الإجراء؟');
    if (!confirmed) return;

    try {
      setSaving(`delete-event-${eventId}`);
      setError('');
      setSuccessMessage('');

      const res = await fetch(`/api/cases/${caseId}/events/${eventId}`, {
        method: 'DELETE',
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في حذف الإجراء');
      }

      setSuccessMessage('تم حذف الإجراء بنجاح');
      await loadCase();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حذف الإجراء');
    } finally {
      setSaving('');
    }
  }

  async function addRecommendation(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving('recommendation');
      setError('');
      setSuccessMessage('');

      const res = await fetch(`/api/cases/${caseId}/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          ...recommendationForm,
          isDone: false,
        }),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في إضافة التوصية');
      }

      setRecommendationForm({
        title: '',
        description: '',
        priority: 'MEDIUM',
        recommendationType: 'PROCEDURAL',
      });

      setSuccessMessage('تمت إضافة التوصية بنجاح');
      await loadCase();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إضافة التوصية');
    } finally {
      setSaving('');
    }
  }

  async function deleteRecommendation(recommendationId: string) {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذه التوصية؟');
    if (!confirmed) return;

    try {
      setSaving(`delete-recommendation-${recommendationId}`);
      setError('');
      setSuccessMessage('');

      const res = await fetch(
        `/api/cases/${caseId}/recommendations/${recommendationId}`,
        {
          method: 'DELETE',
        }
      );

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في حذف التوصية');
      }

      setSuccessMessage('تم حذف التوصية بنجاح');
      await loadCase();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حذف التوصية');
    } finally {
      setSaving('');
    }
  }

  async function addAnalysis(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    try {
      setSaving('analysis');
      setError('');
      setSuccessMessage('');

      const payload = {
        summary: analysisForm.summary,
        facts: linesToArray(analysisForm.facts),
        legalIssues: linesToArray(analysisForm.legalIssues),
        strengths: linesToArray(analysisForm.strengths),
        weaknesses: linesToArray(analysisForm.weaknesses),
        nextSteps: linesToArray(analysisForm.nextSteps),
        relatedArticles: [],
      };

      const res = await fetch(`/api/cases/${caseId}/analyses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في إضافة التحليل');
      }

      setAnalysisForm({
        summary: '',
        facts: '',
        legalIssues: '',
        strengths: '',
        weaknesses: '',
        nextSteps: '',
      });

      setSuccessMessage('تمت إضافة التحليل بنجاح');
      await loadCase();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء إضافة التحليل');
    } finally {
      setSaving('');
    }
  }

  async function analyzeCaseWithAI() {
    const confirmed = window.confirm(
      'هل تريد تشغيل تحليل الذكاء الصناعي لهذه القضية؟ سيتم إنشاء تحليل جديد وقد يتم إنشاء توصيات جديدة.'
    );

    if (!confirmed) return;

    try {
      setSaving('ai-analysis');
      setError('');
      setSuccessMessage('');

      const res = await fetch(`/api/cases/${caseId}/analyze`, {
        method: 'POST',
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في تحليل القضية بالذكاء الصناعي');
      }

      if (json.data?.case) {
        setLegalCase(json.data.case);
      } else {
        await loadCase();
      }

      setSuccessMessage('تم تحليل القضية بالذكاء الصناعي بنجاح');
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحليل القضية بالذكاء الصناعي');
    } finally {
      setSaving('');
    }
  }

  async function generateCaseMemo() {
    if (!legalCase) return;

    try {
      setSaving('case-memo');
      setError('');
      setSuccessMessage('');
      setMemoError('');
      setMemoCopied(false);

      const relatedArticles: RelatedArticle[] = [];

      for (const analysis of legalCase.analyses) {
        if (Array.isArray(analysis.relatedArticles)) {
          relatedArticles.push(...analysis.relatedArticles);
        }
      }

      const linkedArticleIds = relatedArticles
        .map((article) => article.articleId)
        .filter(
          (articleId): articleId is string =>
            typeof articleId === 'string' && articleId.trim().length > 0
        );

      const payload = {
        caseData: {
          id: legalCase.id,
          title: legalCase.title,
          country: legalCase.country,
          caseType: legalCase.caseType,
          status: legalCase.status,
          clientName: legalCase.clientName,
          opponentName: legalCase.opponentName,
          courtName: legalCase.courtName,
          caseNumber: legalCase.caseNumber,
          description: legalCase.description,
          aiSummary: legalCase.aiSummary,
          riskLevel: legalCase.riskLevel,
          createdAt: legalCase.createdAt,
          updatedAt: legalCase.updatedAt,
        },
        documents: legalCase.documents.map((document) => ({
          id: document.id,
          title: document.fileName,
          fileName: document.fileName,
          documentType: document.documentType,
          text: document.rawText || document.aiSummary || '',
          createdAt: document.createdAt,
        })),
        procedures: legalCase.events.map((event) => ({
          id: event.id,
          title: event.title,
          description: event.description,
          type: event.eventType,
          date: event.eventDate,
          status: event.isCritical ? 'CRITICAL' : 'NORMAL',
          createdAt: event.createdAt,
        })),
        analysis: legalCase.analyses,
        recommendations: legalCase.recommendations,
        linkedArticles: relatedArticles.map((article) => ({
          id: article.articleId,
          sourceTitle: article.legalSourceTitle,
          legalSourceTitle: article.legalSourceTitle,
          legalSourceSlug: article.legalSourceSlug,
          articleNumber: article.articleNumber,
          reason: article.reason,
          confidence: article.confidence,
          reviewStatus: article.reviewStatus || 'approved',
        })),
        linkedArticleIds,
      };

      const res = await fetch(`/api/cases/${caseId}/memo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'فشل في توليد المذكرة القانونية');
      }

      const memo = json.memo || json.data?.memo || json.data;

      if (!memo) {
        throw new Error('لم يتم استلام مذكرة قانونية من الخادم');
      }

      setCaseMemo(memo);
      setActiveTab('memo');
      setSuccessMessage('تم توليد المذكرة القانونية الأولية بنجاح');
    } catch (err: any) {
      setMemoError(err.message || 'حدث خطأ أثناء توليد المذكرة القانونية');
    } finally {
      setSaving('');
    }
  }

  async function copyCaseMemoText() {
    if (!caseMemo?.memoText) {
      setMemoError('لا توجد مذكرة قانونية لنسخها.');
      return;
    }

    try {
      await navigator.clipboard.writeText(caseMemo.memoText);

      setMemoCopied(true);
      setSuccessMessage('تم نسخ المذكرة القانونية بنجاح');

      setTimeout(() => {
        setMemoCopied(false);
      }, 2000);
    } catch {
      setMemoError('تعذر نسخ المذكرة. يمكنك تحديد النص ونسخه يدويًا.');
    }
  }

  async function showArticleText(article: RelatedArticle) {
    setArticleCopied(false);
  const articleIdentifier = article.articleId || article.articleNumber;
  

  if (!articleIdentifier) {
    setArticleModalOpen(true);
    setSelectedArticle(null);
    setArticleError('لا يوجد معرّف أو رقم مادة يمكن استخدامه لجلب النص.');
    return;
  }

  try {
    setArticleModalOpen(true);
    setArticleLoading(true);
    setArticleError('');
    setSelectedArticle(null);

    const query = new URLSearchParams();

    if (legalCase?.country) {
      query.set('country', legalCase.country);
    }

    if (article.legalSourceSlug) {
      query.set('sourceSlug', article.legalSourceSlug);
    }

    const queryString = query.toString();
    const url = `/api/legal-articles/${encodeURIComponent(articleIdentifier)}${
      queryString ? `?${queryString}` : ''
    }`;

    const res = await fetch(url, {
      cache: 'no-store',
    });

    const json = await res.json();

    if (!json.success) {
      throw new Error(json.error || 'فشل في جلب نص المادة');
    }

    setSelectedArticle(json.data);
  } catch (err: any) {
    setArticleError(err.message || 'حدث خطأ أثناء جلب نص المادة');
  } finally {
    setArticleLoading(false);
  }
}

  async function copySelectedArticleText() {
  if (!selectedArticle?.articleText) {
    setArticleError('لا يوجد نص مادة لنسخه.');
    return;
  }

  try {
    await navigator.clipboard.writeText(selectedArticle.articleText);

    setArticleCopied(true);
    setSuccessMessage('تم نسخ نص المادة بنجاح');
    setTimeout(() => {
      setArticleCopied(false);
    }, 2000);
  } catch {
    setArticleError('تعذر نسخ نص المادة. يمكنك تحديد النص ونسخه يدويًا.');
  }
}

  async function deleteAnalysis(analysisId: string) {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا التحليل؟');
    if (!confirmed) return;

    try {
      setSaving(`delete-analysis-${analysisId}`);
      setError('');
      setSuccessMessage('');

      const res = await fetch(`/api/cases/${caseId}/analyses/${analysisId}`, {
        method: 'DELETE',
      });

      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error || 'فشل في حذف التحليل');
      }

      setSuccessMessage('تم حذف التحليل بنجاح');
      await loadCase();
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء حذف التحليل');
    } finally {
      setSaving('');
    }
  }

  if (loading) {
    return (
      <main style={styles.page} dir="rtl">
        <p style={styles.muted}>جاري تحميل القضية...</p>
      </main>
    );
  }

  if (!legalCase) {
    return (
      <main style={styles.page} dir="rtl">
        <Link href="/cases" style={styles.backLink}>
          العودة إلى القضايا
        </Link>
        <p style={styles.errorBox}>{error || 'القضية غير موجودة'}</p>
      </main>
    );
  }

  return (
    <main style={styles.page} dir="rtl">
      <section style={styles.header}>
        <div>
          <Link href="/cases" style={styles.backLink}>
            ← العودة إلى القضايا
          </Link>

          <p style={styles.badge}>ملف قضية</p>
          <h1 style={styles.title}>{legalCase.title}</h1>

          <p style={styles.subtitle}>
            {getCaseTypeLabel(legalCase.caseType)} · {legalCase.country}
            {legalCase.caseNumber ? ` · رقم القضية ${legalCase.caseNumber}` : ''}
          </p>
        </div>

        <button style={styles.refreshButton} onClick={loadCase}>
          تحديث
        </button>
      </section>

      {error && <div style={styles.errorBox}>{error}</div>}
      {successMessage && <div style={styles.successBox}>{successMessage}</div>}

      <section style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={styles.statLabel}>المستندات</span>
          <strong style={styles.statNumber}>{legalCase.documents.length}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>الإجراءات</span>
          <strong style={styles.statNumber}>{legalCase.events.length}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>التوصيات</span>
          <strong style={styles.statNumber}>{legalCase.recommendations.length}</strong>
        </div>

        <div style={styles.statCard}>
          <span style={styles.statLabel}>التحليلات</span>
          <strong style={styles.statNumber}>{legalCase.analyses.length}</strong>
        </div>
      </section>

      <section style={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            style={{
              ...styles.tabButton,
              ...(activeTab === tab.value ? styles.activeTabButton : {}),
            }}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </section>

      {activeTab === 'overview' && (
        <section style={styles.twoColumnSection}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>تعديل بيانات القضية</h2>

            <form onSubmit={updateCase} style={styles.form}>
              <label style={styles.label}>
                عنوان القضية
                <input
                  style={styles.input}
                  value={caseForm.title}
                  onChange={(e) =>
                    setCaseForm({ ...caseForm, title: e.target.value })
                  }
                />
              </label>

              <div style={styles.twoColumns}>
                <label style={styles.label}>
                  الدولة
                  <select
                    style={styles.input}
                    value={caseForm.country}
                    onChange={(e) =>
                      setCaseForm({ ...caseForm, country: e.target.value })
                    }
                  >
                    <option value="JO">الأردن</option>
                    <option value="SA">السعودية</option>
                    <option value="AE">الإمارات</option>
                    <option value="EG">مصر</option>
                    <option value="IQ">العراق</option>
                  </select>
                </label>

                <label style={styles.label}>
                  نوع القضية
                  <select
                    style={styles.input}
                    value={caseForm.caseType}
                    onChange={(e) =>
                      setCaseForm({ ...caseForm, caseType: e.target.value })
                    }
                  >
                    {caseTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={styles.twoColumns}>
                <label style={styles.label}>
                  حالة القضية
                  <select
                    style={styles.input}
                    value={caseForm.status}
                    onChange={(e) =>
                      setCaseForm({ ...caseForm, status: e.target.value })
                    }
                  >
                    {statusOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label style={styles.label}>
                  رقم القضية
                  <input
                    style={styles.input}
                    value={caseForm.caseNumber}
                    onChange={(e) =>
                      setCaseForm({ ...caseForm, caseNumber: e.target.value })
                    }
                  />
                </label>
              </div>

              <div style={styles.twoColumns}>
                <label style={styles.label}>
                  اسم الموكل
                  <input
                    style={styles.input}
                    value={caseForm.clientName}
                    onChange={(e) =>
                      setCaseForm({ ...caseForm, clientName: e.target.value })
                    }
                  />
                </label>

                <label style={styles.label}>
                  اسم الخصم
                  <input
                    style={styles.input}
                    value={caseForm.opponentName}
                    onChange={(e) =>
                      setCaseForm({ ...caseForm, opponentName: e.target.value })
                    }
                  />
                </label>
              </div>

              <label style={styles.label}>
                المحكمة
                <input
                  style={styles.input}
                  value={caseForm.courtName}
                  onChange={(e) =>
                    setCaseForm({ ...caseForm, courtName: e.target.value })
                  }
                />
              </label>

              <label style={styles.label}>
                وصف مختصر
                <textarea
                  style={styles.textarea}
                  value={caseForm.description}
                  onChange={(e) =>
                    setCaseForm({ ...caseForm, description: e.target.value })
                  }
                />
              </label>

              <button style={styles.submitButton} disabled={saving === 'case'}>
                {saving === 'case' ? 'جاري التعديل...' : 'حفظ التعديلات'}
              </button>
            </form>
          </div>

          <div style={styles.card}>
            <h2 style={styles.cardTitle}>نظرة عامة</h2>

            <div style={styles.infoGridTwo}>
              <Info label="حالة القضية" value={getStatusLabel(legalCase.status)} />
              <Info label="الدولة" value={legalCase.country} />
              <Info label="نوع القضية" value={getCaseTypeLabel(legalCase.caseType)} />
              <Info label="رقم القضية" value={legalCase.caseNumber || 'غير محدد'} />
              <Info label="اسم الموكل" value={legalCase.clientName || 'غير محدد'} />
              <Info label="اسم الخصم" value={legalCase.opponentName || 'غير محدد'} />
              <Info label="المحكمة" value={legalCase.courtName || 'غير محدد'} />
              <Info label="آخر تحديث" value={formatDate(legalCase.updatedAt)} />
              <Info label="درجة الخطورة" value={legalCase.riskLevel || 'غير محددة'} />
            </div>

            <div style={styles.textBlock}>
              <h3 style={styles.smallTitle}>الوصف</h3>
              <p>{legalCase.description || 'لا يوجد وصف مختصر لهذه القضية.'}</p>
            </div>

            {legalCase.aiSummary && (
              <div style={styles.textBlock}>
                <h3 style={styles.smallTitle}>ملخص الذكاء الصناعي</h3>
                <p>{legalCase.aiSummary}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {activeTab === 'documents' && (
        <section style={styles.twoColumnSection}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>إضافة مستند</h2>

            <form onSubmit={addDocument} style={styles.form}>
              <label style={styles.label}>
                اسم الملف
                <input
                  style={styles.input}
                  value={documentForm.fileName}
                  onChange={(e) =>
                    setDocumentForm({
                      ...documentForm,
                      fileName: e.target.value,
                    })
                  }
                  placeholder="مثال: claim.pdf"
                />
              </label>

              <label style={styles.label}>
                رفع ملف
                <input
                  id="case-document-file-input"
                  style={styles.fileInput}
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;

                    setDocumentForm({
                      ...documentForm,
                      file,
                      fileName: file?.name || documentForm.fileName,
                    });
                  }}
                />
              </label>

              <label style={styles.label}>
                نوع المستند
                <select
                  style={styles.input}
                  value={documentForm.documentType}
                  onChange={(e) =>
                    setDocumentForm({
                      ...documentForm,
                      documentType: e.target.value,
                    })
                  }
                >
                  {documentTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                النص المستخرج / نص المستند
                <textarea
                  style={styles.textarea}
                  value={documentForm.rawText}
                  onChange={(e) =>
                    setDocumentForm({
                      ...documentForm,
                      rawText: e.target.value,
                    })
                  }
                  placeholder="ضع نص المستند هنا مؤقتًا..."
                />
              </label>

              <button style={styles.submitButton} disabled={saving === 'document'}>
                {saving === 'document' ? 'جاري الحفظ...' : 'إضافة المستند'}
              </button>
            </form>
          </div>

          <ListCard title="مستندات القضية">
            {legalCase.documents.length === 0 ? (
              <p style={styles.muted}>لا توجد مستندات بعد.</p>
            ) : (
              legalCase.documents.map((doc) => (
                <ItemCard key={doc.id}>
                  <div style={styles.itemHeader}>
                    <h3 style={styles.itemTitle}>{doc.fileName}</h3>

                    <button
                      style={styles.deleteButton}
                      onClick={() => deleteDocument(doc.id)}
                      disabled={saving === `delete-document-${doc.id}`}
                    >
                      {saving === `delete-document-${doc.id}`
                        ? 'جاري الحذف...'
                        : 'حذف'}
                    </button>
                  </div>

                  <p style={styles.itemMeta}>
                    {doc.documentType}
                    {doc.size ? ` · ${(doc.size / 1024 / 1024).toFixed(2)} MB` : ''}
                  </p>

                  {doc.fileUrl && (
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.fileLink}
                    >
                      فتح الملف المرفوع
                    </a>
                  )}

                  <p style={styles.itemText}>
                    {doc.rawText || doc.aiSummary || 'لا يوجد نص محفوظ لهذا المستند.'}
                  </p>
                </ItemCard>
              ))
            )}
          </ListCard>
        </section>
      )}

      {activeTab === 'events' && (
        <section style={styles.twoColumnSection}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>إضافة تاريخ / إجراء</h2>

            <form onSubmit={addEvent} style={styles.form}>
              <label style={styles.label}>
                عنوان الإجراء
                <input
                  style={styles.input}
                  value={eventForm.title}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, title: e.target.value })
                  }
                  placeholder="مثال: جلسة أولى"
                />
              </label>

              <label style={styles.label}>
                نوع الإجراء
                <select
                  style={styles.input}
                  value={eventForm.eventType}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, eventType: e.target.value })
                  }
                >
                  {eventTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={styles.label}>
                التاريخ
                <div style={styles.dateGrid}>
                  <input
                    style={styles.input}
                    value={eventForm.eventDay}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, eventDay: e.target.value })
                    }
                    placeholder="اليوم"
                    inputMode="numeric"
                  />

                  <input
                    style={styles.input}
                    value={eventForm.eventMonth}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, eventMonth: e.target.value })
                    }
                    placeholder="الشهر"
                    inputMode="numeric"
                  />

                  <input
                    style={styles.input}
                    value={eventForm.eventYear}
                    onChange={(e) =>
                      setEventForm({ ...eventForm, eventYear: e.target.value })
                    }
                    placeholder="السنة"
                    inputMode="numeric"
                  />
                </div>
              </label>

              <label style={styles.label}>
                الوقت اختياري
                <input
                  style={styles.input}
                  type="time"
                  value={eventForm.eventTime}
                  onChange={(e) =>
                    setEventForm({ ...eventForm, eventTime: e.target.value })
                  }
                />
              </label>

              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={eventForm.isCritical}
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      isCritical: e.target.checked,
                    })
                  }
                />
                إجراء حساس / مهم
              </label>

              <label style={styles.label}>
                الوصف
                <textarea
                  style={styles.textarea}
                  value={eventForm.description}
                  onChange={(e) =>
                    setEventForm({
                      ...eventForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="تفاصيل الإجراء..."
                />
              </label>

              <button style={styles.submitButton} disabled={saving === 'event'}>
                {saving === 'event' ? 'جاري الحفظ...' : 'إضافة الإجراء'}
              </button>
            </form>
          </div>

          <ListCard title="Timeline القضية">
            {legalCase.events.length === 0 ? (
              <p style={styles.muted}>لا توجد إجراءات بعد.</p>
            ) : (
              legalCase.events.map((event) => (
                <ItemCard key={event.id}>
                  <div style={styles.itemHeader}>
                    <h3 style={styles.itemTitle}>
                      {event.title}{' '}
                      {event.isCritical && <span style={styles.dangerBadge}>مهم</span>}
                    </h3>

                    <button
                      style={styles.deleteButton}
                      onClick={() => deleteEvent(event.id)}
                      disabled={saving === `delete-event-${event.id}`}
                    >
                      {saving === `delete-event-${event.id}`
                        ? 'جاري الحذف...'
                        : 'حذف'}
                    </button>
                  </div>

                  <p style={styles.itemMeta}>
                    {event.eventType} · {formatDate(event.eventDate)}
                  </p>

                  <p style={styles.itemText}>
                    {event.description || 'لا يوجد وصف لهذا الإجراء.'}
                  </p>
                </ItemCard>
              ))
            )}
          </ListCard>
        </section>
      )}

      {activeTab === 'recommendations' && (
        <section style={styles.twoColumnSection}>
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>إضافة توصية</h2>

            <form onSubmit={addRecommendation} style={styles.form}>
              <label style={styles.label}>
                عنوان التوصية
                <input
                  style={styles.input}
                  value={recommendationForm.title}
                  onChange={(e) =>
                    setRecommendationForm({
                      ...recommendationForm,
                      title: e.target.value,
                    })
                  }
                  placeholder="مثال: مراجعة مدة الاستئناف"
                />
              </label>

              <label style={styles.label}>
                الأولوية
                <select
                  style={styles.input}
                  value={recommendationForm.priority}
                  onChange={(e) =>
                    setRecommendationForm({
                      ...recommendationForm,
                      priority: e.target.value,
                    })
                  }
                >
                  <option value="LOW">منخفضة</option>
                  <option value="MEDIUM">متوسطة</option>
                  <option value="HIGH">عالية</option>
                  <option value="URGENT">عاجلة</option>
                </select>
              </label>

              <label style={styles.label}>
                الوصف
                <textarea
                  style={styles.textarea}
                  value={recommendationForm.description}
                  onChange={(e) =>
                    setRecommendationForm({
                      ...recommendationForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="تفاصيل التوصية..."
                />
              </label>

              <button
                style={styles.submitButton}
                disabled={saving === 'recommendation'}
              >
                {saving === 'recommendation' ? 'جاري الحفظ...' : 'إضافة التوصية'}
              </button>
            </form>
          </div>

          <ListCard title="توصيات القضية">
            {legalCase.recommendations.length === 0 ? (
              <p style={styles.muted}>لا توجد توصيات بعد.</p>
            ) : (
              legalCase.recommendations.map((rec) => (
                <ItemCard key={rec.id}>
                  <div style={styles.itemHeader}>
                    <h3 style={styles.itemTitle}>{rec.title}</h3>

                    <button
                      style={styles.deleteButton}
                      onClick={() => deleteRecommendation(rec.id)}
                      disabled={saving === `delete-recommendation-${rec.id}`}
                    >
                      {saving === `delete-recommendation-${rec.id}`
                        ? 'جاري الحذف...'
                        : 'حذف'}
                    </button>
                  </div>

                  <p style={styles.itemMeta}>
                    الأولوية: {rec.priority || 'غير محددة'} ·{' '}
                    {rec.isDone ? 'منجزة' : 'غير منجزة'}
                  </p>

                  <p style={styles.itemText}>{rec.description}</p>
                </ItemCard>
              ))
            )}
          </ListCard>
        </section>
      )}

      {activeTab === 'analysis' && (
        <>
          <section style={styles.aiActionCard}>
            <div>
              <h2 style={styles.cardTitle}>تحليل القضية بالذكاء الصناعي</h2>
              <p style={styles.aiActionText}>
                يقوم النظام بقراءة بيانات القضية والمستندات والتواريخ والتوصيات الحالية،
                ثم ينشئ تحليلًا جديدًا وتوصيات تلقائية.
              </p>
            </div>

            <button
              style={styles.aiButton}
              onClick={analyzeCaseWithAI}
              disabled={saving === 'ai-analysis'}
            >
              {saving === 'ai-analysis'
                ? 'جاري تحليل القضية...'
                : 'تحليل القضية بالذكاء الصناعي'}
            </button>
          </section>

          <section style={styles.twoColumnSection}>
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>إضافة تحليل يدوي مؤقت</h2>

              <form onSubmit={addAnalysis} style={styles.form}>
                <label style={styles.label}>
                  ملخص القضية
                  <textarea
                    style={styles.textarea}
                    value={analysisForm.summary}
                    onChange={(e) =>
                      setAnalysisForm({
                        ...analysisForm,
                        summary: e.target.value,
                      })
                    }
                    placeholder="اكتب ملخصًا قانونيًا للقضية..."
                  />
                </label>

                <label style={styles.label}>
                  الوقائع - كل سطر نقطة
                  <textarea
                    style={styles.smallTextarea}
                    value={analysisForm.facts}
                    onChange={(e) =>
                      setAnalysisForm({ ...analysisForm, facts: e.target.value })
                    }
                  />
                </label>

                <label style={styles.label}>
                  المسائل القانونية - كل سطر نقطة
                  <textarea
                    style={styles.smallTextarea}
                    value={analysisForm.legalIssues}
                    onChange={(e) =>
                      setAnalysisForm({
                        ...analysisForm,
                        legalIssues: e.target.value,
                      })
                    }
                  />
                </label>

                <label style={styles.label}>
                  نقاط القوة - كل سطر نقطة
                  <textarea
                    style={styles.smallTextarea}
                    value={analysisForm.strengths}
                    onChange={(e) =>
                      setAnalysisForm({
                        ...analysisForm,
                        strengths: e.target.value,
                      })
                    }
                  />
                </label>

                <label style={styles.label}>
                  نقاط الضعف - كل سطر نقطة
                  <textarea
                    style={styles.smallTextarea}
                    value={analysisForm.weaknesses}
                    onChange={(e) =>
                      setAnalysisForm({
                        ...analysisForm,
                        weaknesses: e.target.value,
                      })
                    }
                  />
                </label>

                <label style={styles.label}>
                  الخطوات القادمة - كل سطر نقطة
                  <textarea
                    style={styles.smallTextarea}
                    value={analysisForm.nextSteps}
                    onChange={(e) =>
                      setAnalysisForm({
                        ...analysisForm,
                        nextSteps: e.target.value,
                      })
                    }
                  />
                </label>

                <button style={styles.submitButton} disabled={saving === 'analysis'}>
                  {saving === 'analysis' ? 'جاري الحفظ...' : 'إضافة التحليل'}
                </button>
              </form>
            </div>

            <ListCard title="تحليلات القضية">
              {legalCase.analyses.length === 0 ? (
                <p style={styles.muted}>لا توجد تحليلات بعد.</p>
              ) : (
                legalCase.analyses.map((analysis) => (
                  <ItemCard key={analysis.id}>
                    <div style={styles.itemHeader}>
                      <h3 style={styles.itemTitle}>
                        تحليل بتاريخ {formatDate(analysis.createdAt)}
                      </h3>

                      <button
                        style={styles.deleteButton}
                        onClick={() => deleteAnalysis(analysis.id)}
                        disabled={saving === `delete-analysis-${analysis.id}`}
                      >
                        {saving === `delete-analysis-${analysis.id}`
                          ? 'جاري الحذف...'
                          : 'حذف'}
                      </button>
                    </div>

                    <p style={styles.itemText}>
                      {analysis.summary || 'لا يوجد ملخص.'}
                    </p>

                    <RenderList title="الوقائع" items={analysis.facts} />
                    <RenderList title="المسائل القانونية" items={analysis.legalIssues} />
                    <RenderList title="نقاط القوة" items={analysis.strengths} />
                    <RenderList title="نقاط الضعف" items={analysis.weaknesses} />
                    <RenderList title="الخطوات القادمة" items={analysis.nextSteps} />
                    <RenderRelatedArticles
                      items={analysis.relatedArticles}
                      onShowArticle={showArticleText}
                    />
                  </ItemCard>
                ))
              )}
            </ListCard>
          </section>
        </>
      )}
      {activeTab === 'memo' && (
        <>
          <section style={styles.aiActionCard}>
            <div>
              <h2 style={styles.cardTitle}>توليد مذكرة قانونية أولية</h2>
              <p style={styles.aiActionText}>
                يقوم النظام ببناء مذكرة قانونية أولية اعتمادًا على بيانات القضية
                والمستندات والإجراءات والتحليل والتوصيات والمواد القانونية المعتمدة
                المرتبطة بالقضية.
              </p>
            </div>

            <button
              style={styles.aiButton}
              onClick={generateCaseMemo}
              disabled={saving === 'case-memo'}
            >
              {saving === 'case-memo'
                ? 'جاري توليد المذكرة...'
                : 'توليد مذكرة قانونية أولية'}
            </button>
          </section>

          {memoError && <div style={styles.errorBox}>{memoError}</div>}

          {!caseMemo ? (
            <section style={styles.card}>
              <h2 style={styles.cardTitle}>لا توجد مذكرة مولدة بعد</h2>
              <p style={styles.muted}>
                اضغط على زر توليد المذكرة القانونية الأولية لإنشاء مسودة مبنية
                على بيانات هذه القضية. هذه المسودة لا تغني عن مراجعة محامٍ مختص.
              </p>
            </section>
          ) : (
            <section style={styles.memoLayout}>
              <div style={styles.card}>
                <div style={styles.memoHeaderRow}>
                  <div>
                    <p style={styles.badge}>مذكرة قانونية أولية</p>
                    <h2 style={styles.cardTitle}>{caseMemo.title}</h2>
                  </div>

                  <button style={styles.copyButton} onClick={copyCaseMemoText}>
                    {memoCopied ? 'تم النسخ ✅' : 'نسخ المذكرة'}
                  </button>
                </div>

                <div style={styles.memoSummaryBox}>
                  <h3 style={styles.smallTitle}>الملخص التنفيذي</h3>
                  <p>{caseMemo.executiveSummary || 'لا يوجد ملخص تنفيذي.'}</p>
                </div>

                <div style={styles.memoMetaGrid}>
                  <Info
                    label="درجة الخطورة الأولية"
                    value={caseMemo.riskLevel || 'غير محددة'}
                  />
                  <Info
                    label="عدد المواد المستخدمة"
                    value={String(caseMemo.appliedArticles?.length || 0)}
                  />
                  <Info
                    label="عدد التوصيات"
                    value={String(caseMemo.recommendations?.length || 0)}
                  />
                  <Info
                    label="المعلومات الناقصة"
                    value={String(caseMemo.missingInformation?.length || 0)}
                  />
                </div>

                <div style={styles.memoTextBox}>{caseMemo.memoText}</div>

                <div style={styles.memoDisclaimer}>
                  {caseMemo.disclaimer ||
                    'هذه مذكرة قانونية أولية لا تغني عن مراجعة محامٍ مختص قبل اتخاذ أي إجراء.'}
                </div>
              </div>

              <div style={styles.card}>
                <h2 style={styles.cardTitle}>تفاصيل المذكرة</h2>

                <RenderList title="الوقائع الرئيسية" items={caseMemo.keyFacts} />
                <RenderList
                  title="المسائل القانونية"
                  items={caseMemo.legalIssues}
                />
                <RenderList title="التوصيات" items={caseMemo.recommendations} />
                <RenderList
                  title="المعلومات الناقصة"
                  items={caseMemo.missingInformation}
                />

                {caseMemo.appliedArticles?.length > 0 && (
                  <div style={styles.renderList}>
                    <strong>المواد القانونية المستخدمة</strong>
                    <div style={styles.list}>
                      {caseMemo.appliedArticles.map((article, index) => (
                        <div
                          key={`${article.sourceTitle}-${article.articleNumber}-${index}`}
                          style={styles.itemCard}
                        >
                          <h3 style={styles.itemTitle}>
                            {article.sourceTitle || 'مصدر قانوني غير محدد'}
                            {article.articleNumber
                              ? ` · المادة ${article.articleNumber}`
                              : ''}
                          </h3>
                          <p style={styles.itemText}>
                            {article.relevance || 'لم يتم توضيح سبب الارتباط.'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}
        </>
      )}

      {articleModalOpen && (
        <div
          onClick={() => setArticleModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            zIndex: 99999,
            direction: 'rtl',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(860px, 100%)',
              maxHeight: '84vh',
              overflowY: 'auto',
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '24px',
              padding: '26px',
              boxShadow: '0 35px 120px rgba(0,0,0,0.65)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: '18px',
                paddingBottom: '18px',
                marginBottom: '18px',
                borderBottom: '1px solid #243244',
              }}
            >
              <div>
                <span
                  style={{
                    display: 'inline-block',
                    background: 'rgba(37, 99, 235, 0.18)',
                    color: '#93c5fd',
                    border: '1px solid rgba(147, 197, 253, 0.28)',
                    padding: '6px 12px',
                    borderRadius: '999px',
                    fontSize: '13px',
                    marginBottom: '12px',
                  }}
                >
                  مادة قانونية معتمدة
                </span>

                <h2
                  style={{
                    margin: 0,
                    color: '#ffffff',
                    fontSize: '28px',
                    fontWeight: 800,
                    lineHeight: 1.4,
                  }}
                >
                  {selectedArticle
                    ? `المادة ${selectedArticle.articleNumber}`
                    : 'نص المادة القانونية'}
                </h2>

                {selectedArticle && (
                  <p
                    style={{
                      margin: '8px 0 0',
                      color: '#cbd5e1',
                      fontSize: '16px',
                      lineHeight: 1.7,
                    }}
                  >
                    {selectedArticle.legalSource.titleAr}
                  </p>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'center',
                }}
              >
                {selectedArticle?.articleText && (
                  <button
                    onClick={copySelectedArticleText}
                    style={{
                      background: '#1e293b',
                      color: '#93c5fd',
                      border: '1px solid #334155',
                      borderRadius: '12px',
                      padding: '10px 14px',
                      fontSize: '14px',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      fontWeight: 700,
                    }}
                  >
                    {articleCopied ? 'تم النسخ ✅' : 'نسخ نص المادة'}
                  </button>
                )}

                <button
                  onClick={() => setArticleModalOpen(false)}
                  style={{
                    background: 'rgba(239, 68, 68, 0.12)',
                    color: '#fecaca',
                    border: '1px solid rgba(248, 113, 113, 0.28)',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    fontSize: '14px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  إغلاق
                </button>
              </div>
            </div>

            {articleLoading ? (
              <div
                style={{
                  background: '#111827',
                  border: '1px solid #243244',
                  borderRadius: '16px',
                  padding: '18px',
                  color: '#94a3b8',
                  lineHeight: 1.8,
                }}
              >
                جاري تحميل نص المادة...
              </div>
            ) : articleError ? (
              <div style={styles.errorBox}>{articleError}</div>
            ) : selectedArticle ? (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginBottom: '18px',
                  }}
                >
                  <span
                    style={{
                      background: '#111827',
                      color: '#cbd5e1',
                      border: '1px solid #243244',
                      borderRadius: '999px',
                      padding: '8px 12px',
                      fontSize: '13px',
                    }}
                  >
                    القانون: {selectedArticle.legalSource.titleAr}
                  </span>

                  <span
                    style={{
                      background: '#111827',
                      color: '#cbd5e1',
                      border: '1px solid #243244',
                      borderRadius: '999px',
                      padding: '8px 12px',
                      fontSize: '13px',
                    }}
                  >
                    رقم المادة: {selectedArticle.articleNumber}
                  </span>

                  <span
                    style={{
                      background: '#111827',
                      color: '#cbd5e1',
                      border: '1px solid #243244',
                      borderRadius: '999px',
                      padding: '8px 12px',
                      fontSize: '13px',
                    }}
                  >
                    الدولة: {selectedArticle.legalSource.country.nameAr}
                  </span>

                  <span
                    style={{
                      background: 'rgba(34, 197, 94, 0.14)',
                      color: '#86efac',
                      border: '1px solid rgba(134, 239, 172, 0.22)',
                      borderRadius: '999px',
                      padding: '8px 12px',
                      fontSize: '13px',
                    }}
                  >
                    {selectedArticle.reviewStatus}
                  </span>
                </div>

                <div
                  style={{
                    color: '#ffffff',
                    fontSize: '18px',
                    fontWeight: 800,
                    marginBottom: '10px',
                  }}
                >
                  نص المادة
                </div>

                <div
                  style={{
                    background: '#111827',
                    border: '1px solid #243244',
                    borderRadius: '18px',
                    padding: '20px',
                    color: '#e5e7eb',
                    lineHeight: 2.15,
                    whiteSpace: 'pre-wrap',
                    fontSize: '16px',
                    textAlign: 'right',
                  }}
                >
                  {selectedArticle.articleText || 'لا يوجد نص محفوظ لهذه المادة.'}
                </div>
              </>
            ) : (
              <div
                style={{
                  background: '#111827',
                  border: '1px solid #243244',
                  borderRadius: '16px',
                  padding: '18px',
                  color: '#94a3b8',
                  lineHeight: 1.8,
                }}
              >
                لا توجد مادة محددة.
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoItem}>
      <span style={styles.infoLabel}>{label}</span>
      <strong style={styles.infoValue}>{value}</strong>
    </div>
  );
}

function ListCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>{title}</h2>
      <div style={styles.list}>{children}</div>
    </div>
  );
}

function ItemCard({ children }: { children: ReactNode }) {
  return <div style={styles.itemCard}>{children}</div>;
}

function RenderList({
  title,
  items,
}: {
  title: string;
  items?: string[] | null;
}) {
  if (!items || items.length === 0) return null;

  return (
    <div style={styles.renderList}>
      <strong>{title}</strong>
      <ul>
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function RenderRelatedArticles({
  items,
  onShowArticle,
}: {
  items?: RelatedArticle[] | null;
  onShowArticle: (article: RelatedArticle) => void;
}) {
  if (!Array.isArray(items) || items.length === 0) return null;

  return (
    <div style={styles.relatedArticlesBox}>
      <h4 style={styles.relatedArticlesTitle}>المواد القانونية المرتبطة</h4>

      <div style={styles.relatedArticlesList}>
        {items.map((article, index) => (
          <div
            key={`${article.articleId || article.articleNumber || index}`}
            style={styles.relatedArticleCard}
          >
            <div style={styles.relatedArticleHeader}>
              <strong style={styles.relatedArticleTitle}>
                {article.legalSourceTitle || 'مصدر قانوني غير محدد'}
                {article.articleNumber ? ` · المادة ${article.articleNumber}` : ''}
              </strong>

              <span style={styles.approvedBadge}>
                {article.reviewStatus || 'approved'}
              </span>
            </div>

            {article.reason && (
              <p style={styles.relatedArticleReason}>{article.reason}</p>
            )}

            <div style={styles.relatedArticleMeta}>
              <span>الثقة: {article.confidence || 'غير محددة'}</span>
              {article.legalSourceSlug && (
                <span>المصدر: {article.legalSourceSlug}</span>
              )}
            </div>

            <button
              style={styles.articleButton}
              onClick={() => onShowArticle(article)}
            >
              عرض نص المادة
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    color: '#e5e7eb',
    padding: '40px',
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '24px',
    marginBottom: '24px',
  },
  backLink: {
    display: 'inline-block',
    color: '#93c5fd',
    textDecoration: 'none',
    marginBottom: '16px',
  },
  badge: {
    display: 'inline-block',
    background: 'rgba(37, 99, 235, 0.18)',
    color: '#93c5fd',
    border: '1px solid rgba(147, 197, 253, 0.28)',
    padding: '6px 12px',
    borderRadius: '999px',
    fontSize: '13px',
    marginBottom: '12px',
  },
  title: {
    margin: 0,
    fontSize: '34px',
    fontWeight: 800,
    color: '#ffffff',
  },
  subtitle: {
    marginTop: '10px',
    color: '#94a3b8',
    fontSize: '16px',
  },
  refreshButton: {
    background: '#1e293b',
    color: '#e5e7eb',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '11px 18px',
    cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '14px',
    marginBottom: '22px',
  },
  statCard: {
    background: '#111827',
    border: '1px solid #243244',
    borderRadius: '16px',
    padding: '18px',
  },
  statLabel: {
    color: '#94a3b8',
    display: 'block',
    marginBottom: '8px',
  },
  statNumber: {
    fontSize: '28px',
    color: '#ffffff',
  },
  tabs: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '22px',
  },
  tabButton: {
    background: '#111827',
    color: '#cbd5e1',
    border: '1px solid #243244',
    borderRadius: '999px',
    padding: '10px 16px',
    cursor: 'pointer',
  },
  activeTabButton: {
    background: '#2563eb',
    color: '#ffffff',
    border: '1px solid #2563eb',
  },
  aiActionCard: {
    background: '#111827',
    border: '1px solid #243244',
    borderRadius: '20px',
    padding: '24px',
    marginBottom: '22px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  aiActionText: {
    color: '#94a3b8',
    lineHeight: 1.8,
    margin: 0,
    maxWidth: '760px',
  },
  aiButton: {
    background: '#7c3aed',
    color: '#ffffff',
    border: '1px solid #8b5cf6',
    borderRadius: '14px',
    padding: '13px 18px',
    fontSize: '15px',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  memoLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 430px',
    gap: '24px',
    alignItems: 'start',
  },
  memoHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '18px',
    marginBottom: '18px',
  },
  memoSummaryBox: {
    background: '#0f172a',
    border: '1px solid #243244',
    borderRadius: '16px',
    padding: '18px',
    color: '#cbd5e1',
    lineHeight: 1.8,
    marginBottom: '18px',
  },
  memoMetaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
    marginBottom: '18px',
  },
  memoTextBox: {
    background: '#0f172a',
    border: '1px solid #243244',
    borderRadius: '18px',
    padding: '22px',
    color: '#e5e7eb',
    lineHeight: 2.1,
    whiteSpace: 'pre-wrap',
    fontSize: '16px',
    textAlign: 'right',
  },
  memoDisclaimer: {
    marginTop: '16px',
    background: 'rgba(245, 158, 11, 0.12)',
    color: '#fde68a',
    border: '1px solid rgba(251, 191, 36, 0.22)',
    borderRadius: '14px',
    padding: '14px 16px',
    lineHeight: 1.8,
    fontSize: '14px',
  },
  copyButton: {
    background: '#1e293b',
    color: '#93c5fd',
    border: '1px solid #334155',
    borderRadius: '12px',
    padding: '10px 14px',
    fontSize: '14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: 700,
  },
  twoColumnSection: {
    display: 'grid',
    gridTemplateColumns: '430px 1fr',
    gap: '24px',
    alignItems: 'start',
  },
  card: {
    background: '#111827',
    border: '1px solid #243244',
    borderRadius: '20px',
    padding: '24px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
  },
  cardTitle: {
    margin: 0,
    marginBottom: '18px',
    fontSize: '22px',
    color: '#ffffff',
  },
  twoColumns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
  },
  infoGridTwo: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '14px',
  },
  infoItem: {
    background: '#0f172a',
    border: '1px solid #243244',
    borderRadius: '14px',
    padding: '14px',
  },
  infoLabel: {
    color: '#94a3b8',
    display: 'block',
    marginBottom: '8px',
    fontSize: '13px',
  },
  infoValue: {
    color: '#ffffff',
    fontSize: '15px',
  },
  textBlock: {
    marginTop: '20px',
    background: '#0f172a',
    border: '1px solid #243244',
    borderRadius: '14px',
    padding: '16px',
    color: '#cbd5e1',
    lineHeight: 1.8,
  },
  smallTitle: {
    margin: '0 0 8px',
    color: '#ffffff',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    color: '#cbd5e1',
    fontSize: '14px',
  },
  input: {
    background: '#0f172a',
    border: '1px solid #334155',
    color: '#f8fafc',
    borderRadius: '12px',
    padding: '12px 13px',
    outline: 'none',
    fontSize: '14px',
  },
  textarea: {
    background: '#0f172a',
    border: '1px solid #334155',
    color: '#f8fafc',
    borderRadius: '12px',
    padding: '12px 13px',
    outline: 'none',
    fontSize: '14px',
    minHeight: '120px',
    resize: 'vertical',
  },
  smallTextarea: {
    background: '#0f172a',
    border: '1px solid #334155',
    color: '#f8fafc',
    borderRadius: '12px',
    padding: '12px 13px',
    outline: 'none',
    fontSize: '14px',
    minHeight: '70px',
    resize: 'vertical',
  },
  dateGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '10px',
  },
  fileInput: {
    background: '#0f172a',
    border: '1px solid #334155',
    color: '#f8fafc',
    borderRadius: '12px',
    padding: '12px 13px',
    outline: 'none',
    fontSize: '14px',
  },
  fileLink: {
    display: 'inline-block',
    marginTop: '10px',
    color: '#93c5fd',
    textDecoration: 'none',
    fontSize: '14px',
    fontWeight: 700,
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#cbd5e1',
  },
  submitButton: {
    marginTop: '8px',
    background: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '12px',
    padding: '13px 18px',
    fontSize: '15px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  itemCard: {
    background: '#0f172a',
    border: '1px solid #243244',
    borderRadius: '16px',
    padding: '16px',
  },
  itemHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  itemTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: '17px',
  },
  itemMeta: {
    margin: '8px 0 0',
    color: '#93c5fd',
    fontSize: '13px',
  },
  itemText: {
    margin: '10px 0 0',
    color: '#cbd5e1',
    lineHeight: 1.7,
    fontSize: '14px',
  },
  dangerBadge: {
    background: 'rgba(239, 68, 68, 0.14)',
    color: '#fecaca',
    border: '1px solid rgba(248, 113, 113, 0.25)',
    borderRadius: '999px',
    padding: '3px 8px',
    fontSize: '12px',
  },
  deleteButton: {
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#fecaca',
    border: '1px solid rgba(248, 113, 113, 0.28)',
    borderRadius: '10px',
    padding: '7px 12px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  renderList: {
    marginTop: '12px',
    color: '#cbd5e1',
    lineHeight: 1.8,
  },
  muted: {
    color: '#94a3b8',
  },
  errorBox: {
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#fecaca',
    border: '1px solid rgba(248, 113, 113, 0.25)',
    borderRadius: '14px',
    padding: '12px 16px',
    marginBottom: '18px',
  },
  successBox: {
    background: 'rgba(34, 197, 94, 0.12)',
    color: '#bbf7d0',
    border: '1px solid rgba(74, 222, 128, 0.25)',
    borderRadius: '14px',
    padding: '12px 16px',
    marginBottom: '18px',
  },
  relatedArticlesBox: {
  marginTop: '16px',
  background: '#111827',
  border: '1px solid #243244',
  borderRadius: '16px',
  padding: '16px',
},

relatedArticlesTitle: {
  margin: '0 0 12px',
  color: '#ffffff',
  fontSize: '16px',
},

relatedArticlesList: {
  display: 'flex',
  flexDirection: 'column',
  gap: '10px',
},

relatedArticleCard: {
  background: '#0b1120',
  border: '1px solid #243244',
  borderRadius: '14px',
  padding: '14px',
},

relatedArticleHeader: {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: '12px',
},

relatedArticleTitle: {
  color: '#e5e7eb',
  fontSize: '14px',
},

approvedBadge: {
  background: 'rgba(34, 197, 94, 0.14)',
  color: '#86efac',
  border: '1px solid rgba(134, 239, 172, 0.22)',
  borderRadius: '999px',
  padding: '4px 9px',
  fontSize: '12px',
  whiteSpace: 'nowrap',
},

relatedArticleReason: {
  margin: '10px 0 0',
  color: '#cbd5e1',
  lineHeight: 1.7,
  fontSize: '14px',
},

relatedArticleMeta: {
  display: 'flex',
  gap: '10px',
  flexWrap: 'wrap',
  marginTop: '10px',
  color: '#94a3b8',
  fontSize: '12px',
},

articleButton: {
  marginTop: '12px',
  background: '#1e293b',
  color: '#93c5fd',
  border: '1px solid #334155',
  borderRadius: '10px',
  padding: '9px 12px',
  fontSize: '13px',
  fontWeight: 700,
  cursor: 'pointer',
},

modalOverlay: {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2, 6, 23, 0.86)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px',
  zIndex: 1000,
},

modalCard: {
  width: 'min(860px, 100%)',
  maxHeight: '84vh',
  overflowY: 'auto',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: '24px',
  padding: '26px',
  boxShadow: '0 35px 120px rgba(0,0,0,0.6)',
},

modalHeader: {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: '18px',
  paddingBottom: '18px',
  marginBottom: '18px',
  borderBottom: '1px solid #243244',
},

modalBadge: {
  display: 'inline-block',
  background: 'rgba(37, 99, 235, 0.18)',
  color: '#93c5fd',
  border: '1px solid rgba(147, 197, 253, 0.28)',
  padding: '6px 12px',
  borderRadius: '999px',
  fontSize: '13px',
  marginBottom: '12px',
},

modalTitle: {
  margin: 0,
  color: '#ffffff',
  fontSize: '28px',
  fontWeight: 800,
  lineHeight: 1.4,
},

modalSubtitle: {
  margin: '8px 0 0',
  color: '#cbd5e1',
  fontSize: '16px',
  lineHeight: 1.7,
},

closeButton: {
  background: 'rgba(239, 68, 68, 0.12)',
  color: '#fecaca',
  border: '1px solid rgba(248, 113, 113, 0.28)',
  borderRadius: '12px',
  padding: '10px 14px',
  fontSize: '14px',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
},

articleMetaRow: {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '10px',
  marginBottom: '18px',
},

articleMetaPill: {
  background: '#111827',
  color: '#cbd5e1',
  border: '1px solid #243244',
  borderRadius: '999px',
  padding: '8px 12px',
  fontSize: '13px',
},

articleTextHeader: {
  color: '#ffffff',
  fontSize: '18px',
  fontWeight: 800,
  marginBottom: '10px',
},

articleTextBox: {
  background: '#111827',
  border: '1px solid #243244',
  borderRadius: '18px',
  padding: '20px',
  color: '#e5e7eb',
  lineHeight: 2.15,
  whiteSpace: 'pre-wrap',
  fontSize: '16px',
  textAlign: 'right',
},

modalMessage: {
  background: '#111827',
  border: '1px solid #243244',
  borderRadius: '16px',
  padding: '18px',
  color: '#94a3b8',
  lineHeight: 1.8,
},
};
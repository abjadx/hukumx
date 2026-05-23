# Frontend Structure

## الهدف من هذا التوثيق

هذا الملف يشرح تنظيم واجهة Hukumx بعد عملية الـ refactor، حتى يكون تطوير المسارات القادمة أسهل وأكثر أمانًا.

---

## الهيكل الحالي

```txt
app/
  page.tsx

  api/
    chat/
      route.ts

  components/
    CountrySelector.tsx
    CaseTypeSelector.tsx
    QuestionBox.tsx
    FormError.tsx
    LoadingSkeleton.tsx
    AnswerBox.tsx
    SuggestedQuestions.tsx
    JudgmentIntakeForm.tsx
    ContractBusinessIntakeForm.tsx

  data/
    legal-options.ts

  types/
    legal.ts
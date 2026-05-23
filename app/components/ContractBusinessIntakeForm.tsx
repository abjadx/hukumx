'use client';

import { ContractIntakeData } from '../types/legal';

type ContractBusinessIntakeFormProps = {
  pendingQuestion: string;
  contractIntakeData: ContractIntakeData;
  onChange: (data: ContractIntakeData) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function ContractBusinessIntakeForm({
  pendingQuestion,
  contractIntakeData,
  onChange,
  onSubmit,
  onCancel,
}: ContractBusinessIntakeFormProps) {
  const updateField = (field: keyof ContractIntakeData, value: string) => {
    onChange({
      ...contractIntakeData,
      [field]: value,
    });
  };

  return (
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
        لأن سؤالك مرتبط بعقد أو شركة أو شراكة، نحتاج بعض التفاصيل قبل تقديم
        توجيه أدق. لا تكتب معلومات شخصية حساسة.
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
                onClick={() => updateField('contractType', type)}
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
                onClick={() => updateField('userRole', role)}
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
                onClick={() => updateField('hasWrittenContract', status)}
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
                onClick={() => updateField('isSigned', status)}
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
                onClick={() => updateField('mainIssue', issue)}
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
                onClick={() => updateField('hasMoney', status)}
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
            onChange={(e) => updateField('moneyDetails', e.target.value)}
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
                onClick={() => updateField('hasPenaltyClause', status)}
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
                onClick={() => updateField('hasDuration', status)}
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
            onChange={(e) => updateField('durationDetails', e.target.value)}
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
                onClick={() => updateField('hasJurisdictionClause', status)}
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
                onClick={() => updateField('hasIpOrConfidentiality', status)}
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
            {['قبل التوقيع', 'بعد التوقيع', 'حدث خلاف بالفعل', 'لا أعرف'].map(
              (stage) => (
                <button
                  key={stage}
                  onClick={() => updateField('stage', stage)}
                  className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                    contractIntakeData.stage === stage
                      ? 'bg-amber-500 text-black border-amber-500'
                      : 'bg-slate-600 text-slate-300 border-slate-500 hover:border-amber-400'
                  }`}
                >
                  {stage}
                </button>
              )
            )}
          </div>
        </div>

        <div>
          <label className="text-slate-300 text-sm font-medium block mb-2">
            تفاصيل إضافية <span className="text-slate-500">(اختياري)</span>
          </label>

          <textarea
            value={contractIntakeData.details}
            onChange={(e) => updateField('details', e.target.value)}
            placeholder="اشرح المشكلة باختصار دون إدخال بيانات شخصية حساسة..."
            rows={3}
            className="w-full bg-slate-600 text-white placeholder-slate-400 px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 outline-none transition-all text-right resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onSubmit}
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
            onClick={onCancel}
            className="px-6 bg-slate-600 hover:bg-slate-500 text-slate-300 py-3 rounded-xl transition-all"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
}
'use client';

import { JudgmentIntakeData } from '../types/legal';

type JudgmentIntakeFormProps = {
  pendingQuestion: string;
  judgmentIntakeData: JudgmentIntakeData;
  onChange: (data: JudgmentIntakeData) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

export default function JudgmentIntakeForm({
  pendingQuestion,
  judgmentIntakeData,
  onChange,
  onSubmit,
  onCancel,
}: JudgmentIntakeFormProps) {
  const updateField = (field: keyof JudgmentIntakeData, value: string) => {
    onChange({
      ...judgmentIntakeData,
      [field]: value,
    });
  };

  return (
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
        لأن سؤالك مرتبط بحكم أو مدة قانونية، نحتاج بعض التفاصيل قبل تقديم توجيه
        أدق. لا تكتب معلومات شخصية حساسة.
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
                onClick={() => updateField('verdictType', type)}
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
            {['وجاهي', 'غيابي', 'بمثابة الوجاهي', 'لا أعرف'].map((type) => (
              <button
                key={type}
                onClick={() => updateField('appearanceType', type)}
                className={`px-4 py-2 rounded-xl text-sm border transition-all ${
                  judgmentIntakeData.appearanceType === type
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
            هل تم تبليغك بالحكم رسميًا؟{' '}
            <span className="text-red-400">*</span>
          </label>

          <div className="flex flex-wrap gap-2">
            {['نعم، تم تبليغي', 'لا، لم يتم تبليغي', 'لا أعرف'].map(
              (status) => (
                <button
                  key={status}
                  onClick={() => updateField('notificationStatus', status)}
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
            onChange={(e) => updateField('notificationDate', e.target.value)}
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
            onChange={(e) => updateField('court', e.target.value)}
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
                onClick={() => updateField('role', role)}
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
                onClick={() => updateField('hasExecution', status)}
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
            هل لديك نسخة من الحكم؟ <span className="text-red-400">*</span>
          </label>

          <div className="flex flex-wrap gap-2">
            {['نعم', 'لا', 'لا أعرف'].map((status) => (
              <button
                key={status}
                onClick={() => updateField('hasJudgmentCopy', status)}
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
            تفاصيل إضافية <span className="text-slate-500">(اختياري)</span>
          </label>

          <textarea
            value={judgmentIntakeData.details}
            onChange={(e) => updateField('details', e.target.value)}
            placeholder="أي معلومات إضافية تساعد في تقديم توجيه أدق، بدون ذكر معلومات شخصية حساسة..."
            rows={3}
            className="w-full bg-slate-600 text-white placeholder-slate-400 px-4 py-3 rounded-xl border border-slate-500 focus:border-amber-400 outline-none transition-all text-right resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onSubmit}
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
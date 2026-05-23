export default function LoadingSkeleton() {
  return (
    <div className="w-full max-w-2xl mt-6 bg-slate-700 rounded-2xl p-6 animate-pulse">
      <div className="h-4 bg-slate-600 rounded w-3/4 ml-auto mb-3" />
      <div className="h-4 bg-slate-600 rounded w-full mb-3" />
      <div className="h-4 bg-slate-600 rounded w-5/6 ml-auto mb-3" />
      <div className="h-4 bg-slate-600 rounded w-4/5 ml-auto" />
    </div>
  );
}
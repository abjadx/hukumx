type FormErrorProps = {
  message: string;
};

export default function FormError({ message }: FormErrorProps) {
  if (!message) return null;

  return (
    <div dir="rtl">
      <p className="text-red-400 text-sm text-right bg-red-400/10 border border-red-400/30 px-4 py-3 rounded-xl">
        ⚠️ {message}
      </p>
    </div>
  );
}
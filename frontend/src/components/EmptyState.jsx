import { SearchX, AlertCircle } from 'lucide-react';

export default function EmptyState({
  message = 'No data matches the selected filters.',
  title,
  icon: Icon = SearchX,
  isNotAvailable = false
}) {
  const DisplayIcon = isNotAvailable ? AlertCircle : Icon;

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 px-4 text-center card bg-white">
      <div className={`p-3 rounded-full ${isNotAvailable ? 'bg-amber-50 text-amber-500' : 'bg-gray-50 text-gray-400'}`}>
        <DisplayIcon size={26} />
      </div>
      {title && <h3 className="text-[14px] font-semibold text-gray-800">{title}</h3>}
      <p className="text-[13px] text-gray-500 max-w-sm leading-relaxed">{message}</p>
    </div>
  );
}

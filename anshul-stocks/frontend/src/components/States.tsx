import { AlertCircle, Inbox, Loader2 } from 'lucide-react';

interface LoadingProps {
  rows?: number;
}

export function TableSkeleton({ rows = 5 }: LoadingProps) {
  return (
    <div className="w-full space-y-4 py-4 animate-pulse">
      <div className="h-10 bg-[#111827] border border-[#1F2937] rounded-lg w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 items-center">
          <div className="h-12 bg-[#111827] border border-[#1F2937] rounded-lg flex-1" />
          <div className="h-12 bg-[#111827] border border-[#1F2937] rounded-lg w-24 hidden md:block" />
          <div className="h-12 bg-[#111827] border border-[#1F2937] rounded-lg w-32 hidden sm:block" />
          <div className="h-12 bg-[#111827] border border-[#1F2937] rounded-lg w-20" />
        </div>
      ))}
    </div>
  );
}

interface EmptyProps {
  title?: string;
  message?: string;
}

export function EmptyState({ 
  title = 'No Records Found', 
  message = 'We couldn\'t find any records matching your criteria. Try adjusting your filters or query.' 
}: EmptyProps) {
  return (
    <div className="w-full text-center py-16 px-4 bg-[#111827] border border-[#1F2937] rounded-xl shadow-lg">
      <Inbox size={48} className="text-gray-400 mx-auto mb-4" />
      <h4 className="text-lg font-bold text-white mb-1">{title}</h4>
      <p className="text-gray-300 text-sm max-w-sm mx-auto leading-relaxed">{message}</p>
    </div>
  );
}

interface ErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  title = 'Something Went Wrong', 
  message = 'An error occurred while fetching information from the server. Please check your connection and try again.',
  onRetry
}: ErrorProps) {
  return (
    <div className="w-full text-center py-12 px-6 bg-[#111827] border border-red-500/30 rounded-xl shadow-lg">
      <AlertCircle size={48} className="text-red-500 mx-auto mb-4" />
      <h4 className="text-lg font-bold text-white mb-1">{title}</h4>
      <p className="text-gray-300 text-sm max-w-md mx-auto leading-relaxed mb-6">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="btn-primary py-2 px-5 text-sm gap-2">
          <Loader2 size={16} className="animate-spin hidden" id="retry-spinner" />
          Try Again
        </button>
      )}
    </div>
  );
}

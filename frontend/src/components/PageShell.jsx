import { useOutletContext } from 'react-router-dom';
import PageHeader from './Header';
import FilterBar from './FilterBar';

export default function PageShell({ title, subtitle, showFilters = true, onRefresh, children }) {
  const ctx = useOutletContext();

  return (
    <div className="min-h-full flex flex-col">
      <PageHeader
        title={title}
        subtitle={subtitle}
        onToggleSidebar={ctx?.onToggleSidebar}
        onOpenCommandPalette={ctx?.onOpenCommandPalette}
        onRefresh={onRefresh}
      />
      {showFilters && <FilterBar />}
      <main className="flex-1 p-4 md:p-6 space-y-5 max-w-[1600px] w-full mx-auto animate-fade-in">
        {children}
      </main>
    </div>
  );
}

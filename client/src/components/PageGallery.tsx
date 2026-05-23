import type { PageData } from '../types';

interface Props {
  documentName: string;
  pages: PageData[];
  onRemovePage: (pageId: string) => void;
  onClose: () => void;
}

export default function PageGallery({ documentName, pages, onRemovePage, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200">
        <h2 className="font-semibold text-gray-900">{documentName} — {pages.length} page{pages.length !== 1 ? 's' : ''}</h2>
        <button onClick={onClose} className="btn-ghost">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>

      {/* Pages grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {pages.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm">
            No pages scanned yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {pages.map((page, i) => (
              <div key={page.id} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm">
                <img
                  src={page.dataUrl}
                  alt={`Page ${i + 1}`}
                  className="w-full aspect-[3/4] object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                <div className="absolute top-2 left-2 bg-black/50 text-white text-xs font-medium px-2 py-0.5 rounded-full">
                  Page {i + 1}
                </div>
                <button
                  onClick={() => onRemovePage(page.id)}
                  className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  title="Remove page"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

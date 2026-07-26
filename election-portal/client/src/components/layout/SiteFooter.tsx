/**
 * Site footer — sticks to the bottom on short pages; follows content on long pages (scroll to see).
 */
export function SiteFooter() {
  return (
    <footer className="hidden shrink-0 w-full border-t border-gray-100 py-6 text-center text-xs text-gray-400 sm:block">
      <div className="flex items-center justify-center gap-1.5 flex-wrap">
        <span>Powered by</span>
        <a
          href="https://d4dx.co"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
        >
          D4DX.CO
          <img
            src="/d4dx-logo.png"
            alt="D4DX"
            className="h-5 w-auto object-contain"
          />
        </a>
      </div>
    </footer>
  );
}

export const D4DX_URL = "https://d4dx.co";
export const D4DX_LOGO_SRC = "/d4dx-logo.png";

/**
 * Shared D4DX branding for every page that uses MainLayout or VoterLayout
 * (and any other screen that renders this footer).
 *
 * Mobile (< lg): stacked “Powered by D4DX” + logo, in document flow above BottomNav.
 * Desktop (lg+): existing inline footer. Sidebar keeps its own desktop brand tag.
 *
 * NEW MOBILE PAGE → include MainLayout / VoterLayout so this branding appears automatically.
 */
export function SiteFooter() {
  return (
    <footer className="app-helper shrink-0 w-full border-t border-gray-100 py-4 text-center lg:py-6">
      <a
        href={D4DX_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col items-center gap-1.5 lg:hidden"
        title="Powered by D4DX"
      >
        <span>Powered by D4DX</span>
        <img src={D4DX_LOGO_SRC} alt="D4DX" className="h-5 w-auto object-contain" />
      </a>

      <div className="hidden items-center justify-center gap-1.5 flex-wrap lg:flex">
        <span>Powered by</span>
        <a
          href={D4DX_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 font-semibold text-primary hover:underline"
        >
          D4DX.CO
          <img src={D4DX_LOGO_SRC} alt="D4DX" className="h-5 w-auto object-contain" />
        </a>
      </div>
    </footer>
  );
}

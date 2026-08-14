/** Self-contained ballot-box illustration in the Vote+ brand colors — no external image asset. */
export function BallotIllustration({ className = "h-40 w-40" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="100" cy="100" r="96" fill="white" fillOpacity="0.08" />
      {/* Ballot box */}
      <rect x="42" y="92" width="116" height="76" rx="10" fill="white" fillOpacity="0.16" />
      <rect x="42" y="92" width="116" height="76" rx="10" stroke="white" strokeOpacity="0.55" strokeWidth="2.5" />
      <rect x="34" y="82" width="132" height="20" rx="6" fill="white" fillOpacity="0.22" stroke="white" strokeOpacity="0.6" strokeWidth="2.5" />
      <rect x="86" y="88" width="28" height="8" rx="4" fill="white" fillOpacity="0.5" />
      {/* Slot */}
      <rect x="88" y="90" width="24" height="4" rx="2" fill="#0a2463" />
      {/* Ballot paper dropping in with a check mark */}
      <g transform="rotate(-8 100 58)">
        <rect x="76" y="30" width="48" height="58" rx="6" fill="white" fillOpacity="0.95" />
        <rect x="76" y="30" width="48" height="58" rx="6" stroke="white" strokeOpacity="0.9" strokeWidth="2" />
        <circle cx="100" cy="58" r="12" fill="none" stroke="#e11d48" strokeWidth="2.5" />
        <path d="M94 58l4 4 8-8" stroke="#e11d48" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      {/* Sparkle accents */}
      <circle cx="152" cy="56" r="4" fill="white" fillOpacity="0.6" />
      <circle cx="46" cy="66" r="3" fill="white" fillOpacity="0.5" />
      <circle cx="160" cy="110" r="3" fill="white" fillOpacity="0.45" />
    </svg>
  );
}

/** Muted variant for light card backgrounds (empty states, not-found panels). */
export function BallotIllustrationMuted({ className = "h-28 w-28" }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <circle cx="100" cy="100" r="96" className="fill-primary/5" />
      <rect x="42" y="92" width="116" height="76" rx="10" className="fill-primary/5 stroke-primary/25" strokeWidth="2.5" />
      <rect x="34" y="82" width="132" height="20" rx="6" className="fill-primary/10 stroke-primary/30" strokeWidth="2.5" />
      <rect x="88" y="90" width="24" height="4" rx="2" className="fill-primary/40" />
      <g transform="rotate(-8 100 58)">
        <rect x="76" y="30" width="48" height="58" rx="6" className="fill-white stroke-primary/20" strokeWidth="2" />
        <circle cx="100" cy="58" r="12" fill="none" className="stroke-primary/50" strokeWidth="2.5" />
        <path d="M94 58l4 4 8-8" className="stroke-primary/60" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

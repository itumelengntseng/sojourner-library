"use client";

// "Print → Save as PDF" for the pitch sheet. Hidden on paper itself.
export function PrintSheetButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded-sm border border-lamplight/60 px-3 py-1 font-sans text-xs text-lamplight hover:bg-lamplight/10"
    >
      Print or save as PDF
    </button>
  );
}

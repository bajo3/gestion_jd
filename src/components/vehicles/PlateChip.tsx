export function PlateChip({ plate }: { plate: string }) {
  if (!plate.trim()) {
    return <span className="text-xs text-slate-400">Sin patente</span>;
  }

  return (
    <span className="inline-flex items-center rounded-md border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs font-semibold tracking-wider text-slate-700">
      {plate}
    </span>
  );
}

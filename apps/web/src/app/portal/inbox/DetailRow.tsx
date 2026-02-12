export default function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      {icon && <div className="flex-shrink-0">{icon}</div>}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-[13px] text-slate-800 font-medium break-words truncate">{value || "\u2014"}</div>
      </div>
    </div>
  );
}

import { p } from "@/styles/theme";

type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  badge?: string;
};

export default function PageHeader({ title, subtitle, action, badge }: Props) {
  return (
    <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className={p.h1}>{title}</h1>
          {badge && (
            <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-600">
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className={`${p.body} mt-1.5 max-w-xl`}>{subtitle}</p>}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

"use client";

interface TestimonialCardProps {
  quote: string;
  author: string;
  role: string;
  company?: string;
  avatarUrl?: string;
}

export default function TestimonialCard({
  quote,
  author,
  role,
  company,
  avatarUrl,
}: TestimonialCardProps) {
  return (
    <div className="relative bg-white rounded-2xl border border-slate-200/80 p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgba(75,69,255,0.08)] transition-all duration-300 hover:-translate-y-0.5">
      {/* Quote mark */}
      <div className="absolute -top-3 left-6 w-8 h-8 rounded-full bg-[#0F5C5C] flex items-center justify-center">
        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10H14.017zM0 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151C7.546 6.068 5.983 8.789 5.983 11H10v10H0z" />
        </svg>
      </div>

      {/* Quote text */}
      <p className="text-[#0D0D12] text-base leading-relaxed mt-3 mb-6">
        &ldquo;{quote}&rdquo;
      </p>

      {/* Author */}
      <div className="flex items-center gap-3">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={author}
            className="w-10 h-10 rounded-full object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0F5C5C] to-[#1E88A8] flex items-center justify-center text-white text-sm font-bold">
            {author.charAt(0)}
          </div>
        )}
        <div>
          <p className="text-sm font-semibold text-[#0D0D12]">{author}</p>
          <p className="text-xs text-[#8E8EA0]">
            {role}
            {company && <span> · {company}</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

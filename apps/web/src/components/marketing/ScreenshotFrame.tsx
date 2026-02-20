"use client";

interface ScreenshotFrameProps {
  src: string;
  alt: string;
  /** Optional caption below the screenshot */
  caption?: string;
  /** Dark background behind the frame */
  dark?: boolean;
  className?: string;
}

export default function ScreenshotFrame({
  src,
  alt,
  caption,
  dark = false,
  className = "",
}: ScreenshotFrameProps) {
  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Browser-style frame */}
      <div
        className={`w-full max-w-5xl rounded-2xl overflow-hidden border shadow-[0_8px_40px_rgba(0,0,0,0.12)] ${
          dark
            ? "border-slate-700/60 bg-[#13131A]"
            : "border-slate-200/80 bg-white"
        }`}
      >
        {/* Title bar */}
        <div
          className={`flex items-center gap-2 px-4 py-3 border-b ${
            dark ? "border-slate-700/60 bg-[#0D0D12]" : "border-slate-100 bg-[#F7F8FA]"
          }`}
        >
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
            <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
            <span className="w-3 h-3 rounded-full bg-[#28C840]" />
          </div>
          <div
            className={`flex-1 mx-8 h-6 rounded-md ${
              dark ? "bg-slate-800" : "bg-slate-100"
            }`}
          />
        </div>

        {/* Screenshot */}
        <img
          src={src}
          alt={alt}
          className="w-full h-auto block"
          loading="lazy"
        />
      </div>

      {/* Caption */}
      {caption && (
        <p
          className={`mt-4 text-sm text-center ${
            dark ? "text-slate-500" : "text-[#8E8EA0]"
          }`}
        >
          {caption}
        </p>
      )}
    </div>
  );
}

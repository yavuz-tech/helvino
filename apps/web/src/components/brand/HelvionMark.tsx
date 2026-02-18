"use client";

export default function HelvionMark({
  height = 56,
  variant = "dark",
  className = "",
}: {
  height?: number;
  variant?: "dark" | "light";
  className?: string;
}) {
  const iconW = (42 / 48) * height;
  const wordSize = Math.round(height * 0.64);
  const textColor = variant === "light" ? "#FEFDFB" : "#0C0A09";
  const dotColor = variant === "light" ? "#FBBF24" : "#F59E0B";

  return (
    <span
      className={`inline-flex items-center justify-center whitespace-nowrap ${className}`}
      style={{ gap: 10 }}
      aria-label="Helvion"
    >
      <svg
        width={iconW}
        height={height}
        viewBox="0 0 42 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
        style={{ display: "block" }}
      >
        <path
          d="M3.6 19.2C3.6 12.572 8.972 7.2 15.6 7.2H20.4C27.028 7.2 32.4 12.572 32.4 19.2V21.6C32.4 28.228 27.028 33.6 20.4 33.6H16.8L9.6 39V33.6C6.3 31.5 3.6 27.6 3.6 24V19.2Z"
          fill="#FBBF24"
        />
        <path
          d="M20.4 19.2C20.4 13.898 24.698 9.6 30 9.6H32.4C37.702 9.6 42 13.898 42 19.2V21.6C42 26.902 37.702 31.2 32.4 31.2H30L25.2 34.8V31.32C22.56 29.76 20.4 26.7 20.4 24V19.2Z"
          fill="#D97706"
        />
      </svg>
      <span
        style={{
          fontFamily: "Manrope, system-ui, -apple-system, sans-serif",
          fontSize: wordSize,
          fontWeight: 900,
          letterSpacing: "-0.03em",
          color: textColor,
          lineHeight: 1,
        }}
      >
        Helvion<span style={{ color: dotColor }}>.</span>
      </span>
    </span>
  );
}


import { p } from "@/styles/theme";

type Props = {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  noPadding?: boolean;
};

export default function Card({
  children,
  className = "",
  hover = true,
  noPadding = false,
}: Props) {
  return (
    <div
      className={[
        p.card,
        hover ? p.cardHover : "",
        noPadding ? "" : p.cardPadding,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

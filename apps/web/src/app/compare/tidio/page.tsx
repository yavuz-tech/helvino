import ComparePageContent from "../ComparePageContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Helvion vs Tidio | Compare",
  description: "A practical comparison of Helvion and Tidio focused on fit, rollout, and operations.",
};

export default function CompareTidioPage() {
  return <ComparePageContent competitorKey="tidio" />;
}

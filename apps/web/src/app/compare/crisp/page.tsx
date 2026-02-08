import ComparePageContent from "../ComparePageContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Helvion vs Crisp | Compare",
  description: "A practical comparison of Helvion and Crisp focused on fit, rollout, and operations.",
};

export default function CompareCrispPage() {
  return <ComparePageContent competitorKey="crisp" />;
}

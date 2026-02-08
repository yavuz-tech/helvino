import ComparePageContent from "../ComparePageContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Helvino vs Crisp | Compare",
  description: "A practical comparison of Helvino and Crisp focused on fit, rollout, and operations.",
};

export default function CompareCrispPage() {
  return <ComparePageContent competitorKey="crisp" />;
}

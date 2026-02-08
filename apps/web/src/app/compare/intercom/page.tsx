import ComparePageContent from "../ComparePageContent";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Helvion vs Intercom | Compare",
  description: "A practical comparison of Helvion and Intercom focused on fit, rollout, and operations.",
};

export default function CompareIntercomPage() {
  return (
    <ComparePageContent competitorKey="intercom" />
  );
}

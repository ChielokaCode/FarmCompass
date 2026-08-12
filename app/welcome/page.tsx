import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/users";
import OnboardingTour from "@/components/OnboardingTour";

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ replay?: string }> }) {
  const user = await requireUser("FARMER");
  const params = await searchParams;
  const replay = params.replay === "1";
  if (!replay && await hasCompletedOnboarding(user.id)) redirect("/dashboard");
  return <OnboardingTour firstName={user.name.split(" ")[0] || "Farmer"} replay={replay}/>;
}

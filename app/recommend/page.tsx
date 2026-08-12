import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/users";
import RecommendationClient from "@/components/RecommendationClient";
import AppIcon from "@/components/AppIcon";

export default async function RecommendPage() {
  const user = await requireUser("FARMER");
  if (!(await hasCompletedOnboarding(user.id))) redirect("/welcome");
  return <main className="fc-mobile-page">
    <div className="fc-page-kicker"><AppIcon name="compass" className="h-4 w-4"/> Personalised recommendation</div>
    <h1 className="mt-2 text-[31px] font-black leading-[1.06] tracking-[-.045em]">What fits your farm?</h1>
    <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">FarmCompass compares the farm details you entered with the structured crop knowledge base and ranks the strongest matches.</p>
    <div className="mt-6"><RecommendationClient/></div>
  </main>;
}

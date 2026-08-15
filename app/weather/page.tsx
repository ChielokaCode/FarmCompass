import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/users";
import WeatherClient from "@/components/WeatherClient";
import AppIcon from "@/components/AppIcon";

export default async function WeatherPage() {
  const user = await requireUser("FARMER");
  if (!(await hasCompletedOnboarding(user.id))) redirect("/welcome");
  return <main className="fc-mobile-page">
    <div className="fc-page-kicker"><AppIcon name="sun" className="h-4 w-4"/> Farm weather</div>
    <h1 className="mt-2 text-[31px] font-black tracking-[-.045em]">Climate & weather</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">Use long-term climate to improve crop suitability matching, and the short-term forecast to plan weather-sensitive farm activities.</p>
    <div className="mt-6"><WeatherClient/></div>
  </main>;
}

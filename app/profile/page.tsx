import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/users";
import FarmProfileClient from "@/components/FarmProfileClient";
import AppIcon from "@/components/AppIcon";

export default async function ProfilePage() {
  const user = await requireUser("FARMER");
  if (!(await hasCompletedOnboarding(user.id))) redirect("/welcome");
  return <main className="fc-mobile-page">
    <div className="fc-page-kicker"><AppIcon name="farm" className="h-4 w-4"/> My farm</div>
    <h1 className="mt-2 text-[31px] font-black tracking-[-.045em]">Farm profile</h1>
    <p className="mt-3 text-sm leading-6 text-slate-600">Add and update the farm details FarmCompass should use when it recommends crops for you.</p>
    <div className="mt-6"><FarmProfileClient email={user.email}/></div>
  </main>;
}

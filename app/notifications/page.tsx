import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/users";
import NotificationsClient from "@/components/NotificationsClient";
import AppIcon from "@/components/AppIcon";

export default async function NotificationsPage() {
  const user = await requireUser("FARMER");
  if (!(await hasCompletedOnboarding(user.id))) redirect("/welcome");
  return <main className="fc-mobile-page">
    <div className="fc-page-kicker"><AppIcon name="bell" className="h-4 w-4"/> Notifications</div>
    <h1 className="mt-2 text-[31px] font-black leading-[1.06] tracking-[-.045em]">Task alerts</h1>
    <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">These are in-app accountability alerts for unfinished farm tasks. They are refreshed while FarmCompass is open.</p>
    <div className="mt-6"><NotificationsClient/></div>
  </main>;
}

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/users";
import TasksClient from "@/components/TasksClient";
import AppIcon from "@/components/AppIcon";

export default async function TasksPage() {
  const user = await requireUser("FARMER");
  if (!(await hasCompletedOnboarding(user.id))) redirect("/welcome");
  return <main className="fc-mobile-page">
    <div className="fc-page-kicker"><AppIcon name="tasks" className="h-4 w-4"/> Farm tasks</div>
    <h1 className="mt-2 text-[31px] font-black leading-[1.06] tracking-[-.045em]">What needs to be done?</h1>
    <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">FarmCompass turns your selected crop guidance into a dated task plan, tracks completion and flags unfinished tasks after their daily completion window.</p>
    <div className="mt-6"><TasksClient/></div>
  </main>;
}

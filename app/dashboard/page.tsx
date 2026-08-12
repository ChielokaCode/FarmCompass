import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/users";
import HomeDashboardClient from "@/components/HomeDashboardClient";

export default async function Dashboard() {
  const user = await requireUser("FARMER");
  if (!(await hasCompletedOnboarding(user.id))) redirect("/welcome");
  return <main className="fc-mobile-page">
    <section className="fc-app-hero">
      <div className="relative z-10"><div className="text-sm font-bold text-emerald-100">Good to see you,</div><h1 className="mt-1 text-[30px] font-black tracking-[-.04em]">{user.name.split(" ")[0]}</h1><p className="mt-3 max-w-md text-sm leading-6 text-emerald-50">Keep your farm details current, then use them to make more informed crop decisions.</p></div>
    </section>
    <div className="mt-6"><HomeDashboardClient/></div>
  </main>;
}

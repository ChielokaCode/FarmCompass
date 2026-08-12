import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { hasCompletedOnboarding } from "@/lib/users";
import AssistantClient from "@/components/AssistantClient";
import AppIcon from "@/components/AppIcon";

export default async function AssistantPage({ searchParams }:{ searchParams:Promise<{crop?:string}> }) {
  const user = await requireUser("FARMER");
  if (!(await hasCompletedOnboarding(user.id))) redirect("/welcome");
  const p = await searchParams;
  return <main className="fc-mobile-page"><div className="fc-page-kicker"><AppIcon name="sparkles" className="h-4 w-4"/> AI-assisted explanation</div><h1 className="mt-2 text-[31px] font-black tracking-[-.045em]">Ask FarmCompass</h1><p className="mt-3 text-sm leading-6 text-slate-600">The assistant explains retrieved farm and crop information. It does not replace the rule-based suitability score.</p><div className="mt-6"><AssistantClient initialCrop={p.crop}/></div></main>;
}

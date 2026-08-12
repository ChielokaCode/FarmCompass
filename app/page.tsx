import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import AppIcon from "@/components/AppIcon";

export default async function HomePage() {
  const user = await getSessionUser();
  if (user?.role === "ADMIN") redirect("/admin");
  if (user?.role === "FARMER") redirect("/dashboard");

  return <main className="fc-public-page">
    <section className="pt-5">
      <div className="fc-app-hero px-6 py-8">
        <div className="relative z-10">
          <span className="inline-flex rounded-full bg-white/13 px-3 py-1 text-[11px] font-black uppercase tracking-[.12em]">For Nigerian farmers</span>
          <h1 className="mt-5 max-w-md text-[39px] font-black leading-[1.02] tracking-[-.05em]">Know what fits your farm before you plant.</h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-emerald-50">Personalised crop recommendations, practical crop guidance and AI-assisted explanations in one mobile-first experience.</p>
          <div className="mt-7 grid gap-3"><Link href="/register" className="fc-btn bg-white text-emerald-800">Create farmer account <AppIcon name="arrowRight"/></Link><Link href="/login" className="fc-btn border border-white/25 bg-white/10 text-white">I already have an account</Link></div>
        </div>
      </div>
    </section>

    <section className="mt-8">
      <div className="flex items-end justify-between"><div><div className="fc-page-kicker">FarmCompass essentials</div><h2 className="mt-2 text-2xl font-black tracking-[-.035em]">Everything starts with your farm.</h2></div></div>
      <div className="mt-4 space-y-3">
        {[
          ["farm", "Your farm profile", "Add and update your State, LGA, farm size, soil information, water context and farming plan yourself."],
          ["compass", "Personalised crop matches", "Compare suitable crops using State, soil, pH, water, season and other farm factors you provide."],
          ["book", "34 crop guides", "Open practical guidance on varieties, planting, fertiliser, pests, irrigation, harvest and storage."],
          ["sparkles", "FarmCompass Assistant", "Ask follow-up questions or add a crop photo for an explanation grounded in FarmCompass records."]
        ].map(([icon,title,text]) => <div key={title} className="fc-card-flat flex gap-4 p-4"><div className="fc-quick-icon"><AppIcon name={icon as any}/></div><div><h3 className="font-extrabold">{title}</h3><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div></div>)}
      </div>
      <Link href="/crops" className="mt-5 flex items-center justify-center gap-2 py-3 text-sm font-extrabold text-emerald-800">Browse the crop library <AppIcon name="arrowRight" className="h-4 w-4"/></Link>
    </section>
  </main>;
}

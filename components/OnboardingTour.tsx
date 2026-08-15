"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppIcon, { AppIconName } from "@/components/AppIcon";

const slides: { icon: AppIconName; title: string; text: string; note: string }[] = [
  {
    icon: "farm",
    title: "Set up your own farm profile",
    text: "Add your State, LGA, farm size, water context and farming goal. If you have a measured soil result you can add it, but you do not need to guess pH.",
    note: "Unknown values can be left blank. With farm GPS, FarmCompass can request location-based soil pH and other soil context automatically."
  },
  {
    icon: "sun",
    title: "Use your farm location for climate, weather and soil",
    text: "Capture the farm location once. FarmCompass can calculate long-term rainfall and temperature, show a 7-day weather forecast, and request Kaegro soil information for the same coordinates.",
    note: "Location-based soil and climate data improve context without asking you to guess values. They remain estimates and do not replace a laboratory soil test."
  },
  {
    icon: "compass",
    title: "See crops that fit your farm",
    text: "FarmCompass compares your farm details with the crop knowledge base and ranks suitable crops using the information that is actually available.",
    note: "Suitability scores help compare crops; they are not a yield guarantee."
  },
  {
    icon: "book",
    title: "Open practical crop guidance",
    text: "For each crop, check varieties, planting periods, soil needs, fertiliser guidance, pests and diseases, irrigation, field practices, harvesting and storage.",
    note: "The crop library remains useful even when you are not generating a recommendation."
  },
  {
    icon: "sparkles",
    title: "Ask FarmCompass when you need an explanation",
    text: "Ask follow-up questions in simple English or add a crop photo for an AI-assisted explanation grounded in your farm profile and FarmCompass crop records.",
    note: "Image responses describe possible causes and uncertainty; they are not laboratory diagnosis."
  }
];

export default function OnboardingTour({ firstName, replay = false }: { firstName: string; replay?: boolean }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const touchStart = useRef<number | null>(null);
  const slide = slides[index];

  async function finish() {
    setBusy(true);
    const res = await fetch("/api/onboarding/complete", { method: "POST" });
    setBusy(false);
    if (res.ok) {
      router.replace(replay ? "/dashboard" : "/profile?setup=1");
      router.refresh();
    }
  }

  function next() {
    if (index < slides.length - 1) setIndex(i => i + 1);
    else void finish();
  }

  return <main className="fc-public-page fc-onboarding-shell">
    <div className="flex items-center justify-between py-1">
      <div><div className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Welcome to FarmCompass</div><div className="mt-1 text-sm text-slate-500">A quick tour for {firstName}</div></div>
      <button onClick={finish} disabled={busy} className="fc-btn-ghost text-sm font-extrabold">Skip</button>
    </div>

    <div
      className="mt-5 flex flex-1 flex-col"
      onTouchStart={e => { touchStart.current = e.changedTouches[0]?.clientX ?? null; }}
      onTouchEnd={e => {
        if (touchStart.current == null) return;
        const delta = (e.changedTouches[0]?.clientX ?? touchStart.current) - touchStart.current;
        if (delta < -45 && index < slides.length - 1) setIndex(i => i + 1);
        if (delta > 45 && index > 0) setIndex(i => i - 1);
        touchStart.current = null;
      }}
    >
      <section className="fc-onboarding-art">
        <div className="fc-onboarding-icon"><AppIcon name={slide.icon} className="h-14 w-14"/></div>
      </section>

      <div className="px-1 pt-7 text-center">
        <div className="fc-tour-dots" aria-label={`Step ${index + 1} of ${slides.length}`}>{slides.map((_, i) => <span key={i} className={`fc-tour-dot ${i === index ? "is-active" : ""}`}/>)}</div>
        <h1 className="mx-auto mt-6 max-w-md text-[30px] font-black leading-[1.08] tracking-[-.04em]">{slide.title}</h1>
        <p className="mx-auto mt-4 max-w-md text-[15px] leading-7 text-slate-600">{slide.text}</p>
        <div className="mx-auto mt-5 max-w-md rounded-2xl bg-emerald-50 px-4 py-3 text-left text-sm leading-6 text-emerald-950"><b>Good to know:</b> {slide.note}</div>
      </div>

      <div className="mt-auto grid grid-cols-[auto_1fr] gap-3 pt-7">
        {index > 0 ? <button onClick={() => setIndex(i => i - 1)} className="fc-btn fc-btn-secondary px-4" aria-label="Previous step"><AppIcon name="arrowLeft"/></button> : <span/>}
        <button onClick={next} disabled={busy} className="fc-btn fc-btn-primary w-full">{busy ? "Opening FarmCompass…" : index === slides.length - 1 ? (replay ? "Back to home" : "Set up my farm") : "Next"}<AppIcon name="arrowRight"/></button>
      </div>
    </div>
  </main>;
}

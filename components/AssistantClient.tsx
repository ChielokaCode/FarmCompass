"use client";
import { FormEvent, useEffect, useRef, useState } from "react";
import AppIcon from "@/components/AppIcon";

type Crop = { slug:string; name:string };
export default function AssistantClient({ initialCrop }: { initialCrop?:string }) {
  const [crops,setCrops] = useState<Crop[]>([]);
  const [question,setQuestion] = useState("");
  const [answer,setAnswer] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName,setFileName] = useState("");

  useEffect(()=>{ fetch("/api/crops").then(r=>r.json()).then(d=>setCrops(d.crops||[])); },[]);

  async function submit(e:FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setError(""); setAnswer("");
    const fd = new FormData(e.currentTarget);
    const q = String(fd.get("question")||"");
    setQuestion(q);
    const r = await fetch("/api/ai",{method:"POST",body:fd});
    const d = await r.json();
    setBusy(false);
    if(!r.ok){setError(d.error||"Unable to answer");return;}
    setAnswer(d.answer);
  }

  return <div className="space-y-4">
    <section className="fc-chat-window gap-3">
      <div className="fc-chat-bubble assistant"><div className="flex items-center gap-2 font-black text-emerald-800"><AppIcon name="sparkles" className="h-4 w-4"/> FarmCompass Assistant</div><p className="mt-2 text-slate-600">Ask me to explain a recommendation, crop guidance, fertiliser timing, planting information, or a crop image. I use the farm details you saved and retrieved FarmCompass crop records.</p></div>
      {question && <div className="fc-chat-bubble user">{question}{fileName && <div className="mt-2 text-xs text-emerald-100">Image attached: {fileName}</div>}</div>}
      {busy && <div className="fc-chat-bubble assistant"><span className="inline-flex items-center gap-2 text-slate-500"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600"/> Checking FarmCompass records…</span></div>}
      {answer && <div className="fc-chat-bubble assistant fc-prose">{answer}</div>}
      {error && <div className="rounded-2xl bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div>}
    </section>

    <form onSubmit={submit} className="fc-chat-composer">
      <div className="grid gap-2 sm:grid-cols-[180px_1fr]"><select name="cropSlug" defaultValue={initialCrop||""} className="fc-input !min-h-11 !py-2 text-sm"><option value="">General farm question</option>{crops.map(c=><option key={c.slug} value={c.slug}>{c.name}</option>)}</select><textarea name="question" value={question} onChange={e=>setQuestion(e.target.value)} required rows={2} className="fc-input resize-none !min-h-[60px]" placeholder="Ask FarmCompass…"/></div>
      <div className="mt-2 flex items-center gap-2">
        <input ref={fileRef} onChange={e=>setFileName(e.target.files?.[0]?.name||"")} name="image" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden"/>
        <button type="button" onClick={()=>fileRef.current?.click()} className="fc-btn fc-btn-secondary !min-h-11 !px-3 !py-2 text-sm" aria-label="Attach crop image"><AppIcon name="camera"/>{fileName?"Image added":"Add image"}</button>
        <button disabled={busy} className="fc-btn fc-btn-primary ml-auto !min-h-11 !px-4 !py-2 text-sm">Send <AppIcon name="arrowRight" className="h-4 w-4"/></button>
      </div>
      <p className="mt-2 px-1 text-[10px] leading-4 text-slate-400">Crop-image explanations are assistive and may be uncertain. For chemicals, follow current registration, label and PPE requirements.</p>
    </form>
  </div>;
}

import { listCrops } from "@/lib/crops";
import CropLibraryClient from "@/components/CropLibraryClient";
import AppIcon from "@/components/AppIcon";

export const metadata = { title: "Crop Library" };
export default async function CropsPage() {
  const crops = await listCrops();
  const safe = crops.map(c => ({ slug:c.slug, name:c.name, scientificName:c.scientificName, category:c.category, pH:c.pH, suitableStates:c.suitableStates }));
  return <main className="fc-mobile-page">
    <div className="fc-page-kicker"><AppIcon name="leaf" className="h-4 w-4"/> Knowledge base</div>
    <h1 className="mt-2 text-[31px] font-black tracking-[-.045em]">Crop Library</h1>
    <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">Browse the 34 structured Nigerian crop profiles used by the FarmCompass recommendation engine.</p>
    <div className="mt-4"><CropLibraryClient crops={safe}/></div>
  </main>;
}

import seedData from "../data/crops.seed.json";
import { rankCrops } from "../lib/recommendation";
import type { CropRecord, FarmProfile } from "../types";

const cases:any[][]=[
  ["Ogun","Sandy loam",6.0,"rainfed","food crop","April","cassava"],
  ["Oyo","Loam",6.5,"rainfed","food crop","March","maize"],
  ["Kano","Sandy soil",6.5,"rainfed","short duration","July","millet"],
  ["Kaduna","Loam",6.5,"rainfed","food crop","July","sorghum"]
];

let failed=0;
for(const [state,soil,pH,irrigation,goal,month,expected] of cases){
  const profile={userId:"test",state,lga:"Test LGA",soilType:soil,pH,irrigation,farmingGoal:goal,plantingMonth:month,updatedBy:"FARMER",createdAt:new Date(),updatedAt:new Date()} as FarmProfile;
  const top=rankCrops(profile,seedData as CropRecord[],3);
  console.log(state,"=>",top.map(x=>`${x.crop.name} ${x.score}`).join(" | "));
  if(top[0]?.crop.slug!==expected){failed++;console.error("Expected",expected,"but got",top[0]?.crop.slug)}
}
if(failed)process.exit(1);
console.log("Recommendation validation passed.");

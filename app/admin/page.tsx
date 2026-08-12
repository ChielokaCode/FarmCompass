import { requireUser } from "@/lib/auth";
import AdminClient from "@/components/AdminClient";

export default async function Admin() {
  const user = await requireUser("ADMIN");
  return <main className="fc-container py-10">
    <span className="fc-badge">Administrator workspace</span>
    <h1 className="mt-3 text-4xl font-black">Farmer profile overview</h1>
    <p className="mt-2 max-w-3xl text-slate-600">View farmer accounts and the farm profiles farmers have entered. Farm profiles are read-only here, and farmer recommendations are not available to administrators. Signed in as {user.name}.</p>
    <div className="mt-8"><AdminClient/></div>
  </main>;
}

"use client";
import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();
  return <button className="text-sm font-bold text-slate-600 hover:text-slate-900" onClick={async()=>{ await fetch('/api/auth/logout',{method:'POST'}); router.push('/'); router.refresh(); }}>Sign out</button>;
}

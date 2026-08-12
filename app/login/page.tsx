import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import AppIcon from "@/components/AppIcon";

export default function Login() {
  return <main className="fc-public-page pt-8">
    <div className="mx-auto max-w-md">
      <div className="grid h-14 w-14 place-items-center rounded-[20px] bg-emerald-700 text-white shadow-lg"><AppIcon name="compass" className="h-7 w-7"/></div>
      <h1 className="mt-6 text-[34px] font-black tracking-[-.045em]">Welcome back</h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">Sign in to open your farm profile, recommendations and FarmCompass Assistant.</p>
      <div className="fc-card mt-7 p-5 sm:p-6"><AuthForm mode="login"/></div>
      <p className="mt-6 text-center text-sm text-slate-600">New to FarmCompass? <Link className="font-extrabold text-emerald-700" href="/register">Create an account</Link></p>
    </div>
  </main>;
}

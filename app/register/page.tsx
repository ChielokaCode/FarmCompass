import Link from "next/link";
import AuthForm from "@/components/AuthForm";
import AppIcon from "@/components/AppIcon";

export default function Register() {
  return <main className="fc-public-page pt-8">
    <div className="mx-auto max-w-md">
      <div className="grid h-14 w-14 place-items-center rounded-[20px] bg-emerald-700 text-white shadow-lg"><AppIcon name="user" className="h-7 w-7"/></div>
      <h1 className="mt-6 text-[34px] font-black leading-[1.05] tracking-[-.045em]">Create your farmer account</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">After registration, FarmCompass will show you a short app tour and then help you add your own farm details before you request a personalised crop recommendation.</p>
      <div className="fc-card mt-7 p-5 sm:p-6"><AuthForm mode="register"/></div>
      <p className="mt-6 text-center text-sm text-slate-600">Already registered? <Link className="font-extrabold text-emerald-700" href="/login">Sign in</Link></p>
    </div>
  </main>;
}

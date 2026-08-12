export type AppIconName =
  | "home"
  | "leaf"
  | "compass"
  | "sparkles"
  | "farm"
  | "user"
  | "check"
  | "camera"
  | "book"
  | "arrowRight"
  | "arrowLeft"
  | "shield"
  | "mapPin"
  | "droplet"
  | "flask"
  | "sun"
  | "clock"
  | "search"
  | "eye";

export default function AppIcon({ name, className = "h-5 w-5" }: { name: AppIconName; className?: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<AppIconName, React.ReactNode> = {
    home: <><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9.5 20v-6h5v6"/></>,
    leaf: <><path d="M20 4c-7.5 0-13 3.5-13 9 0 3.2 2.4 5.5 5.7 5.5C18.4 18.5 20 12.3 20 4Z"/><path d="M4 20c2.8-5.8 6.7-9.1 12-11"/></>,
    compass: <><circle cx="12" cy="12" r="9"/><path d="m15.4 8.6-2.1 4.7-4.7 2.1 2.1-4.7 4.7-2.1Z"/></>,
    sparkles: <><path d="m12 3 1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3Z"/><path d="m18.5 14 .9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1Z"/><path d="m5 13 .8 1.9 1.9.8-1.9.8L5 18.4l-.8-1.9-1.9-.8 1.9-.8L5 13Z"/></>,
    farm: <><path d="M3 20h18"/><path d="M5 20V9l7-4 7 4v11"/><path d="M8 20v-6h8v6"/><path d="M8 10h.01M16 10h.01"/></>,
    user: <><circle cx="12" cy="8" r="4"/><path d="M4 21c.9-4.4 3.6-6.5 8-6.5s7.1 2.1 8 6.5"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
    camera: <><path d="M4 7h4l1.5-2h5L16 7h4v12H4V7Z"/><circle cx="12" cy="13" r="3.5"/></>,
    book: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H11v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z"/><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H13v17h3.5A3.5 3.5 0 0 1 20 22V5.5Z"/></>,
    arrowRight: <><path d="M5 12h14"/><path d="m14 7 5 5-5 5"/></>,
    arrowLeft: <><path d="M19 12H5"/><path d="m10 7-5 5 5 5"/></>,
    shield: <><path d="M12 3 5 6v5c0 4.6 2.7 8 7 10 4.3-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>,
    mapPin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/></>,
    droplet: <path d="M12 3s6 6.1 6 11a6 6 0 0 1-12 0c0-4.9 6-11 6-11Z"/>,
    flask: <><path d="M9 3h6"/><path d="M10 3v6l-5 8.5A2.3 2.3 0 0 0 7 21h10a2.3 2.3 0 0 0 2-3.5L14 9V3"/><path d="M8 15h8"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    search: <><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></>,
    eye: <><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></>
  };
  return <svg viewBox="0 0 24 24" className={className} aria-hidden="true" {...common}>{paths[name]}</svg>;
}

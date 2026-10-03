import { redirect } from "next/navigation";

export const metadata = { title: "Accountant Center" };

export default function DashboardAccountantRedirectPage() {
  redirect("/accountant");
}

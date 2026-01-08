import { redirect } from "next/navigation";

export default function Home() {
  // Redirect to dashboard (no auth required in dev mode)
  redirect("/afe");
}

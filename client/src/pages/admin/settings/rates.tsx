import { Redirect } from "wouter";
const A = (import.meta.env.VITE_ADMIN_PATH as string) || "/admin";
export default function AdminSettingsRates() {
  return <Redirect to={`${A}/countries`} />;
}

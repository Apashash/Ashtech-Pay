import { getAdminPath } from "@/lib/adminPath";
import { Redirect } from "wouter";
const A = getAdminPath();
export default function AdminSettingsRates() {
  return <Redirect to={`${A}/countries`} />;
}

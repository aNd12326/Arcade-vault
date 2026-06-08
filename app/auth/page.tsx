import { redirect } from "next/navigation";
import { createClient } from "../_lib/supabase/server";
import AuthForm from "./AuthForm";

export default async function AuthPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/");
  return <AuthForm />;
}

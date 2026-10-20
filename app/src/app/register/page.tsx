import AuthForm from "@/components/AuthForm";
import { connection } from "next/server";
import { config } from "@/lib/config";

export default async function Register() {
  await connection();
  const inviteRequired = (await config("invites.required")) !== false;
  return <AuthForm mode="register" inviteRequired={inviteRequired} />;
}

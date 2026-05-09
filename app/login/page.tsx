import { LoginForm } from "./login-form";

// Login-Page als Server Component. Liest den optionalen redirect-Param
// von den searchParams (Server-side), uebergibt ihn als Prop an das
// Client Form. So vermeiden wir useSearchParams() im Client-Code, was
// fuer Static-Generation eine Suspense-Boundary verlangt — und vermeiden
// den extra Boundary-Hack.

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirect } = await searchParams;
  return <LoginForm redirectTo={redirect ?? ""} />;
}

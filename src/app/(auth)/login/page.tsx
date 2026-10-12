import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/inputs";
import { loginAction } from "@/modules/auth/actions";
import { getCurrentProfile } from "@/modules/auth/session";
import { homeForRole } from "@/modules/auth/roles";
import { isSupabaseConfigured } from "@/lib/supabase/env";
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const profile = await getCurrentProfile();
  if (profile) redirect(homeForRole(profile.role));
  const params = await searchParams;
  const configured = isSupabaseConfigured();
  return <>
    {!configured ? <Alert><AlertTitle>Configuración pendiente</AlertTitle>
      <AlertDescription>Configura Supabase siguiendo el README del proyecto para habilitar el acceso.</AlertDescription></Alert> : null}
    {params.password === "updated" ? <Alert><AlertDescription>Contraseña actualizada. Inicia sesión de nuevo.</AlertDescription></Alert> : null}
    <Card><CardHeader><CardTitle>Iniciar sesión</CardTitle><CardDescription>Accede con tu correo de empresa.</CardDescription></CardHeader>
      <CardContent><ActionForm action={loginAction} submitLabel="Entrar" disabled={!configured}>
        <TextField label="Correo electrónico" name="email" type="email" autoComplete="username" required maxLength={254} />
        <TextField label="Contraseña" name="password" type="password" autoComplete="current-password" required maxLength={128} />
      </ActionForm></CardContent>
      <CardFooter><Link className="text-sm underline underline-offset-4" href="/recover">Recuperar acceso o establecer mi contraseña</Link></CardFooter>
    </Card>
  </>;
}

import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/inputs";
import { recoverAction } from "@/modules/auth/actions";
import { isSupabaseConfigured } from "@/lib/supabase/env";
export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Recuperar acceso</h1>
        </CardTitle>
        <CardDescription>
          Te enviaremos un enlace para establecer una nueva contraseña.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>
                El enlace no es válido o ha caducado. Solicita uno nuevo.
              </AlertDescription>
            </Alert>
          ) : null}
          <ActionForm
            action={recoverAction}
            submitLabel="Solicitar enlace"
            disabled={!isSupabaseConfigured()}
          >
            <TextField
              label="Correo electrónico"
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
            />
          </ActionForm>
        </div>
      </CardContent>
      <CardFooter>
        <Link className="text-sm underline" href="/login">
          Volver al inicio de sesión
        </Link>
      </CardFooter>
    </Card>
  );
}

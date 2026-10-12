import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { ActionForm } from "@/components/forms/action-form";
import { TextField } from "@/components/forms/inputs";
import { updatePasswordAction } from "@/modules/auth/actions";
import { requireProfile } from "@/modules/auth/session";
export default async function UpdatePasswordPage() {
  await requireProfile();
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Establecer contraseña</h1>
        </CardTitle>
        <CardDescription>
          Usa al menos 12 caracteres. Después volverás a iniciar sesión.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ActionForm
          action={updatePasswordAction}
          submitLabel="Guardar contraseña"
        >
          <TextField
            label="Nueva contraseña"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
          <TextField
            label="Repite la contraseña"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            maxLength={128}
          />
        </ActionForm>
      </CardContent>
    </Card>
  );
}

import { z } from "zod";
export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const passwordSchema = z.object({
  password: z.string().min(12, "Usa una contraseña de al menos 12 caracteres.").max(128),
  confirmation: z.string(),
}).refine((data) => data.password === data.confirmation, "Las contraseñas no coinciden.");

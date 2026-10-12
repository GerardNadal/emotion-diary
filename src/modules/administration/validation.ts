import { z } from "zod";
import { emailSchema } from "@/modules/auth/validation";
const optionalUuid = z.union([z.uuid(), z.literal("")]).transform((value) => value || null);
export const profileSchema = z.object({
  id: optionalUuid,
  full_name: z.string().trim().min(2, "Introduce un nombre de al menos 2 caracteres.").max(100, "El nombre no puede superar 100 caracteres."),
  email: emailSchema,
  role: z.enum(["company_admin", "team_admin", "employee"]),
  team_id: optionalUuid,
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
}).refine((data) => data.role === "employee" ? data.team_id !== null : data.team_id === null,
  "Los empleados necesitan un equipo; los administradores se asignan como responsables.");
export const teamSchema = z.object({ id: optionalUuid, name: z.string().trim().min(2).max(100) });
export const managerSchema = z.object({
  team_id: z.uuid(), profile_id: z.uuid(),
  assigned: z.enum(["true", "false"]).transform((value) => value === "true"),
});

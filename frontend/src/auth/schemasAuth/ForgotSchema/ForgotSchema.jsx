import { z } from "zod";

export const forgotSchema = z.object({
  email: z
    .string()
    .min(1, "El correo electrónico es obligatorio")
    .email("El correo electrónico no es válido"),
});

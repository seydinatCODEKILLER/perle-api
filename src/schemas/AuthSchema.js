// schemas/AuthSchema.js
import { z } from "zod";

export default class AuthSchema {
  constructor() {}

  validateRegister(data) {
    const schema = z.object({
      prenom: z
        .string()
        .min(2, { message: "Le prénom doit contenir au moins 2 caractères" }),
      nom: z
        .string()
        .min(2, { message: "Le nom doit contenir au moins 2 caractères" }),
      email: z.string().email({ message: "Adresse email invalide" }),
      password: z
        .string()
        .min(8, {
          message: "Le mot de passe doit contenir au moins 8 caractères",
        })
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
          message:
            "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre",
        }),
      phone: z
        .string()
        .min(9, { message: "Le numéro de téléphone est invalide" })
        .optional(),
      avatar: z
        .string()
        .url("URL d'image invalide")
        .optional()
        .or(z.literal("").transform(() => undefined)),
    });

    this.#validateSchema(schema, data);
  }

  validateLogin(data) {
    const schema = z.object({
      email: z.string().email({ message: "Adresse email invalide" }),
      password: z.string().min(1, { message: "Le mot de passe est requis" }),
    });

    this.#validateSchema(schema, data);
  }

  validateForgotPassword(data) {
    const schema = z.object({
      email: z.string().email({ message: "Adresse email invalide" }),
    });

    this.#validateSchema(schema, data);
  }

  validateResetPassword(data) {
    const schema = z.object({
      token: z.string().min(1, { message: "Le token est requis" }),
      newPassword: z
        .string()
        .min(8, {
          message: "Le mot de passe doit contenir au moins 8 caractères",
        })
        .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
          message:
            "Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre",
        }),
    });

    this.#validateSchema(schema, data);
  }

  validateLoginCode(data) {
    const schema = z.object({
      email: z.string().email({ message: "Adresse email invalide" }),
      loginCode: z
        .string()
        .length(6, { message: "Le code doit contenir 6 chiffres" }),
    });

    this.#validateSchema(schema, data);
  }

  #validateSchema(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
      const errors = Object.entries(result.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages?.join(", ")}`)
        .join(" | ");
      throw new Error(errors);
    }
  }
}

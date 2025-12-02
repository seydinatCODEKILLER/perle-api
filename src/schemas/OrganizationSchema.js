import { z } from "zod";

export default class OrganizationSchema {
  constructor() {}

  validateCreate(data) {
    const schema = z.object({
      name: z
        .string()
        .min(2, { message: "Le nom doit contenir au moins 2 caractères" }),
      description: z.string().optional(),
      type: z.enum(["DAHIRA", "ASSOCIATION", "TONTINE", "GROUPEMENT"], {
        message: "Type d'organisation invalide",
      }),
      currency: z.string().default("XOF"),
      address: z.string().optional(),
      city: z.string().optional(),
      country: z.string().default("Sénégal"),
      settings: z
        .object({
          allowPartialPayments: z.boolean().default(false),
          autoReminders: z.boolean().default(true),
          reminderDays: z.array(z.number()).default([1, 3, 7]),
          emailNotifications: z.boolean().default(true),
          smsNotifications: z.boolean().default(false),
          whatsappNotifications: z.boolean().default(false),
          sessionTimeout: z.number().default(60),
        })
        .optional(),
    });

    this.#validateSchema(schema, data);
  }

  validateUpdate(data) {
    const schema = z.object({
      name: z
        .string()
        .min(2, { message: "Le nom doit contenir au moins 2 caractères" })
        .optional(),
      description: z.string().optional(),
      type: z
        .enum(["DAHIRA", "ASSOCIATION", "TONTINE", "GROUPEMENT"], {
          message: "Type d'organisation invalide",
        })
        .optional(),
      currency: z.string().optional(),
      address: z.string().optional(),
      city: z.string().optional(),
      country: z.string().optional(),
      isActive: z.boolean().optional(),
    });

    this.#validateSchema(schema, data);
  }

  validateSettings(data) {
    const schema = z.object({
      allowPartialPayments: z.boolean().optional(),
      autoReminders: z.boolean().optional(),
      reminderDays: z.array(z.number()).optional(),
      emailNotifications: z.boolean().optional(),
      smsNotifications: z.boolean().optional(),
      whatsappNotifications: z.boolean().optional(),
      sessionTimeout: z.number().min(5).max(480).optional(),
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

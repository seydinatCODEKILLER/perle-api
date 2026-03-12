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
          allowPartialPayments: z.boolean().default(true),
          autoReminders: z.boolean().default(true),
          reminderDays: z.array(z.number()).default([1, 3, 7]),
          emailNotifications: z.boolean().default(true),
          smsNotifications: z.boolean().default(false),
          whatsappNotifications: z.boolean().default(false),
          sessionTimeout: z.number().default(60),
        })
        .optional(),
      // ✅ NOUVEAU : Validation du wallet
      wallet: z
        .object({
          initialBalance: z
            .number()
            .nonnegative({
              message: "Le solde initial doit être positif ou nul",
            })
            .default(0),
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

  validateWalletUpdate(data) {
    const schema = z
      .object({
        currentBalance: z
          .number({
            invalid_type_error: "Le solde actuel doit être un nombre",
          })
          .nonnegative({
            message: "Le solde actuel ne peut pas être négatif",
          })
          .optional(),

        initialBalance: z
          .number({
            invalid_type_error: "Le solde initial doit être un nombre",
          })
          .nonnegative({
            message: "Le solde initial ne peut pas être négatif",
          })
          .optional(),

        totalIncome: z
          .number({
            invalid_type_error: "Le total des revenus doit être un nombre",
          })
          .nonnegative({
            message: "Le total des revenus ne peut pas être négatif",
          })
          .optional(),

        totalExpenses: z
          .number({
            invalid_type_error: "Le total des dépenses doit être un nombre",
          })
          .nonnegative({
            message: "Le total des dépenses ne peut pas être négatif",
          })
          .optional(),
      })
      .strict({
        message: "Champs non autorisés dans la requête",
      })
      .refine((data) => Object.keys(data).length > 0, {
        message: "Au moins un champ doit être fourni pour la mise à jour",
      })
      .refine(
        (data) => {
          // Validation logique : totalExpenses <= totalIncome
          if (
            data.totalIncome !== undefined &&
            data.totalExpenses !== undefined
          ) {
            return data.totalExpenses <= data.totalIncome;
          }
          return true;
        },
        {
          message:
            "Le total des dépenses ne peut pas dépasser le total des revenus",
        },
      );

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

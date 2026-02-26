import { z } from "zod";

export default class ContributionPlanSchema {
  constructor() {}

  validateCreate(data) {
    const schema = z
      .object({
        name: z
          .string()
          .min(2, { message: "Le nom doit contenir au moins 2 caractères" }),
        description: z.string().optional(),
        amount: z
          .number()
          .positive({ message: "Le montant doit être positif" })
          .optional()
          .nullable(),
        amountMale: z
          .number()
          .positive({ message: "Le montant hommes doit être positif" })
          .optional()
          .nullable(),
        amountFemale: z
          .number()
          .positive({ message: "Le montant femmes doit être positif" })
          .optional()
          .nullable(),
        frequency: z.enum(
          ["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"],
          {
            message: "Fréquence invalide",
          },
        ),
        currency: z.string().default("XOF"),
        startDate: z.string().datetime({ message: "Date de début invalide" }),
        endDate: z.string().datetime().optional().nullable(),
        isActive: z.boolean().default(true),
      })
      .refine(
        (data) => data.amount || (data.amountMale && data.amountFemale),
        {
          message:
            "Vous devez renseigner soit un montant par défaut, soit les montants homme et femme",
        },
      );

    this.#validateSchema(schema, data);
  }

  validateUpdate(data) {
    const schema = z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      amount: z.number().positive().optional(),
      amountMale: z
        .number()
        .positive({ message: "Le montant hommes doit être positif" })
        .optional()
        .nullable(),
      amountFemale: z
        .number()
        .positive({ message: "Le montant femmes doit être positif" })
        .optional()
        .nullable(),
      frequency: z
        .enum(["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY", "CUSTOM"])
        .optional(),
      currency: z.string().optional(),
      startDate: z.string().datetime().optional(),
      endDate: z.string().datetime().optional().nullable(),
      isActive: z.boolean().optional(),
    });

    this.#validateSchema(schema, data);
  }

  validateGenerateContributions(data) {
    const schema = z.object({
      force: z.boolean().optional().default(false),
      dueDateOffset: z.number().int().optional().default(0),
    });

    this.#validateSchema(schema, data);
  }

  validateAssignToMember(data) {
    const schema = z.object({
      membershipId: z.string({ message: "L'ID du membre est requis" }),
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

import { z } from "zod";

export default class ContributionSchema {
  constructor() {}

  validatePayment(data) {
    const schema = z.object({
      amountPaid: z
        .number({ message: "Le montant payé est requis" })
        .positive({ message: "Le montant doit être positif" }),
      paymentMethod: z.enum(
        ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHECK", "CREDIT_CARD"],
        { message: "Méthode de paiement invalide" },
      ),
    });

    this.#validateSchema(schema, data);
  }

  validatePartialPayment(data) {
    const schema = z.object({
      amount: z
        .number({ message: "Le montant est requis" })
        .positive({ message: "Le montant doit être positif" }),
      paymentMethod: z.enum(
        ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHECK", "CREDIT_CARD"],
        { message: "Méthode de paiement invalide" },
      ),
    });

    this.#validateSchema(schema, data);
  }

  validateCancel(data) {
    const schema = z.object({
      reason: z
        .string()
        .max(500, { message: "La raison ne peut pas dépasser 500 caractères" })
        .optional(),
    });

    return this.#validateSchema(schema, data);
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

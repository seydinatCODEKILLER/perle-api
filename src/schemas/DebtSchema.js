import { z } from "zod";

export default class DebtSchema {
  constructor() {}

  validateCreate(data) {
    const schema = z.object({
      membershipId: z.string({ message: "L'ID du membre est requis" }),
      title: z
        .string()
        .min(2, { message: "Le titre doit contenir au moins 2 caractères" }),
      description: z.string().optional(),
      initialAmount: z
        .number({ message: "Le montant initial est requis" })
        .positive({ message: "Le montant doit être positif" }),
      status: z
        .enum(["ACTIVE", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"], {
          message: "Statut invalide",
        })
        .default("ACTIVE"),
    });

    this.#validateSchema(schema, data);
  }

  validateRepayment(data) {
    const schema = z.object({
      amount: z
        .number({ message: "Le montant est requis" })
        .positive({ message: "Le montant doit être positif" }),
      paymentMethod: z.enum(
        ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHECK", "CREDIT_CARD"],
        { message: "Méthode de paiement invalide" }
      ),
    });

    this.#validateSchema(schema, data);
  }

  validateStatusUpdate(data) {
    const schema = z.object({
      status: z.enum(
        ["ACTIVE", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"],
        { message: "Statut invalide" }
      ),
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
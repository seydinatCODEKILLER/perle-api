// schemas/expenseSchema.js
import { z } from "zod";

export default class ExpenseSchema {
  constructor() {}

  validateCreate(data) {
    const schema = z.object({
      title: z
        .string({ message: "Le titre est requis" })
        .min(2, { message: "Le titre doit contenir au moins 2 caractères" })
        .max(100, { message: "Le titre ne peut pas dépasser 100 caractères" }),
      
      description: z
        .string()
        .max(500, { message: "La description ne peut pas dépasser 500 caractères" })
        .optional(),
      
      amount: z
        .number({ message: "Le montant est requis" })
        .positive({ message: "Le montant doit être positif" })
        .max(1000000000, { message: "Montant trop élevé" }),
      
      category: z
        .enum(
          ["EVENT", "SOCIAL", "ADMINISTRATIVE", "MAINTENANCE", "DONATION", "INVESTMENT", "OPERATIONAL", "OTHER"],
          { message: "Catégorie invalide" }
        ),
      
      expenseDate: z
        .string()
        .optional()
        .transform((val) => val ? new Date(val) : undefined)
        .refine(
          (date) => !date || !isNaN(date.getTime()),
          { message: "Date invalide" }
        ),
    });

    return this.#validateSchema(schema, data);
  }

  validatePay(data) {
    const schema = z.object({
      paymentMethod: z
        .enum(
          ["CASH", "MOBILE_MONEY", "BANK_TRANSFER", "CHECK", "CREDIT_CARD"],
          { message: "Méthode de paiement invalide" }
        ),
      
      reference: z
        .string()
        .max(100, { message: "La référence ne peut pas dépasser 100 caractères" })
        .optional(),
      
      notes: z
        .string()
        .max(500, { message: "Les notes ne peuvent pas dépasser 500 caractères" })
        .optional(),
    });

    return this.#validateSchema(schema, data);
  }

  validateReject(data) {
    const schema = z.object({
      reason: z
        .string()
        .min(3, { message: "La raison du rejet doit contenir au moins 3 caractères" })
        .max(500, { message: "La raison ne peut pas dépasser 500 caractères" })
        .optional(),
    });

    return this.#validateSchema(schema, data);
  }

  validateCancel(data) {
    const schema = z.object({
      reason: z
        .string()
        .min(3, { message: "La raison de l'annulation doit contenir au moins 3 caractères" })
        .max(500, { message: "La raison ne peut pas dépasser 500 caractères" })
        .optional(),
    });

    return this.#validateSchema(schema, data);
  }

  validateGetExpenses(query) {
    const schema = z.object({
      status: z
        .enum(
          ["PENDING", "APPROVED", "REJECTED", "PAID", "CANCELLED"],
          { message: "Statut invalide" }
        )
        .optional(),
      
      category: z
        .enum(
          ["EVENT", "SOCIAL", "ADMINISTRATIVE", "MAINTENANCE", "DONATION", "INVESTMENT", "OPERATIONAL", "OTHER"],
          { message: "Catégorie invalide" }
        )
        .optional(),
      
      createdById: z
        .string()
        .optional(),
      
      startDate: z
        .string()
        .optional()
        .transform((val) => val ? new Date(val) : undefined)
        .refine(
          (date) => !date || !isNaN(date.getTime()),
          { message: "Date de début invalide" }
        ),
      
      endDate: z
        .string()
        .optional()
        .transform((val) => val ? new Date(val) : undefined)
        .refine(
          (date) => !date || !isNaN(date.getTime()),
          { message: "Date de fin invalide" }
        ),
      
      search: z
        .string()
        .min(2, { message: "La recherche doit contenir au moins 2 caractères" })
        .optional(),
      
      page: z
        .string()
        .optional()
        .transform((val) => val ? parseInt(val) : 1)
        .refine(
          (page) => page > 0,
          { message: "La page doit être un nombre positif" }
        ),
      
      limit: z
        .string()
        .optional()
        .transform((val) => val ? parseInt(val) : 10)
        .refine(
          (limit) => limit > 0 && limit <= 100,
          { message: "La limite doit être comprise entre 1 et 100" }
        ),
    });

    return this.#validateSchema(schema, query);
  }

  validateStats(query) {
    const schema = z.object({
      startDate: z
        .string()
        .optional()
        .transform((val) => val ? new Date(val) : undefined)
        .refine(
          (date) => !date || !isNaN(date.getTime()),
          { message: "Date de début invalide" }
        ),
      
      endDate: z
        .string()
        .optional()
        .transform((val) => val ? new Date(val) : undefined)
        .refine(
          (date) => !date || !isNaN(date.getTime()),
          { message: "Date de fin invalide" }
        ),
    });

    return this.#validateSchema(schema, query);
  }

  validateIdParam(param) {
    const schema = z.object({
      id: z
        .string({ message: "L'ID est requis" })
        .min(5, { message: "ID invalide" }),
    });

    return this.#validateSchema(schema, { id: param });
  }

  #validateSchema(schema, data) {
    const result = schema.safeParse(data);
    if (!result.success) {
      const errors = Object.entries(result.error.flatten().fieldErrors)
        .map(([field, messages]) => `${field}: ${messages?.join(", ")}`)
        .join(" | ");
      throw new Error(errors);
    }
    return result.data;
  }
}
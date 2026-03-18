import { z } from "zod";

export default class MembershipSchema {
  constructor() {}

  validateCreate(data) {
    const schema = z.discriminatedUnion("memberType", [
      z.object({
        memberType: z.literal("existing"),
        phone: z.string().min(1, "Téléphone requis"),
        role: z.enum(["ADMIN", "FINANCIAL_MANAGER", "MEMBER", "PRESIDENT", "VICE_PRESIDENT", "SECRETARY_GENERAL", "ORGANIZER"]).optional(),
      }),

      z.object({
        memberType: z.literal("provisional"),
        provisionalData: z.object({
          firstName: z.string().min(1),
          lastName: z.string().min(1),
          phone: z.string().min(1),
          email: z.string().email().optional(),
          gender: z.enum(["MALE", "FEMALE"]).optional(),
        }),
        role: z.enum(["ADMIN", "FINANCIAL_MANAGER", "MEMBER", "PRESIDENT", "VICE_PRESIDENT", "SECRETARY_GENERAL", "ORGANIZER"]).optional(),
      }),
    ]);

    this.#validateSchema(schema, data);
  }

  validateUpdate(data) {
    const schema = z.object({
      role: z
        .enum(["ADMIN", "FINANCIAL_MANAGER", "MEMBER", "PRESIDENT", "VICE_PRESIDENT", "SECRETARY_GENERAL", "ORGANIZER"], {
          message: "Rôle invalide",
        })
        .optional(),
      memberNumber: z.string().optional(),
      joinDate: z.string().datetime().optional(),
    });

    this.#validateSchema(schema, data);
  }

  validateStatusUpdate(data) {
    const schema = z.object({
      status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"], {
        message: "Statut invalide",
      }),
    });

    this.#validateSchema(schema, data);
  }

  validateRoleUpdate(data) {
    const schema = z.object({
      role: z.enum(["ADMIN", "FINANCIAL_MANAGER", "MEMBER", "PRESIDENT", "VICE_PRESIDENT", "SECRETARY_GENERAL", "ORGANIZER"], {
        message: "Rôle invalide",
      }),
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
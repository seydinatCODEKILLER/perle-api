import AuthRoutes from "../routes/AuthRoutes.js";
import ContributionPlanRoutes from "../routes/ContributionPlanRoutes.js";
import ContributionRoutes from "../routes/ContributionRoutes.js";
import DebtRoutes from "../routes/DebtRoutes.js";
import MembershipRoutes from "../routes/MembershipRoutes.js";
import OrganizationRoutes from "../routes/OrganizationRoutes.js";
import SubscriptionRoutes from "../routes/SubscriptionRoutes.js";
import TransactionRoutes from "../routes/TransactionRoutes.js";

export const authRoute = new AuthRoutes();
export const organisationRoute = new OrganizationRoutes();
export const membershipRoute = new MembershipRoutes();
export const contributionPlanRoute = new ContributionPlanRoutes();
export const contributionRoute = new ContributionRoutes();
export const debtRoute = new DebtRoutes();
export const transactionRoute = new TransactionRoutes();
export const subscriptionRoute = new SubscriptionRoutes();
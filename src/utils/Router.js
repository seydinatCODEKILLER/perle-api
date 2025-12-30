import AuthRoutes from "../routes/AuthRoutes.js";
import MembershipRoutes from "../routes/MembershipRoutes.js";
import OrganizationRoutes from "../routes/OrganizationRoutes.js";

export const AuthRoute = new AuthRoutes();
export const organisationRoute = new OrganizationRoutes();
export const membershipRoute = new MembershipRoutes();
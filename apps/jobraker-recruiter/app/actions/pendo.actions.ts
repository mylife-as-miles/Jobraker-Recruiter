"use server";

import { authCheck } from "./auth.actions";
import { getCustomer } from "./billing.actions";

export async function getPendoVisitorData() {
  try {
    const user = await authCheck();

    let subscriptionPlan: string | undefined;
    let subscriptionStatus: string | undefined;

    try {
      if (user.billingCustomerId) {
        const customer = await getCustomer();
        subscriptionPlan = customer.subscriptionPlan ?? undefined;
        subscriptionStatus = customer.subscriptionStatus ?? undefined;
      }
    } catch {
      // Billing data may not be available
    }

    return {
      id: user.id,
      auth0Id: user.auth0Id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      billingCustomerId: user.billingCustomerId,
      subscriptionPlan,
      subscriptionStatus,
    };
  } catch {
    return null;
  }
}

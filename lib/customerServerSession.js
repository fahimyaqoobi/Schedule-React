import { cookies } from "next/headers";
import { verifyCustomerSession } from "./customerSession";

export async function getPortalPhone() {
    const store = await cookies();
    const token = store.get("cst")?.value;
    if (!token) return null;
    try {
        return verifyCustomerSession(token).phone;
    } catch {
        return null;
    }
}

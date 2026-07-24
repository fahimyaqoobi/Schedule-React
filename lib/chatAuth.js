import { adminAuth, adminDb } from "./firebase-admin";
import { normalizeRole, roleHasDepartment, canManageBranch } from "./permissions";
import { getSessionPhoneAny } from "./customerSession";

// Chat is reachable from three different logins: the admin/ops Firebase Auth
// app, the same app for field staff (cleaners), and the customer portal's
// separate HMAC session-cookie auth. This resolves whichever one sent the
// request into one shape the chat routes can authorize against.
export async function identifyChatActor(request) {
    const authHeader = request.headers.get("Authorization") || "";
    if (authHeader.startsWith("Bearer ")) {
        try {
            const token = authHeader.slice(7);
            const decoded = await adminAuth.verifyIdToken(token);
            const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                if (userData.status === "approved") {
                    const role = normalizeRole(userData.role);
                    const isFieldStaff = ["cleaner", "subcontractor", "supervisor", "employee"].includes(role);
                    const isSupportStaff = canManageBranch(userData) || roleHasDepartment(userData.role, "sales") || roleHasDepartment(userData.role, "operations");
                    return {
                        kind: isFieldStaff ? "cleaner" : "staff",
                        uid: userData.uid,
                        name: userData.name || userData.email || "Team member",
                        role,
                        isSupportStaff,
                    };
                }
            }
        } catch {
            // Not a valid Firebase ID token — fall through to customer session.
        }
    }
    try {
        const phone = getSessionPhoneAny(request);
        return { kind: "customer", phone };
    } catch {
        // neither auth mechanism matched
    }
    throw new Error("Unauthorized");
}

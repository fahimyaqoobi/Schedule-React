import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.CUSTOMER_SESSION_SECRET || process.env.STRIPE_SECRET_KEY?.slice(-32) || "stc-dev-fallback";
const EXPIRY_MS = 8 * 60 * 60 * 1000; // 8 hours

export function signCustomerSession(phone) {
    const exp = Date.now() + EXPIRY_MS;
    const payload = `${phone}|${exp}`;
    const sig = createHmac("sha256", SECRET).update(payload).digest("base64url");
    return Buffer.from(`${payload}|${sig}`).toString("base64url");
}

export function verifyCustomerSession(token) {
    let decoded;
    try {
        decoded = Buffer.from(token, "base64url").toString();
    } catch {
        throw new Error("Invalid session token.");
    }
    const parts = decoded.split("|");
    if (parts.length !== 3) throw new Error("Invalid session token.");
    const [phone, expStr, sig] = parts;
    if (Date.now() > parseInt(expStr, 10)) throw new Error("Session expired. Please verify again.");
    const expected = createHmac("sha256", SECRET).update(`${phone}|${expStr}`).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
        throw new Error("Invalid session token.");
    }
    return { phone };
}

export function getSessionPhone(request) {
    const header = request.headers.get("Authorization") || "";
    if (!header.startsWith("Bearer ")) throw new Error("Unauthorized");
    return verifyCustomerSession(header.slice(7)).phone;
}

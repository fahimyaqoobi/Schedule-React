import { redirect } from "next/navigation";
import { getPortalPhone } from "../../lib/customerServerSession";
import CustomerLoginForm from "../components/portal/CustomerLoginForm";

export const metadata = { title: "Sign In — Smartouch Clean" };

export default async function CustomerLoginPage() {
    const phone = await getPortalPhone();
    if (phone) redirect("/customer/home");
    return <CustomerLoginForm />;
}

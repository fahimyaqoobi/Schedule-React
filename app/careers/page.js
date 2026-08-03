import ApplyForm from "./ApplyForm";

export const metadata = {
    title: "Careers — SmarTouch Clean",
    description: "Apply to join the SmarTouch Clean team.",
};

export default function CareersPage() {
    return (
        <div className="min-h-dvh bg-gradient-to-b from-[#f0f6fc] to-white">
            <div className="w-full bg-gradient-to-br from-[#005691] to-[#0A6CB8] px-6 py-10 text-center text-white">
                <h1 className="text-2xl font-bold">Join SmarTouch Clean</h1>
                <p className="mt-1 text-sm text-white/85">We're hiring cleaners, supervisors, and more — apply below.</p>
            </div>
            <div className="mx-auto -mt-6 max-w-lg px-4 pb-16">
                <ApplyForm />
            </div>
        </div>
    );
}

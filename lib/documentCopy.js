export const DEFAULT_DOCUMENT_COPY = {
    serviceNotesTitle: "SERVICE NOTES",
    serviceNotesBody: "Scope follows the selected service tier, selected add-ons, and any approved booking notes.",
    notesTitle: "NOTES",
    notesBody: "Thank you for considering SmarTouch Clean. We look forward to providing you with exceptional service.",
    termsTitle: "TERMS & CONDITIONS",
    termsBody: [
        "This {document} is valid for 30 days from the date above.",
        "Services will be scheduled upon acceptance of this {document}.",
        "Payment is due upon completion of the service.",
        "Cancellations must be made at least 24 hours in advance.",
        "Prices do not include tips or gratuities.",
        "We are not responsible for pre-existing damage or issues beyond our control."
    ].join("\n")
};

export function normalizeDocumentCopy(value = {}) {
    const copy = value && typeof value === "object" ? value : {};
    return {
        serviceNotesTitle: String(copy.serviceNotesTitle || DEFAULT_DOCUMENT_COPY.serviceNotesTitle),
        serviceNotesBody: String(copy.serviceNotesBody || DEFAULT_DOCUMENT_COPY.serviceNotesBody),
        notesTitle: String(copy.notesTitle || DEFAULT_DOCUMENT_COPY.notesTitle),
        notesBody: String(copy.notesBody || DEFAULT_DOCUMENT_COPY.notesBody),
        termsTitle: String(copy.termsTitle || DEFAULT_DOCUMENT_COPY.termsTitle),
        termsBody: String(copy.termsBody || DEFAULT_DOCUMENT_COPY.termsBody)
    };
}

export function getDocumentTerms(copy = {}, documentLabel = "document") {
    const normalized = normalizeDocumentCopy(copy);
    return normalized.termsBody
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => line.replaceAll("{document}", String(documentLabel || "document").toLowerCase()));
}

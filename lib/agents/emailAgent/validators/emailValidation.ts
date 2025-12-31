const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const sanitizeHeaderValue = (value: string, fieldName: string): string => {
    if (/\r|\n/.test(value)) {
        throw new Error(`Invalid header value for ${fieldName}.`);
    }
    return value.trim();
};

export const validateEmailList = (addresses: string[] | undefined, fieldName: string): string[] => {
    if (!addresses || addresses.length === 0) {
        return [];
    }

    const normalized = addresses
        .map((address) => address.trim())
        .filter(Boolean);

    const invalid = normalized.filter((address) => !EMAIL_REGEX.test(address));
    if (invalid.length > 0) {
        throw new Error(`Invalid ${fieldName} address(es): ${invalid.join(", ")}`);
    }

    normalized.forEach((address) => {
        if (/\r|\n/.test(address)) {
            throw new Error(`Invalid ${fieldName} address value.`);
        }
    });

    return normalized;
};

export const validateSingleEmail = (address: string, fieldName: string): string => {
    const normalized = address.trim();
    if (!EMAIL_REGEX.test(normalized)) {
        throw new Error(`Invalid ${fieldName} address: ${address}`);
    }
    if (/\r|\n/.test(normalized)) {
        throw new Error(`Invalid ${fieldName} address value.`);
    }
    return normalized;
};

export const ensureHasRecipients = (to: string[], cc: string[], bcc: string[]) => {
    if (to.length + cc.length + bcc.length === 0) {
        throw new Error("At least one recipient (to, cc, or bcc) is required.");
    }
};

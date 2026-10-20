export const MAX_AVATAR_BYTES = 20 * 1024 * 1024;
export const avatarPath = (value: unknown): string | null => typeof value === "string" && /^avatars\/[a-f0-9]{64}\.png$/.test(value) ? value : null;

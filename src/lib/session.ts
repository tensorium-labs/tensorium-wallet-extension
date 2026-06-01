let _privateKeyHex: string | null = null;

export function setSession(privateKeyHex: string): void { _privateKeyHex = privateKeyHex; }
export function getSession(): string | null { return _privateKeyHex; }
export function clearSession(): void { _privateKeyHex = null; }
export function isUnlocked(): boolean { return _privateKeyHex !== null; }

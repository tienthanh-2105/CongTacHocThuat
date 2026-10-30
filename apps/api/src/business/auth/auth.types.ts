export type CurrentUser = { id: string; username: string; name: string; roles: string[]; department?: string };
export type SessionContext = { user: CurrentUser; userId: string; sessionId: string; passwordVersion: number };
export type LoginInput = { username: string; password: string };
export type ChangePasswordInput = { currentPassword: string; newPassword: string };

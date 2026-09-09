export type AdminProfileIdentity = Readonly<{
  firstName: string | null;
  lastName: string | null;
}>;

export function normalizeAdminProfileName(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function hasCompleteAdminProfile(profile: AdminProfileIdentity): boolean {
  return Boolean(
    normalizeAdminProfileName(profile.firstName) && normalizeAdminProfileName(profile.lastName),
  );
}

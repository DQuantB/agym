export type AccountDeletionDependencies = {
  deleteRemoteAccount: () => Promise<void>;
  clearLocalDrafts: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export async function deleteAccountAndClearLocalData(
  userId: string,
  dependencies: AccountDeletionDependencies,
): Promise<void> {
  await dependencies.deleteRemoteAccount();
  await dependencies.clearLocalDrafts(userId);
  await dependencies.signOut();
}

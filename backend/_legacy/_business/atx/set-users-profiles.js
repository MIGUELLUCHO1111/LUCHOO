import getMethod from "./get-method.js";

// Bulk assign profiles to multiple users in one pass
export default async function setUsersProfiles(data) {
  const _forEachJsonMethodTx = await getMethod({
    className: 'helpers',
    method: '_forEachJsonMethodTx',
  });
  const _ensureEntityByUniqueField = await getMethod({
    className: 'helpers',
    method: '_ensureEntityByUniqueField',
  });
  const _ensureJoin = await getMethod({
    className: 'helpers',
    method: '_ensureJoin',
  });

  // expected shape: { username: [profile1, profile2], ... }
  const rows = await _forEachJsonMethodTx({
    data,
    filter: (username, arr) =>
      !!username && Array.isArray(arr) && arr.length > 0,
    onEach: async ({ key: username, value: arrProfiles }, client) => {
      const userId = await _ensureEntityByUniqueField(client, 'user', {
        username,
      });
      const out = [];
      for (const profile of arrProfiles) {
        const profileId = await _ensureEntityByUniqueField(client, 'profile', {
          name: profile,
        });
        await _ensureJoin(client, 'user_profile', {
          id_user: userId,
          id_profile: profileId,
        });
        out.push({ username, profile });
      }
      return out;
    },
    errorMessage: 'Error en setUsersProfiles',
  });
  return { data: (rows?.data || []).flat() };
}

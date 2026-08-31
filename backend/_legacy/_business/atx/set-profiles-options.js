import getMethod from "./get-method.js";

export default async function setProfilesOptions(data) {
  const _forEachJsonMethod = await getMethod({
    className: 'helpers',
    method: '_forEachJsonMethod',
  });
  const setProfileOption = await getMethod({
    className: 'atx',
    method: 'setProfileOption',
  });

  return await _forEachJsonMethod({
    data,
    filter: (profile, arr) => Array.isArray(arr) && arr.length > 0,
    onEach: async ({ key: profile, value: arrOptions }) => {
      for (const option of arrOptions) {
        await setProfileOption({ option, profile });
      }
    },
  });
}

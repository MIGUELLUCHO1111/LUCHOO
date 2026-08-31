import getMethod from "./get-method.js";

export default async function delProfilesOptions(data) {
  const delProfileOption = await getMethod({
    className: 'atx',
    method: 'delProfileOption',
  });

  return await _forEachJsonMethod({
    data,
    filter: (profile, arr) => Array.isArray(arr) && arr.length > 0,
    onEach: async ({ key: profile, value: arrOptions }) => {
      for (const option of arrOptions) {
        await delProfileOption({
          option,
          profile,
          confirmDelete: 'DELETE_OPTION_PROFILE',
        });
      }
    },
  });
}

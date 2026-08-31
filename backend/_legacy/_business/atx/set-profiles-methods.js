import getMethod from "./get-method.js";

export default async function setProfilesMethods(data) {
  const _forEachJsonMethod = await getMethod({
    className: 'helpers',
    method: '_forEachJsonMethod',
  });
  const setProfileMethod = await getMethod({
    className: 'atx',
    method: 'setProfileMethod',
  });

  return await _forEachJsonMethod({
    data,
    filter: (profile, arr) => Array.isArray(arr) && arr.length > 0,
    onEach: async ({ key: profile, value: arrMethods }) => {
      for (const method of arrMethods) {
        await setProfileMethod({ method, profile });
      }
    },
  });
}

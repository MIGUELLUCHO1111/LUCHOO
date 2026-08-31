import getMethod from "./get-method.js";

export default async function replaceMenusOptionsProfiles(data) {
  const delAllMenusOptionsProfiles = await getMethod({
    className: 'atx',
    method: 'delAllMenusOptionsProfiles',
  });
  const setMenusOptionsProfiles = await getMethod({
    className: 'atx',
    method: 'setMenusOptionsProfiles',
  });

  // For simplicity and to avoid nested transactions, do two transactional steps
  await delAllMenusOptionsProfiles();
  return await setMenusOptionsProfiles(data);
}

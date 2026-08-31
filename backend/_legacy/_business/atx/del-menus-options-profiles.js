import getMethod from "./get-method.js";

export default async function delMenusOptionsProfiles(data) {
  const delMenuOptionsProfile = await getMethod({
    className: 'atx',
    method: 'delMenuOptionsProfile',
  });

  const profiles = Object.keys(data);
  for (const profile of profiles) {
    const menus = Object.keys(data[profile]);
    for (const menu of menus) {
      await delMenuOptionsProfile({
        profile,
        menu,
        arrOptions: data[profile][menu],
      });
    }
  }
}

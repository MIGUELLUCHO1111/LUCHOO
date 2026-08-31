export async function checkEmailInUse(email, dbmsInstance) {
  let emailInUse = false;
  if (dbmsInstance && typeof dbmsInstance.executeNamedQuery === 'function') {
    try {
      if (typeof dbmsInstance.init === 'function' && !dbmsInstance.queries) {
        await dbmsInstance.init();
      }
      const result = await dbmsInstance.executeNamedQuery({
        nameQuery: 'countUserByEmail',
        params: { email },
      });
      if (Number(result?.rows?.[0]?.count || 0) > 0) emailInUse = true;
    } catch (err) {
      console.error('Error checking email existence:', err);
    }
  }

  if (emailInUse) return 'El email ya está en uso.';
  return '';
}

export async function checkUsernameInUse(username, dbmsInstance) {
  if (dbmsInstance && typeof dbmsInstance.executeNamedQuery === 'function') {
    try {
      if (typeof dbmsInstance.init === 'function' && !dbmsInstance.queries) {
        await dbmsInstance.init();
      }
      const result = await dbmsInstance.executeNamedQuery({
        nameQuery: 'countUserByUsername',
        params: { username },
      });
      const userExists = Number(result?.rows?.[0]?.count || 0) > 0;
      if (userExists) {
        return 'El nombre de usuario ya está en uso.';
      }
    } catch (err) {
      console.error('Error checking username existence:', err);
      return 'Error al validar el nombre de usuario.';
    }
  }
}

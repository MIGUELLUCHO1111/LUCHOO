import getMethod from "./get-method.js";

export default async function delSubsystemsClassesMethods(data) {
  const delSubsystemClassMethod = await getMethod({
    className: 'atx',
    method: 'delSubsystemClassMethod',
  });

  const subsystems = Object.keys(data);
  for (const subsystem of subsystems) {
    const classesMethods = data[subsystem];
    for (const className in classesMethods) {
      const methods = classesMethods[className];
      for (const method of methods) {
        await delSubsystemClassMethod({
          subsystem,
          className,
          method,
          confirmDelete: 'DELETE_CLASS_METHOD',
          confirmDelete2: 'DELETE_SUBSYSTEM_CLASS',
        });
      }
    }
  }
}

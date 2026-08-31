import getMethod from "./get-method.js";

export default async function replaceSubsystemsClassesMethods(data) {
  const replaceSubsystemClassMethod = await getMethod({
    className: 'atx',
    method: 'replaceSubsystemClassMethod',
  });
  const subsystems = Object.keys(data);
  for (const subsystem of subsystems) {
    const classesMethods = data[subsystem];
    for (const className in classesMethods) {
      const methods = classesMethods[className];
      for (const method of methods) {
        await replaceSubsystemClassMethod({
          subsystem,
          className,
          method,
        });
      }
    }
  }
}

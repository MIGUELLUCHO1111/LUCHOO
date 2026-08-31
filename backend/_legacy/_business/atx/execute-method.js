import getMethod from "./get-method.js";

export default async function executeMethod({
  subsystem,
  className,
  method,
  params,
}) {
  let i = await getMethod({ subsystem, className, method });
  const r = await i[method](params);
  i = null;
  return r;
}

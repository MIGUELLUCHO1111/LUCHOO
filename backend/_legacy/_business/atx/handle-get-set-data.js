import Config from '../../../config/config.js';

export default async function handleGetSetData({
  method,
  methodIfNotFound,
  data,
  dataIfNotFound,
}) {
  const config = new Config();
  const ERROR_CODES = config.ERROR_CODES;

  let result = await method(data).then((res) => res);
  if (
    result &&
    result.statusCode &&
    result.statusCode === ERROR_CODES.NOT_FOUND
  ) {
    await methodIfNotFound(dataIfNotFound);
    result = await method(data).then((res) => res);
  }
  return result;
}

function createError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.expose = true;
  return err;
}

function assertValid(check) {
  if (!check.valid) {
    throw createError(check.error, 400);
  }
}

module.exports = {
  createError,
  assertValid,
};

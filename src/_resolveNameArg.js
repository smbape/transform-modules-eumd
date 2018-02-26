export default (_resolveName, arg) => {
  const dep = typeof arg === "string" ? arg : arg.type === "StringLiteral" ? arg.value : null;

  if (dep == null) {
    return dep;
  }

  const value = _resolveName(dep);

  // eslint-disable-next-line no-return-assign
  return typeof arg === "string" ? value : (arg.value = value, arg);
};

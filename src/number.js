export const maybeNumber = val => {
  const tmp = parseInt(val);
  return Number.isNaN(tmp) ? val : tmp;
}

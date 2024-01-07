export const multiDimGet = (obj, d) => {
  const [length] = d;
  const newD = d.slice(1);

  if (newD.length == 0) {
    return Array.from({ length }, (_, i) => obj[i]);
  }

  return Array.from({ length }, (_, i) => multiDimGet(obj[i], newD));
};

export const multiDimSet = (obj, d, v) => {
  const [length] = d;
  const newD = d.slice(1);
  const n = Math.min(v.length, length);

  if (newD.length == 0) {
    for (let i = 0; i < n; ++i) {
      obj[i] = v[i];
    }
  }

  for (let i = 0; i < n; ++i) {
    if (Array.isArray(v[i])) {
      multiDimSet(obj[i], newD, v[i]);
    }
    else {
      obj[i] = v[i];
    }
  }
};

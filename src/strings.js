export const isWhitespace = c => /\s/.test(c);

export const skipWhitespace = (str, i) => {
  const n = str.length;
  while (i < n && isWhitespace(str[i])) {
    i++;
  }
  return i;
};

export function trim(str) {
  return str.replaceAll('\n', ' ').replace(/(\s)\s+/g, '$1').trim();
}

export const isCapital = str => str[0].toUpperCase() == str[0];

export const toString = (obj) => {
  return obj.toString();
}

export const trimWithEllipsis = (str, n = 8) => {
  if (typeof str != 'string') {
    return '';
  }
  if (str.length <= n) {
    return str;
  }
  return str.slice(0, n) + '...';
}

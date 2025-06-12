import { maybeNumber, forSize, createMask } from '#src/number';

export function proxyFromParams({ getter, setter, buffer, d: _d, length, floating, BufferImpl }) {
  const k = _d[0];
  const d = _d.slice(1);
  const chunkSize = length / k / 8;
  return new Proxy(buffer, {
    get(target, _prop, receiver) {
      if (typeof _prop == 'symbol') {
        return target[_prop];
      }

      const prop = maybeNumber(_prop);
      if (typeof prop == 'number') {
        if (prop < 0 || prop >= k) {
          throw new Error(`Out of bounds value, expected index to be 0 <= index < ${k}`);
        }
        if (d.length == 0) {
          return target[getter](prop * chunkSize);
        }
        else {
          return proxyFromParams({ 
            getter, 
            setter, 
            buffer: buffer.subarray(prop * chunkSize, (prop + 1) * chunkSize), 
            d, 
            length: chunkSize * 8, 
            floating, 
            BufferImpl 
          });
        }
      }
      else if (typeof target[prop] == 'function') {
        return target[prop].bind(target);
      }

      //Reflect throws strange errors
      //return Reflect.get(...arguments);

      return target[prop];
    },
    set(target, _prop, val) {
      if (typeof _prop == 'symbol') {
        target[prop] = val;

        return true;
      }

      const prop = maybeNumber(_prop);
      if (typeof prop == 'number') {
        if (prop < 0 || prop >= k) {
          throw new Error(`Out of bounds value, expected index to be 0 <= index < ${k}`);
        }
        if (d.length == 0) {
          target[setter](val instanceof BufferImpl ? val[getter]() : forSize(chunkSize * 8, val, floating), prop * chunkSize);
        }
        else {
          if (val instanceof BufferImpl) {
            val.copy(target.subarray(prop * chunkSize, (prop + 1) * chunkSize), 0, 0, Math.min(val.length, chunkSize));
          }
          else {
            target.subarray(prop * chunkSize, (propd + 1) * chunkSize).write(val.toString());
          }
        }
        return true;
      }

      //Reflect throws strange errors
      //return Reflect.set(...arguments);

      target[prop] = val;

      return true;
    },
  });
}

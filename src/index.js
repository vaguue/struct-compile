function getterFromType(type, endianness) {

}

/*
buf.readBigInt64BE   
buf.readBigInt64LE   

buf.readBigUInt64BE  
buf.readBigUInt64LE  

buf.readDoubleBE
buf.readDoubleLE

buf.readFloatBE
buf.readFloatLE

buf.readInt16BE
buf.readInt16LE

buf.readInt32BE
buf.readInt32LE

buf.readInt8
buf.readUInt8

buf.readIntBE
buf.readIntLE

buf.readUInt16BE
buf.readUInt16LE

buf.readUInt32BE
buf.readUInt32LE

buf.readUIntBE
buf.readUIntLE
*/


function createField(obj, offset, name, type, endianness) {
  Object.defineProperty(Res.prototype, field.name, {
    get() {

    },
    set(val) {
      
    },
  });
}

function createStruct(name, fields, endianness) {
  function Res(buf) {
    this._buf = buf;
  }

  let offset = 0;
  fields.forEach((field) => {
    offset += createField(Res.prototype, offset, field.name, field.type, endianness);
  });

  Object.defineProperty(Res, 'name', { value: name });
  return Res;
}

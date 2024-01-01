import { parserInstance } from './parser.js';

const isCapital = str => str[0].toUpperCase() == str[0];

//const BaseCstVisitor = parserInstance.getBaseCstVisitorConstructor();
const BaseCstVisitor =
  parserInstance.getBaseCstVisitorConstructorWithDefaults();

export class StructVisitor extends BaseCstVisitor {
  constructor() {
    super();
    this.metaRex = /@\w+/g;
    this.validateVisitor();
  }

  structs(ctx) {
    // ctx.columnsList is an array, while this.visit accepts a CSTNode
    // but if an array is passed to this.visit it will act as though the first element of the array has been passed.
    // this means "this.visit(ctx.columnsList)" is equivalent to "this.visit(ctx.columnsList[0])"
    const structs = Array.from({ length: ctx.struct.length }, (_, i) => this.visit(ctx.struct[i]));

    return structs;
  }

  struct(ctx) {
    const name = ctx.Identifier?.[0]?.image ?? null;
    const attributes = ctx.attributes ? this.visit(ctx.attributes) : null;
    const members = Array.from({ length: ctx.member.length ?? 0 }, (_, i) => this.visit(ctx.member[i]));
    const comment = ctx.OneLineComment?.[0]?.image ?? null;
    const meta = this._buildMeta(comment);

    return { 
      name,
      attributes,
      members,
      meta,
    };
  }

  _buildMeta(comment) {
    const meta = {};
    let match;
    while (match = this.metaRex.exec(comment)) {
      meta[match[0].slice(1)] = true;
    }
    return meta;
  }

  _normalizeMemberValue(values) {
    const n = values.length;
    for (let i = 0; i < n; ++i) {
      if (values[i].startsWith('*')) {
        values[i] = values[i].slice(1);
        if (i == 0) {
          throw new Error(`Error normalizing result: ${values[i]} is invalid`);
        }
        values[i - 1] = values[i - 1] + '*';
      }
    }

    for (let i = n - 1; i >= 0; --i) {
      if (values[i].endsWith(']') && !values[i].startsWith('[')) {
        const str = values[i].split('');
        const squareBracket = str.splice(str.indexOf('[')).join('');
        values[i] = str.join('');
        values.splice(i + 1, 0, squareBracket);
      }
    }

    for (let i = 0; i < n; ++i) {
      values[i] = values[i].trim();
    }

    return values;
  }

  member(ctx) {
    const comment = ctx.OneLineComment?.[0]?.image ?? null;
    const values = ctx.Identifier.map(e => ({ value: e.image, offset: e.startOffset }));
    if (ctx.squareBracketExpression) {
      values.push(...Array.from({ length: ctx.squareBracketExpression.length }, (_, i) => 
        this.visit(ctx.squareBracketExpression[i], { forMember: true })));
    }
    const meta = this._buildMeta(comment);

    return {
      value: this._normalizeMemberValue(values.sort((a, b) => a.offset - b.offset).map(e => e.value)),
      meta,
    };
  }

  attributes(ctx) {
    const tokens = this.visit(ctx.bracketExpression, { isAttr: true });
    const result = {};
    for (let i = 0; i < tokens.length; ++i) {
      if (tokens[i] == '__packed__') {
        result.packed = true;
      }
      if (tokens[i] == 'aligned' || tokens[i] == '__aligned__') {
        let num = 0;
        if (i < tokens.length - 1 && !Number.isNaN(num = parseInt(tokens[i + 1]))) {
          result.aligned = num;
        }
        else {
          result.aligned = true;
        }
      }
    }
    return result;
  }

  bracketExpression(ctx, params) {
    if (params.isAttr) {
      const toLift = !params.isChild;
      params.isChild = true;
      let result = [];
      for (const key of Object.keys(ctx)) {
        if (key == 'RoundBracketOpen' || key == 'RoundBracketClose') continue;
        if (isCapital(key)) {
          result.push(...ctx[key].map(e => ({ value: e, type: key, offset: e.startOffset })));
        }
        else {
          result.push(...Array.from({ length: ctx[key].length }, (_, i) => this.visit(ctx[key][i], params)));
        }
      }
      result = result.flat().sort((a, b) => a.offset - b.offset);
      if (toLift) {
        result = result.map(e => e.value.image);
      }
      return result;
    }
    else {
      throw new Error('Unable to parse');
    }
  }

  squareBracketExpression(ctx, params) {
    if (params.forMember) {
      const offset = ctx.SquareBracketOpen[0].startOffset;
      if (ctx.Num) {
        return {
          offset,
          value: `[${ctx.Num[0].image}]`,
        };
      }
      return {
        offset,
        value: `[]`,
      }
    }
    else {
      throw new Error('Unable to parse');
    }
  }
}

export const interpreter = new StructVisitor;

export function traverseResult(cstOutput) {
  return interpreter.visit(cstOutput);
};

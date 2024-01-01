import { createToken, CstParser, Lexer } from 'chevrotain';

const WhiteSpace = createToken({ name: 'Whitespace', pattern: /[\s\n]+/, group: Lexer.SKIPPED, });
const MultiLineComment = createToken({ name: 'MultiLineComment', pattern: /\/\*.*?\*\//, group: Lexer.SKIPPED, });
const OneLineComment = createToken({ name: 'OneLineComment', pattern: /\/\/.*?\n/ });
const Struct = createToken({ name: 'Struct', pattern: /struct/ });
const Attributes = createToken({ name: 'Attributes', pattern: /__attribute__/ });
const CString = createToken({ name: 'CString', pattern: /"([^"]*)"/ });
const RoundBracketOpen = createToken({ name: 'RoundBracketOpen', pattern: /\(/ });
const RoundBracketClose = createToken({ name: 'RoundBracketClose', pattern: /\)/ });
const SquareBracketOpen = createToken({ name: 'SquareBracketOpen', pattern: /\[/ });
const SquareBracketClose = createToken({ name: 'SquareBracketClose', pattern: /\]/ });
const BracesOpen = createToken({ name: 'BracesOpen', pattern: /\{/ });
const BracesClose = createToken({ name: 'BracesClose', pattern: /\}/ });
//const Identifier = createToken({ name: 'Identifier', pattern: /(const\s*)?&?[a-zA-Z][\w:_]*&?\*?(\[\])?/ });
const Identifier = createToken({ name: 'Identifier', pattern: /(const\s*)?[&*]?[_a-zA-Z][\w:_]*&?\*?(\[\d*?\])?/ });
const Comma = createToken({ name: 'Comma', pattern: /,/ });
const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });
const EqualOperator = createToken({ name: 'EqualOperator', pattern: /=/ });
const ArrowOperator = createToken({ name: 'ArrowOperator', pattern: /->/ });
const Num = createToken({ name: 'Num', pattern: /[0-9]+/ });
const AnyToken = createToken({ name: 'AnyToken', pattern: /./ });


const allTokens = [WhiteSpace, MultiLineComment, OneLineComment, Struct, Attributes, CString, RoundBracketOpen, RoundBracketClose, SquareBracketOpen, SquareBracketClose, BracesOpen, BracesClose, Identifier, Comma, Semicolon, EqualOperator, ArrowOperator, Num, AnyToken];
const StructLexer = new Lexer(allTokens);

export class StructParser extends CstParser {
  constructor() {
    super(allTokens);

    const $ = this;
    
    this.initBracket(RoundBracketOpen, RoundBracketClose, 'bracketExpression');
    this.initBracket(SquareBracketOpen, SquareBracketClose, 'squareBracketExpression');
    this.initBracket(BracesOpen, BracesClose, 'bracesExpression');

    this.initAttributesDecl();
    this.initMemberDecl();
    this.initStructDecl();
    this.initStructDecls();
    //this.initAnyTokenConsumer('test', [BracesOpen, BracesClose]);

    this.performSelfAnalysis();
  }

  initAnyTokenConsumer(name, except = []) {
    const $ = this;
    $.RULE(name, () => {
      $.OR([
        ...allTokens.filter(e => !except.includes(e)).map(e => ({ ALT: () => $.CONSUME(e) })),
      ]);
    })
  }

  initBracket(op, cl, name, additionalSubrules = []) {
    const $ = this;
    $.RULE(name, () => {
      $.CONSUME(op);
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Identifier) },
          { ALT: () => $.CONSUME(Semicolon) },
          { ALT: () => $.CONSUME(CString) },
          { ALT: () => $.CONSUME(Comma) },
          { ALT: () => $.CONSUME(EqualOperator) },
          { ALT: () => $.CONSUME(Num) },
          { ALT: () => $.SUBRULE($[name]) },
          ...additionalSubrules.map(e => ({ ALT: () => $.SUBRULE($[e]) }))
        ]);
      });
      $.CONSUME(cl);
    });
  }

  initMemberDecl() {
    const $ = this;
    $.RULE('member', () => {
      $.OPTION1(() => {
        $.CONSUME1(OneLineComment);
      });
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Identifier) },
          { ALT: () => $.CONSUME(CString) },
          { ALT: () => $.CONSUME(Comma) },
          { ALT: () => $.CONSUME(EqualOperator) },
          { ALT: () => $.CONSUME(Num) },
          { ALT: () => $.SUBRULE($.bracketExpression) },
          { ALT: () => $.SUBRULE($.squareBracketExpression) },
        ]);
      });
      $.CONSUME(Semicolon);
    });
  }
  
  initAttributesDecl() {
    const $ = this;
    $.RULE('attributes', () => {
      $.CONSUME(Attributes);
      $.SUBRULE($.bracketExpression);
    });
  }

  initStructDecl() {
    const $ = this;
    $.RULE('struct', () => {
      $.OPTION1(() => {
        $.CONSUME(OneLineComment);
      });
      $.CONSUME(Struct);
      $.OPTION2(() => {
        $.SUBRULE1($.attributes);
      });
      $.CONSUME(Identifier);
      $.CONSUME(BracesOpen);
      $.MANY(() => {
        $.SUBRULE($.member);
      });
      $.CONSUME(BracesClose);
      $.OPTION3(() => {
        $.SUBRULE2($.attributes);
      });
      $.CONSUME(Semicolon);
    });
  }

  initStructDecls() {
    const $ = this;
    $.RULE('structs', () => {
      $.MANY(() => {
        $.SUBRULE($.struct);
      });
    });
  }
};

export const parserInstance = new StructParser();

export function parseInput(text, method = 'structs', verbose = false) {
  const lexingResult = StructLexer.tokenize(text);

  if (verbose) {
    console.log('[*] Lexing result', lexingResult.tokens);
  }

  parserInstance.input = lexingResult.tokens;

  const cstOutput = parserInstance[method]();
  return { cstOutput, text, lexingResult };
}

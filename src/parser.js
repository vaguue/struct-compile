import { createToken, CstParser, Lexer } from 'chevrotain';

import { matchType } from './dataTypes.js';

const WhiteSpace = createToken({ name: 'Whitespace', pattern: /[\s\n]+/, group: Lexer.SKIPPED, });
const MultiLineComment = createToken({ name: 'MultiLineComment', pattern: /\/\*.*?\*\//, group: Lexer.SKIPPED, });
const Const = createToken({ name: 'Const', pattern: /const/, group: Lexer.SKIPPED });
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
const TypeKeyword = createToken({ name: 'TypeKeyword', pattern: { exec: matchType }, line_breaks: true });
const Pointer = createToken({ name: 'Pointer', pattern: /\*/ });
const Identifier = createToken({ name: 'Identifier', pattern: /[_a-zA-Z][\w_]*/ });
const Comma = createToken({ name: 'Comma', pattern: /,/ });
const Semicolon = createToken({ name: 'Semicolon', pattern: /;/ });
const Num = createToken({ name: 'Num', pattern: /[0-9]+/ });
const AnyToken = createToken({ name: 'AnyToken', pattern: /./ });


const allTokens = [WhiteSpace, MultiLineComment, Const, Pointer, Semicolon, OneLineComment, RoundBracketOpen, RoundBracketClose, SquareBracketOpen, SquareBracketClose, BracesOpen, BracesClose, TypeKeyword, Struct, Attributes, CString, Identifier, Comma, Num, AnyToken];
const StructLexer = new Lexer(allTokens);

export class StructParser extends CstParser {
  constructor() {
    super(allTokens);

    const $ = this;
    
    this.initBracketLame(RoundBracketOpen, RoundBracketClose, 'bracketExpression');
    this.initSquareBracket();

    this.initAttributesDecl();
    this.initMemberName();
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

  initBracketLame(op, cl, name, additionalSubrules = []) {
    const $ = this;
    $.RULE(name, () => {
      $.CONSUME(op);
      $.MANY(() => {
        $.OR([
          { ALT: () => $.CONSUME(Identifier) },
          { ALT: () => $.CONSUME(Semicolon) },
          { ALT: () => $.CONSUME(CString) },
          { ALT: () => $.CONSUME(Comma) },
          { ALT: () => $.CONSUME(Num) },
          { ALT: () => $.SUBRULE($[name]) },
          ...additionalSubrules.map(e => ({ ALT: () => $.SUBRULE($[e]) }))
        ]);
      });
      $.CONSUME(cl);
    });
  }

  initSquareBracket() {
    const $ = this;
    $.RULE('squareBracketExpression', () => {
      $.CONSUME(SquareBracketOpen);
      $.MANY(() => {
        $.CONSUME(Num);
      });
      $.CONSUME(SquareBracketClose);
    });
  }

  initMemberName() {
    const $ = this;
    $.RULE('memberName', () => {
      $.CONSUME(Identifier);
      $.MANY(() => {
        $.SUBRULE($.squareBracketExpression);
      });
    });
  }

  initMemberDecl() {
    const $ = this;
    $.RULE('member', () => {
      $.OPTION1(() => {
        $.CONSUME1(OneLineComment);
      });
      $.CONSUME(TypeKeyword);
      $.MANY1(() => {
        $.CONSUME(Pointer);
      });
      $.SUBRULE1($.memberName);
      $.MANY2(() => {
        $.CONSUME(Comma);
        $.SUBRULE2($.memberName);
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

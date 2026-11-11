import { createToken, CstParser, Lexer } from 'chevrotain';

import { StructLexer, tokens, allTokens } from './lexer.js';

export class StructParser extends CstParser {
  constructor() {
    super(allTokens);

    const $ = this;
    
    this.initBracketLame(tokens.RoundBracketOpen, tokens.RoundBracketClose, 'bracketExpression');
    this.initSquareBracket();

    this.initAttributesDecl();
    this.initMemberName();
    this.initNestedDecl();
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
          { ALT: () => $.CONSUME(tokens.Identifier) },
          { ALT: () => $.CONSUME(tokens.Semicolon) },
          { ALT: () => $.CONSUME(tokens.CString) },
          { ALT: () => $.CONSUME(tokens.Comma) },
          { ALT: () => $.CONSUME(tokens.Num) },
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
      $.CONSUME(tokens.SquareBracketOpen);
      $.MANY(() => {
        $.CONSUME(tokens.Num);
      });
      $.CONSUME(tokens.SquareBracketClose);
    });
  }

  initMemberName() {
    const $ = this;
    $.RULE('memberName', () => {
      $.CONSUME(tokens.Identifier);
      $.OPTION1(() => {
        $.OR([
          { 
            ALT: () => {
              $.CONSUME(tokens.Colon);
              $.CONSUME(tokens.Num);
            },
          },
          { 
            ALT: () => {
              $.MANY(() => {
                $.SUBRULE($.squareBracketExpression);
              });
            },
          },
        ])
      });
    });
  }

  // `struct Name`, `union Name` or an inline `struct [Name] { ... }` used as a member type
  initNestedDecl() {
    const $ = this;
    $.RULE('nested', () => {
      $.OR([
        { ALT: () => $.CONSUME(tokens.Struct) },
        { ALT: () => $.CONSUME(tokens.Union) },
      ]);
      $.OPTION1(() => {
        $.SUBRULE1($.attributes);
      });
      $.OPTION2(() => {
        $.CONSUME(tokens.Identifier);
      });
      $.OPTION3(() => {
        $.CONSUME(tokens.BracesOpen);
        $.MANY(() => {
          $.SUBRULE($.member);
        });
        $.CONSUME(tokens.BracesClose);
        $.OPTION4(() => {
          $.SUBRULE2($.attributes);
        });
      });
    });
  }

  initMemberDecl() {
    const $ = this;
    $.RULE('member', () => {
      $.OPTION1(() => {
        $.CONSUME1(tokens.OneLineComment);
      });
      $.OR([
        { ALT: () => $.CONSUME(tokens.TypeKeyword) },
        { ALT: () => $.SUBRULE($.nested) },
      ]);
      $.MANY1(() => {
        $.CONSUME(tokens.Pointer);
      });
      // names are optional for anonymous struct / union members
      $.OPTION2(() => {
        $.SUBRULE1($.memberName);
        $.MANY2(() => {
          $.CONSUME(tokens.Comma);
          $.SUBRULE2($.memberName);
        });
      });
      $.CONSUME(tokens.Semicolon);
    });
  }
  
  initAttributesDecl() {
    const $ = this;
    $.RULE('attributes', () => {
      $.CONSUME(tokens.Attributes);
      $.SUBRULE($.bracketExpression);
    });
  }

  initStructDecl() {
    const $ = this;
    $.RULE('struct', () => {
      $.OPTION1(() => {
        $.CONSUME(tokens.OneLineComment);
      });
      $.OR([
        { ALT: () => $.CONSUME(tokens.Struct) },
        { ALT: () => $.CONSUME(tokens.Union) },
      ]);
      $.OPTION2(() => {
        $.SUBRULE1($.attributes);
      });
      $.CONSUME(tokens.Identifier);
      $.CONSUME(tokens.BracesOpen);
      $.MANY(() => {
        $.SUBRULE($.member);
      });
      $.CONSUME(tokens.BracesClose);
      $.OPTION3(() => {
        $.SUBRULE2($.attributes);
      });
      $.CONSUME(tokens.Semicolon);
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

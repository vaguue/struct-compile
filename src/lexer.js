import { createToken, Lexer } from 'chevrotain';

import { matchType } from './dataTypes.js';

export const allTokens = [];

const addToken = (tk) => {
  const res = createToken(tk);
  allTokens.push(res);
  return res;
}

export const tokens = {};

tokens.WhiteSpace = addToken({ name: 'Whitespace', pattern: /[\s\n]+/, group: Lexer.SKIPPED, });
tokens.MultiLineComment = addToken({ name: 'MultiLineComment', pattern: /\/\*.*?\*\//, group: Lexer.SKIPPED, });
tokens.Const = addToken({ name: 'Const', pattern: /const/, group: Lexer.SKIPPED });
tokens.Pointer = addToken({ name: 'Pointer', pattern: /\*/ });
tokens.Semicolon = addToken({ name: 'Semicolon', pattern: /;/ });
tokens.Colon = addToken({ name: 'Colon', pattern: /:/ });
tokens.OneLineComment = addToken({ name: 'OneLineComment', pattern: /\/\/.*?\n/ });
tokens.RoundBracketOpen = addToken({ name: 'RoundBracketOpen', pattern: /\(/ });
tokens.RoundBracketClose = addToken({ name: 'RoundBracketClose', pattern: /\)/ });
tokens.SquareBracketOpen = addToken({ name: 'SquareBracketOpen', pattern: /\[/ });
tokens.SquareBracketClose = addToken({ name: 'SquareBracketClose', pattern: /\]/ });
tokens.BracesOpen = addToken({ name: 'BracesOpen', pattern: /\{/ });
tokens.BracesClose = addToken({ name: 'BracesClose', pattern: /\}/ });
tokens.TypeKeyword = addToken({ name: 'TypeKeyword', pattern: { exec: matchType }, line_breaks: true });
tokens.Struct = addToken({ name: 'Struct', pattern: /struct/ });
tokens.Attributes = addToken({ name: 'Attributes', pattern: /__attribute__/ });
tokens.CString = addToken({ name: 'CString', pattern: /"([^"]*)"/ });
tokens.Identifier = addToken({ name: 'Identifier', pattern: /[_a-zA-Z][\w_]*/ });
tokens.Comma = addToken({ name: 'Comma', pattern: /,/ });
tokens.Num = addToken({ name: 'Num', pattern: /[0-9]+/ });
tokens.AnyToken = addToken({ name: 'AnyToken', pattern: /./ });

export const StructLexer = new Lexer(allTokens);

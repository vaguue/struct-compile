import { isWhitespace, skipWhitespace } from './whitespace.js';

class TrieNode {
  constructor(value) {
    this.value = value;
    this.children = {};
    this.isEnd = false;
  }
}

export class Trie {
  constructor() {
    this.root = new TrieNode('');
  }

  add(text) {
    let current = this.root;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (!current.children[ch]) {
        current.children[ch] = new TrieNode(ch);
      }
      current = current.children[ch];
    }
    current.isEnd = true;
  }

  search(text, startOffset) {
    const n = text.length;
    let current = this.root;
    let res = null;
    let i = skipWhitespace(text, startOffset);
    if (i == n) return res;

    for (; i < text.length; i++) {
      const ch = text[i];
      if (!current.children[ch]) {
        return res;
      }
      current = current.children[ch];
      if (isWhitespace(current.value)) {
        i = skipWhitespace(text, i) - 1;
      }
      if (current.isEnd) {
        res = [text.slice(startOffset, i + 1)];
      }
    }
    return res;
  }
}

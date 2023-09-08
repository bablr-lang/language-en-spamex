import * as regex from '@bablr/miniparser-language-nonbacktracking-js-regex';

const { isArray } = Array;

const _ = /\s+/y;

const node = Symbol.for('@bablr/node');

function parseString(raw) {
  let cooked = '';
  let escaped = false;

  for (const chr of raw) {
    if (chr === '\\') {
      escaped = true;
    } else {
      if (escaped) {
        // TODO: do escape processing things
        escaped = false;
      } else {
        cooked += chr;
      }
    }
  }
  return cooked;
}

export class SpamexMiniparserGrammar {
  constructor() {
    this.aliases = new Map([
      [
        node,
        new Set([
          'TokenMatcher',
          'NodeMatcher',
          'AttributeMatcher',
          'Argument',
          'StringMatcher',
          'RegexMatcher',
          'Expression',
        ]),
      ],
      ['Expression', new Set(['TokenMatcher', 'NodeMatcher', 'StringMatcher', 'RegexMatcher'])],
    ]);
  }

  // @Node
  Expression(p) {
    if (p.match('<|[')) {
      throw new Error('gap token syntax is illegal in grammar definitions');
    } else if (p.match('<|') || p.match('<| |>')) {
      return p.eatProduction('TokenMatcher');
    } else if (p.match(/<(?:\w|$)/y)) {
      return p.eatProduction('NodeMatcher');
    } else if (p.match(/['"]/y)) {
      return p.eatProduction('StringMatcher');
    } else if (p.match('/')) {
      return p.eatProduction('RegexMatcher');
    } else {
      throw new Error(`Unexpected character ${p.chr}`);
    }
  }

  // @Node
  TokenMatcher(p) {
    p.eat('<|', { startSpan: 'Tag', balanced: '|>' });
    p.eatMatch(_);

    if (p.eatMatch('|>', { endSpan: 'Tag' })) {
      return { tagType: 'Trivia', value: undefined, attrs: [] };
    }

    const tagType = p.eatProduction('Identifier');

    let sp = p.eatMatch(_);

    let value = null;
    if (sp && (/['"]/y.test(p.chr) || (p.atQuasi && p.quasi.type === 'StringMatcher'))) {
      value = p.eatProduction('StringMatcher');
    } else if (sp && (p.chr === '/' || (p.atQuasi && p.quasi.type === 'RegexMatcher'))) {
      value = p.eatProduction('RegexMatcher');
    }

    sp = value ? p.eatMatch(_) : sp;

    const attrs = sp ? p.eatProduction('AttributeMatchers') : [];

    sp = attrs.length ? p.eatMatch(_) : sp;

    const args = sp && p.match('{') ? p.eatProduction('Arguments') : [];

    p.eatMatch(_);
    p.eat('|>', { endSpan: 'Tag' });

    return { tagType, value, attrs, args };
  }

  // @Node
  NodeMatcher(p) {
    p.eat('<', { startSpan: 'Tag', balanced: '>' });

    const tagType = p.eatProduction('Identifier');

    let sp = p.eatMatch(_);

    const attrs = sp ? p.eatProduction('AttributeMatchers') : [];

    sp = attrs.length ? p.eatMatch(_) : sp;

    const args = sp && p.match('{') ? p.eatProduction('Arguments') : [];

    p.eatMatch(_);
    p.eat('>', { endSpan: 'Tag' });

    return { tagType, attrs, args };
  }

  AttributeMatchers(p) {
    const matchers = [];
    let sp = true;
    while (
      sp &&
      (p.match(/\w+/y) || (p.atQuasi && (isArray(p.quasi) || p.quasi.type === 'AttributeMatcher')))
    ) {
      matchers.push(...p.eatProductions('AttributeMatcher'));
      sp = p.eatMatch(/\s+/y);
    }
    if (sp && typeof sp === 'string') {
      p.chuck(sp);
    }
    return matchers;
  }

  // @Node
  AttributeMatcher(p) {
    const key = p.eat(/\w+/y);
    p.eatMatch(_);
    p.eat('=');
    p.eatMatch(_);
    const str = p.eatProduction('String');

    return { key, value: str.value };
  }

  Arguments(p) {
    const args = [];

    const aQuote = p.match('{[');

    const oQuote = aQuote ? '{[' : '{';
    const cQuote = aQuote ? ']}' : '}';
    const spanSuffix = aQuote ? ':Expressions' : '';
    const span = `Tag:Arguments${spanSuffix}`;

    p.eat(oQuote, { balanced: cQuote, startSpan: span });

    p.eatMatch(_);

    let first = true;
    while ((first || p.eatMatch(/\s*,\s*/y)) && !p.done) {
      args.push(...p.eatProductions(aQuote ? 'Expression' : 'Argument'));
      first = false;
    }

    p.eatMatch(_);

    p.eat(cQuote, { endSpan: span });

    return aQuote ? [p.node('Argument', { key: 'expressions', value: args })] : args;
  }

  // @Node
  Argument(p) {
    const key = p.eat(/\w+/y);
    p.eatMatch(_);
    p.eat(':');
    p.eatMatch(_);
    const value = p.eatProduction('Expression');

    return { key, value };
  }

  Identifier(p) {
    return p.eat(/\w+/y);
  }

  // @Node
  StringMatcher(p) {
    return p.eatProduction('String');
  }

  String(p) {
    const q = p.eat(/['"]/y);

    const raw = p.eatMatch(q === '"' ? /[^\n"]*/y : /[^\n']*/y);

    p.eat(q);

    return { value: parseString(raw) };
  }

  // @Node
  RegexMatcher(p) {
    p.pushLanguage(regex);
    p.eat('/', { startSpan: 'Expression', balanced: '/' });
    const pattern = p.eatProduction('Pattern');
    p.eat('/', { endSpan: 'Expression' });
    const flags = p.eatProduction('Flags');
    p.popLanguage();
    return { pattern, flags: { ...flags, sticky: true } };
  }
}

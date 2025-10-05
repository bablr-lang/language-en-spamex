import { re, spam as m } from '@bablr/boot';
import * as productions from '@bablr/helpers/productions';
import { o, eat, eatMatch, match } from '@bablr/helpers/grammar';
import * as Regex from '@bablr/language-en-regex-vm-pattern';
import * as CSTML from '@bablr/language-en-cstml';
import * as JSON from '@bablr/language-en-cstml-json';
import * as Space from '@bablr/language-en-blank-space';
import { buildString } from '@bablr/helpers/builders';

export const canonicalURL = 'https://bablr.org/languages/core/en/spamex';

export const dependencies = { Regex, CSTML, JSON, Space };

export const defaultMatcher = m`<_Matcher />`;

const { eatMatchTrivia } = CSTML;

export const grammar = class SpamexGrammar {
  constructor() {
    this.literals = new Set(['Punctuator']);
  }

  *Matcher() {
    if (yield eatMatch(m`<PropertyMatcher /[a-zA-Z.@#<:]/ />`)) {
    } else {
      yield eat(m`<_StringMatcher /[/'"]/ />`);
    }
  }

  *NodeMatcher() {
    if (yield eatMatch(m`<GapNodeMatcher '<//>' />`)) {
    } else if (yield eatMatch(m`<BasicNodeMatcher '<' />`)) {
    } else {
      yield eat(m`<NullNodeMatcher 'null' />`);
    }
  }

  *GapNodeMatcher() {
    yield eat(m`sigilToken: <*Punctuator '<//>' />`);
  }

  *NullNodeMatcher() {
    yield eat(m`sigilToken: <*Punctuator 'null' />`);
  }

  *PropertyMatcher() {
    yield eatMatch(m`refMatcher: <ReferenceMatcher />`);
    yield* eatMatchTrivia();
    yield eatMatch(m`bindingMatcher: <BindingMatcher />`);
    yield* eatMatchTrivia();
    yield eat(m`nodeMatcher: <_NodeMatcher />`);
  }

  *ReferenceMatcher({ ctx }) {
    let type;
    if ((type = yield match(re`/[.#@]/`))) {
      yield eat(m`type: <*Punctuator ${buildString(ctx.sourceTextFor(type))} />`);
    }

    if (!type || ctx.sourceTextFor(type) === '#') {
      if (type) {
        yield eatMatch(m`name$: :CSTML: <Identifier />`);
      } else {
        yield eat(m`type: null`);
        yield eat(m`name$: :CSTML: <Identifier />`);
      }
    } else {
      yield eat(m`name$: null`);
    }

    if (yield eatMatch(m`openIndexToken: <*Punctuator '[' { balanced: ']' } />`)) {
      yield* eatMatchTrivia();
      yield eatMatch(m`closeIndexToken: <*Punctuator ']' { balancer: true } />`);
    } else {
      yield eatMatch(m`closeIndexToken: null`);
    }

    yield* eatMatchTrivia();
    yield eatMatch(m`flags: :CSTML: <ReferenceFlags />`);
    yield* eatMatchTrivia();
    yield eat(m`sigilToken: <*Punctuator ':' />`);
  }

  *BindingMatcher() {
    yield eat(m`sigilToken: <*Punctuator ':' />`);
    yield* eatMatchTrivia();
    yield eat(m`languagePath: :CSTML: <IdentifierPath />`);
    yield* eatMatchTrivia();
    yield eat(m`sigilToken: <*Punctuator ':' />`);
  }

  *BasicNodeMatcher() {
    let open = yield eat(m`open: <OpenNodeMatcher />`);

    const selfClosing = open.get('selfClosingToken');

    if (selfClosing) {
      yield eat(m`close: null`);
    } else {
      // TODO
      yield* eatMatchTrivia();

      yield eat(m`close: <CloseNodeMatcher />`);
    }
  }

  *OpenNodeMatcher() {
    yield eat(m`openToken: <*Punctuator '<' { balancedSpan: 'Tag', balanced: '>' } />`);
    yield eat(m`flags: :CSTML: <NodeFlags />`);

    if (yield eatMatch(m`type$: :CSTML: <Identifier /[a-zA-Z\u{80}-\u{10ffff}\u0060\g]/ />`)) {
      // continue
    }

    let sp = yield* eatMatchTrivia();

    if (sp && !(yield match(re`/\/$/`)) && (yield eatMatch(m`literalValue$: <_StringMatcher />`))) {
      sp = yield* eatMatchTrivia();
    }

    while (sp && (yield match('{'))) {
      yield eat(m`attributes: :JSON: <Object />`);
      sp = yield* eatMatchTrivia();
    }

    yield eatMatch(m`selfClosingToken: <*Punctuator '/' />`);
    yield eat(m`closeToken: <*Punctuator '>' { balancer: true } />`);
  }

  *CloseNodeMatcher() {
    yield eat(m`openToken: <*Punctuator '</' { balanced: '>' } />`);
    yield eat(m`closeToken: <*Punctuator '>' { balancer: true } />`);
  }

  *StringMatcher() {
    if (yield match(re`/['"]/`)) {
      yield eat(m`<String />`);
    } else {
      yield eat(m`<Regex />`);
    }
  }

  *String() {
    yield eat(m`:JSON: <__String />`);
  }

  *Regex() {
    yield eat(m`:Regex: <__Pattern />`);
  }

  List(args) {
    return productions.List(args);
  }
};

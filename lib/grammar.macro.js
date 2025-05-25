import { re, spam as m } from '@bablr/boot';
import { Node, CoveredBy, InjectFrom, Literal } from '@bablr/helpers/decorators';
import * as productions from '@bablr/helpers/productions';
import { eat, eatMatch, match, fail } from '@bablr/helpers/grammar';
import * as Regex from '@bablr/language-en-regex-vm-pattern';
import * as CSTML from '@bablr/language-en-cstml';
import * as JSON from '@bablr/language-en-cstml-json';
import * as Space from '@bablr/language-en-blank-space';

export const canonicalURL = 'https://bablr.org/languages/core/en/spamex';

export const dependencies = { Regex, CSTML, JSON, Space };

const { eatMatchTrivia } = CSTML;

export const grammar = class SpamexGrammar {
  @CoveredBy('Expression')
  *Matcher() {
    yield eat(m`<_Any />`, [m`<PropertyMatcher /[a-zA-Z.@#<]/ />`, m`<__StringMatcher /[/'"]/ />`]);
  }

  *NodeMatcher() {
    yield eat(m`<_Any />`, [
      m`<GapNodeMatcher '<//>' />`,
      m`<BasicNodeMatcher '<' />`,
      m`<ArrayNodeMatcher '[' />`,
      m`<NullNodeMatcher 'null' />`,
    ]);
  }

  @Node
  @CoveredBy('NodeMatcher')
  *GapNodeMatcher() {
    yield eat(m`sigilToken: <*Punctuator '<//>' />`);
  }

  @Node
  @CoveredBy('NodeMatcher')
  *ArrayNodeMatcher() {
    yield eat(m`sigilToken: <*Punctuator '[]' />`);
  }

  @Node
  @CoveredBy('NodeMatcher')
  *NullNodeMatcher() {
    yield eat(m`sigilToken: <*Punctuator 'null' />`);
  }

  @Node
  @CoveredBy('Matcher')
  *PropertyMatcher() {
    yield eatMatch(m`refMatcher: <ReferenceMatcher />`);
    yield* eatMatchTrivia();
    yield eatMatch(m`bindingMatcher: <BindingMatcher />`);
    yield* eatMatchTrivia();
    yield eat(m`nodeMatcher: <__NodeMatcher />`);
  }

  @Node
  *ReferenceMatcher() {
    if (yield match(re`/[.#@]/`)) {
      yield eat(m`type: <*Punctuator /[.#@]/ />`);
      yield eat(m`name$: null`);
    } else {
      yield eat(m`type: null`);
      yield eat(m`name$: :CSTML: <Identifier />`);
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

  @Node
  *BindingMatcher() {
    yield eat(m`sigilToken: <*Punctuator ':' />`);
    yield* eatMatchTrivia();
    yield eat(m`languagePath: :CSTML: <IdentifierPath />`);
    yield* eatMatchTrivia();
    yield eat(m`sigilToken: <*Punctuator ':' />`);
  }

  @Node
  @CoveredBy('NodeMatcher')
  *BasicNodeMatcher() {
    let open = yield eat(m`open: <OpenNodeMatcher />`);

    const selfClosing = open.get('selfClosingTagToken');

    if (selfClosing) {
      yield eat(m`children[]$: []`);
      yield eat(m`close: null`);
    } else {
      // TODO
      yield* eatMatchTrivia();

      yield eat(m`close: <CloseNodeMatcher />`);
    }
  }

  @Node
  *OpenNodeMatcher() {
    yield eat(m`openToken: <*Punctuator '<' { balancedSpan: 'Tag', balanced: '>' } />`);
    let flags = yield eat(m`flags: :CSTML: <NodeFlags />`);

    if (yield eatMatch(m`type$: :CSTML: <Identifier /[a-zA-Z\u{80}-\u{10ffff}\u0060\g]/ />`)) {
      // continue
    } else if (!flags.get('fragmentToken')) {
      if (yield eatMatch(m`type$: <*Punctuator '?' />`)) {
        // continue
      } else {
        yield fail();
      }
    }

    let sp = yield* eatMatchTrivia();

    if (
      sp &&
      !(yield match(re`/\/$/`)) &&
      (yield eatMatch(m`intrinsicValue$: <__StringMatcher />`))
    ) {
      sp = yield* eatMatchTrivia();
    }

    while (sp && (yield match('{'))) {
      yield eat(m`attributes: :JSON: <Object />`);
      sp = yield* eatMatchTrivia();
    }

    yield eatMatch(m`selfClosingTagToken: <*Punctuator '/' />`);
    yield eat(m`closeToken: <*Punctuator '>' { balancer: true } />`);
  }

  @Node
  @CoveredBy('Matcher')
  *CloseNodeMatcher() {
    yield eat(m`openToken: <*Punctuator '</' { balanced: '>' } />`);
    yield eat(m`closeToken: <*Punctuator '>' { balancer: true } />`);
  }

  @CoveredBy('Matcher')
  @CoveredBy('Expression')
  *StringMatcher() {
    if (yield match(re`/['"]/`)) {
      yield eat(m`<String />`);
    } else {
      yield eat(m`<Regex />`);
    }
  }

  @CoveredBy('StringMatcher')
  @CoveredBy('Matcher')
  @CoveredBy('Expression')
  @Node
  *String() {
    yield eat(m`:JSON: <_String />`);
  }

  @CoveredBy('StringMatcher')
  @CoveredBy('Matcher')
  @CoveredBy('Expression')
  @Node
  *Regex() {
    yield eat(m`:Regex: <_Pattern />`);
  }

  @InjectFrom(productions)
  List() {}

  @Literal
  @Node
  @InjectFrom(productions)
  Punctuator() {}

  @InjectFrom(productions)
  Any() {}
};

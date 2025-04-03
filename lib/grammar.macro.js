import { re, spam as m } from '@bablr/boot';
import { Node, CoveredBy, InjectFrom, Literal } from '@bablr/helpers/decorators';
import * as productions from '@bablr/helpers/productions';
import { eat, eatMatch, match, fail } from '@bablr/helpers/grammar';
import * as Regex from '@bablr/language-en-regex-vm-pattern';
import * as CSTML from '@bablr/language-en-cstml';
import * as JSON from '@bablr/language-en-cstml-json';
import * as Space from '@bablr/language-en-blank-space';
import { notNull } from '@bablr/agast-helpers/tree';

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
    yield eat(m`nodeMatcher: <__NodeMatcher />`);
  }

  @Node
  *ReferenceMatcher() {
    let name;
    if (yield match(re`/[.#@]/`)) {
      name = yield eatMatch(m`name$: <*Punctuator /[.#@]/ />`);
    } else {
      name = yield eatMatch(m`name$: <CSTML:Identifier />`);
    }

    if (name && (yield eatMatch(m`openIndexToken: <*Punctuator '[' { balanced: ']' } />`))) {
      yield* eatMatchTrivia();
      yield eatMatch(m`closeIndexToken: <*Punctuator ']' { balancer: true } />`);
    } else {
      yield eatMatch(m`closeIndexToken: null`);
    }

    yield* eatMatchTrivia();
    yield eatMatch(m`flags: <CSTML:ReferenceFlags />`);
    yield* eatMatchTrivia();
    yield eat(m`sigilToken: <*Punctuator ':' />`);
  }

  @Node
  @CoveredBy('NodeMatcher')
  *BasicNodeMatcher() {
    let open = yield eat(m`open: <OpenNodeMatcher />`);

    const selfClosing = notNull(open.get('selfClosingTagToken'));

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
    yield eat(m`open: <*Punctuator '<' { balancedSpan: 'Tag', balanced: '>' } />`);
    yield eat(m`flags: <CSTML:NodeFlags />`);

    if (yield eatMatch(m`<_CSTML:TagType /[a-zA-Z'"\g]/ />`)) {
      // continue
    } else if (yield eatMatch(m`type$: <*Punctuator /[ \t]+|?/ />`)) {
      // continue
    } else {
      yield fail();
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
      yield eat(m`attributes: <JSON:Object />`);
      sp = yield* eatMatchTrivia();
    }

    yield eatMatch(m`selfClosingTagToken: <*Punctuator '/' />`);
    yield eat(m`close: <*Punctuator '>' { balancer: true } />`);
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
    yield eat(m`<_JSON:String />`);
  }

  @CoveredBy('StringMatcher')
  @CoveredBy('Matcher')
  @CoveredBy('Expression')
  @Node
  *Regex() {
    yield eat(m`<_Regex:Pattern />`);
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

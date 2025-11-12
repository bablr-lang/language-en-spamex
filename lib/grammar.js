import { re, spam as m } from '@bablr/boot';
import { eat, eatMatch, exec, match } from '@bablr/helpers/grammar';
import Regex from '@bablr/language-en-regex-vm-pattern';
import { default as CSTML, eatMatchTrivia } from '@bablr/language-en-cstml';
import JSON from '@bablr/language-en-cstml-json';
import Space from '@bablr/language-en-blank-space';
import { buildString } from '@bablr/helpers/builders';
import { get, printSource } from '@bablr/agast-helpers/tree';

export const canonicalURL = 'https://bablr.org/languages/core/en/spamex';

export const dependencies = { Regex, CSTML, JSON, Space };

export const defaultMatcher = m`<_Matcher />`;

export const grammar = class SpamexGrammar {
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
    yield eat(m`sigilToken*: <* '<//>' />`);
  }

  *NullNodeMatcher() {
    yield eat(m`sigilToken*: <* 'null' />`);
  }

  *PropertyMatcher() {
    yield eatMatch(m`refMatcher$: <ReferenceMatcher />`);
    yield* eatMatchTrivia();
    yield eatMatch(m`bindingMatcher$: <BindingMatcher />`);
    yield* eatMatchTrivia();
    yield eat(m`nodeMatcher$: <_NodeMatcher />`);
  }

  *ReferenceMatcher() {
    let type;
    if ((type = yield match(re`/\.\.|[.#@]/`))) {
      yield eat(m`type*: <* ${buildString(printSource(type))} />`);
    }

    if (!type || printSource(type) === '#') {
      if (type) {
        yield eatMatch(m`name$: :CSTML: <Identifier />`);
      } else {
        yield eat(m`type*: null`);
        yield eat(m`name$: :CSTML: <Identifier />`);
      }
    } else {
      yield eat(m`name$: null`);
    }

    if (yield eatMatch(m`openIndexToken*: <* '[' { balanced: ']' } />`)) {
      yield* eatMatchTrivia();
      yield eatMatch(m`closeIndexToken*: <* ']' { balancer: true } />`);
    } else {
      yield eatMatch(m`closeIndexToken*: null`);
    }

    yield* eatMatchTrivia();
    yield eatMatch(m`flags*: :CSTML: <ReferenceFlags />`);
    yield* eatMatchTrivia();
    yield eat(m`sigilToken*: <* ':' />`);
  }

  *BindingMatcher() {
    while (yield eatMatch(m`segments[]*: :CSTML: <BindingSegment ':' />`));
  }

  *BasicNodeMatcher() {
    let open = yield eat(m`open*: <OpenNodeMatcher />`);

    const selfClosing = get('selfClosingToken', open.node);

    if (selfClosing) {
      yield eat(m`close*: null`);
    } else {
      // TODO
      yield* eatMatchTrivia();

      yield eat(m`close*: <CloseNodeMatcher />`);
    }
  }

  *OpenNodeMatcher() {
    yield eat(m`openToken*: <* '<' { balancedSpan: 'Tag', balanced: '>' } />`);
    yield eat(m`flags*: :CSTML: <NodeFlags />`);

    if (yield eatMatch(m`type$: :CSTML: <Identifier /[a-zA-Z\u{80}-\u{10ffff}\u0060\g]/ />`)) {
      // continue
    }

    let sp = yield* eatMatchTrivia();

    if (sp && !(yield match(re`/\/$/`)) && (yield eatMatch(m`literalValue$: <_StringMatcher />`))) {
      sp = yield* eatMatchTrivia();
    }

    while (sp && (yield match('{'))) {
      yield eat(m`attributes$: :JSON: <Object />`);
      sp = yield* eatMatchTrivia();
    }

    yield eatMatch(m`selfClosingToken*: <* '/' />`);
    yield eat(m`closeToken*: <* '>' { balancer: true } />`);
  }

  *CloseNodeMatcher() {
    yield eat(m`openToken*: <* '</' { balanced: '>' } />`);
    yield eat(m`closeToken*: <* '>' { balancer: true } />`);
  }

  *StringMatcher() {
    if (yield match(re`/['"]/`)) {
      yield eat(m`<String />`);
    } else {
      yield eat(m`<Regex />`);
    }
  }

  *String() {
    yield* yield exec(m`:JSON: <__String />`);
  }

  *Regex() {
    yield* yield exec(m`:Regex: <__Pattern />`);
  }
};

export default { canonicalURL, dependencies, grammar, defaultMatcher };

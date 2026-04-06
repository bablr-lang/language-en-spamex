import { m } from '@bablr/boot';
import { eat, eatMatch, fail, match, defineAttribute, o } from '@bablr/helpers/grammar';
import Regex from '@bablr/language-en-regex-vm-pattern';
import { default as CSTML, eatMatchTrivia } from '@bablr/language-en-cstml';
import JSON from '@bablr/language-en-cstml-json';
import Space from '@bablr/language-en-blank-space';
import { buildString } from '@bablr/helpers/builders';
import { printSource } from '@bablr/agast-helpers/tree';
import * as BMap from '@bablr/agast-helpers/b-map';
import { freeze } from '@bablr/agast-helpers/object';

let { entry } = BMap;

export default class Spamex {
  static canonicalURL = 'https://bablr.org/languages/core/en/spamex';
  static dependencies = freeze({ Regex, CSTML, JSON, Space });
  static defaultMatcher = m`<_Matcher />`;
  static fragmentProduction = 'Fragment';
  static context = freeze({});

  constructor() {
    this.attributes = BMap.from(entry('TreeNodeMatcherOpen', { selfClosing: undefined }));
  }

  *Fragment({ props: { rootMatcher } }) {
    yield* eatMatchTrivia();
    yield eat(rootMatcher);
    yield* eatMatchTrivia();
  }

  *Matcher({ s }) {
    if (s().source.atGap()) {
      yield eat(m`<PropertyMatcher />`);
      return;
    }

    let chrs = yield match(m`/:|\<\/\/?\>|\<|null|['"/]/`);

    switch (printSource(chrs)) {
      case '<//>':
        yield eat(m`<GapNodeMatcher />`);
        break;
      case '</>':
        yield fail();
        break;
      case '"':
      case "'":
      case '/':
        yield eat(m`<StringMatcher />`);
        break;
      case 'null':
        yield eat(m`<NullNodeMatcher />`);
        break;
      case '<':
      default:
        yield eat(m`<PropertyMatcher />`);
        break;
    }
  }

  *BoundNodeMatcher() {
    while (yield eatMatch(m`bindingMatchers[]: <BindingMatcher ':' />`));

    yield eat(m`nodeMatcher: <_NodeMatcher />`);
  }

  *PropertyMatcher() {
    yield eatMatch(m`refMatcher$: <ReferenceMatcher /[.#@_a-zA-Z\u0060\u{80}-\u{10ffff}]/ />`);
    yield* eatMatchTrivia();
    yield eat(m`valueMatcher$: <BoundNodeMatcher />`);
  }

  *NodeMatcher() {
    let chrs = yield match(m`/:|\<\/\/?\>|\<|null|['"/]/`);
    switch (printSource(chrs)) {
      case '<//>':
        yield eat(m`<GapNodeMatcher />`);
        break;
      case '</>':
        yield fail();
        break;
      case '<':
      case '"':
      case "'":
      case '/':
        yield eat(m`<TreeNodeMatcher />`);
        break;
      case 'null':
        yield eat(m`<NullNodeMatcher />`);
        break;
      default:
        yield eat(m`<TreeNodeMatcher />`);
        break;
    }
  }

  *GapNodeMatcher() {
    yield eat(m`sigilToken*: <* '<//>' />`);
  }

  *NullNodeMatcher() {
    yield eat(m`sigilToken*: <* 'null' />`);
  }

  *ReferenceMatcher() {
    let type;
    if ((type = yield match(m`/\.\.|[.#@]/`))) {
      yield eat(m`type*: <* ${buildString(printSource(type))} />`);
    }

    if (!type || printSource(type) === '#') {
      if (type) {
        yield eatMatch(m`name$: :CSTML: <Identifier />`);
      } else {
        yield eat(m`name$: :CSTML: <Identifier />`);
      }
    } else {
      yield eat(m`name$: null`);
    }

    yield* eatMatchTrivia();
    yield eatMatch(m`flags*: :CSTML: <ReferenceFlags />`);
    yield* eatMatchTrivia();
    yield eat(m`sigilToken*: <* ':' />`);
  }

  *BindingMatcher() {
    yield eat(m`bindingMatcher*: :CSTML: <BindingTag />`);
    yield* eatMatchTrivia();
    yield eat(m`valueMatcher+$: <_ />`);
  }

  *TreeNodeMatcher() {
    if (yield match(m`/['"/]/`)) {
      do {
        yield eat(m`children[]$: <_StringMatcher />`);
        yield* eatMatchTrivia();
      } while (yield match(m`/['"/]/`));

      return;
    }

    if (yield eatMatch(m`children[]$: <PropertyMatcher /[a-zA-Z.#@\g]/ />`)) {
      return;
    }

    let open = yield eat(m`open*: <TreeNodeMatcherOpen />`);

    const { selfClosing } = open.node.value.attributes;

    if (selfClosing) {
      yield eat(m`close*: null`);
    } else {
      // TODO
      yield* eatMatchTrivia();

      yield eat(m`close*: <TreeNodeMatcherClose />`);
    }
  }

  *TreeNodeMatcherOpen() {
    yield eat(m`openToken*: <* '<' />`);
    yield eat(m`flags*: :CSTML: <NodeFlags />`);
    let type = yield eatMatch(m`type*: <* /__?/ />`);

    let isMultiFragment = type && printSource(type.node) === '__';

    if (yield eatMatch(m`name$: :CSTML: <Identifier /[a-zA-Z\u{80}-\u{10ffff}\u0060\g]/ />`)) {
      // continue
    }

    let sp = yield* eatMatchTrivia();

    if (
      sp &&
      !(yield match(m`'/>'`)) &&
      (yield eatMatch(m`literalValue$: <_StringMatcher /['"/]/ />`))
    ) {
      sp = yield* eatMatchTrivia();
    }

    while (sp && (yield match(m`'{'`))) {
      yield eat(m`attributes$: :JSON: <Object />`);
      sp = yield* eatMatchTrivia();
    }

    let sc = yield eatMatch(m`selfClosingToken*: <* '/' />`);

    yield defineAttribute('selfClosing', !!sc);
    yield eat(m`closeToken*: <* '>' />`);
  }

  *TreeNodeMatcherClose() {
    yield eat(m`openToken*: <* '</' />`);
    yield eat(m`closeToken*: <* '>' />`);
  }

  *StringMatcher() {
    if (yield match(m`/['"]/`)) {
      yield eat(m`:JSON: <String />`);
    } else {
      yield eat(m`:Regex: <Pattern />`, o({}), o({ held: 'eat' }));
    }
  }
}

freeze(Spamex);
freeze(Spamex.prototype);

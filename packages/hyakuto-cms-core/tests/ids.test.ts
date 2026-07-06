import { describe, expect, it } from 'vitest';
import { slugifyId, uniqueId, nextLineId, nextChildId } from '../src/ids';
import { editUnitText, newUnit } from '../src/schema/translatable';

// Managed ids (§III.2): the CMS mints every id; these rules are what the grid and
// the story actions rely on to never collide with live content.

describe('slugifyId', () => {
  it('slugs author-facing names into content ids (underscores, folded diacritics)', () => {
    expect(slugifyId('Oiwa DM')).toBe('oiwa_dm');
    expect(slugifyId('  Café — Night!! ')).toBe('cafe_night');
    expect(slugifyId('灯')).toBe('item'); // nothing latin survives → fallback
    expect(slugifyId('', 'thread')).toBe('thread');
  });
});

describe('uniqueId', () => {
  it('returns the base when free, else appends _2, _3…', () => {
    expect(uniqueId('d1_oiwa', new Set())).toBe('d1_oiwa');
    expect(uniqueId('d1_oiwa', new Set(['d1_oiwa']))).toBe('d1_oiwa_2');
    expect(uniqueId('d1_oiwa', new Set(['d1_oiwa', 'd1_oiwa_2']))).toBe('d1_oiwa_3');
  });
});

describe('nextLineId / nextChildId', () => {
  it('continues past the highest number the importer emitted', () => {
    expect(nextLineId('d1_intro', ['d1_intro__0', 'd1_intro__1'])).toBe('d1_intro__2');
    expect(nextLineId('d1_intro', [])).toBe('d1_intro__0');
  });

  it('is not fooled by prefix-sharing segments or child ids', () => {
    // `d1_intro_b__7` belongs to another segment; `__3__o9` is a child of line 3.
    expect(nextLineId('d1_intro', ['d1_intro_b__7', 'd1_intro__3__o9'])).toBe('d1_intro__4');
  });

  it('numbers options and variants independently under one line', () => {
    const line = 'd1_intro__2';
    const ids = [`${line}__o0`, `${line}__o1`, `${line}__v0`];
    expect(nextChildId(line, 'o', ids)).toBe(`${line}__o2`);
    expect(nextChildId(line, 'v', ids)).toBe(`${line}__v1`);
  });
});

// Stale-on-change (§III.5): editing source text must flag existing translations.

describe('editUnitText', () => {
  it('writes the default locale and marks the others stale', () => {
    const unit = { id: 'u1', text: { en: 'hi', ja: 'やあ' } };
    const edited = editUnitText(unit, 'hello', 'en');
    expect(edited.text).toEqual({ en: 'hello', ja: 'やあ' });
    expect(edited.staleLocales).toEqual(['ja']);
  });

  it('is a no-op when the text is unchanged, and adds no flag without translations', () => {
    const untouched = { id: 'u1', text: { en: 'hi', ja: 'やあ' } };
    expect(editUnitText(untouched, 'hi', 'en')).toBe(untouched);
    expect(editUnitText(newUnit('u2', 'en'), 'first draft', 'en').staleLocales).toBeUndefined();
  });

  it('keeps previously stale locales stale across further edits', () => {
    const unit = { id: 'u1', text: { en: 'a', ja: 'あ' }, staleLocales: ['ja'] };
    expect(editUnitText(unit, 'b', 'en').staleLocales).toEqual(['ja']);
  });
});

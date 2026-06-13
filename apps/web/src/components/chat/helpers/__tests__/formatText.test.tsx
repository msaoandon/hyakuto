import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { formatText } from '../formatText';

const html = (s: string) => renderToStaticMarkup(<>{formatText(s)}</>);

describe('formatText', () => {
  it('renders plain text unchanged', () => {
    expect(html('hello')).toBe('hello');
  });

  it('renders bold', () => {
    expect(html('a <b>b</b> c')).toBe('a <strong>b</strong> c');
  });

  it('renders italic and underline', () => {
    expect(html('<i>x</i><u>y</u>')).toBe('<em>x</em><u>y</u>');
  });

  it('handles nesting', () => {
    expect(html('<b>bold <i>both</i></b>')).toBe('<strong>bold <em>both</em></strong>');
  });

  it('treats unknown tags as literal text', () => {
    expect(html('<span>x</span>')).toContain('&lt;span&gt;');
  });

  it('treats an unclosed tag as wrapping the rest', () => {
    expect(html('<b>oops')).toBe('<strong>oops</strong>');
  });

  it('preserves newlines', () => {
    expect(html('a\nb')).toBe('a\nb');
  });
});

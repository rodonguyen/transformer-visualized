import katex from 'katex';
import { valueRGB, textColorFor } from './colors.js';
import { fmt3 } from './text.js';

export const k = (tex) => katex.renderToString(tex, { throwOnError: false });
export const K = (tex) => katex.renderToString(tex, { throwOnError: false, displayMode: true });

const css = (rgb) => `rgb(${rgb.map((c) => Math.round(c * 255)).join(',')})`;

// rows: [{ label, values, kind='div', scale=1, dec=2, cls }]
export function numTable(rows, { header = null } = {}) {
  const head = header ? `<tr><th></th>${header.map((h) => `<th>${h}</th>`).join('')}</tr>` : '';
  const body = rows
    .map((r) => {
      const tds = r.values
        .map((v) => {
          const rgb = valueRGB(r.kind ?? 'div', v, r.scale ?? 1);
          return `<td style="background:${css(rgb)};color:${textColorFor(rgb)}">${fmt3(v, r.dec ?? 2)}</td>`;
        })
        .join('');
      return `<tr class="${r.cls ?? ''}"><th>${r.label}</th>${tds}</tr>`;
    })
    .join('');
  return `<table class="nums">${head}${body}</table>`;
}

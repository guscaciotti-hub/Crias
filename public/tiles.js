/* ===========================================================================
   TILES — tira o fundo chroma das peças do mapa.

   As peças do /map-kit são geradas com fundo MAGENTA #FF00FF (magenta porque
   uma árvore verde sumiria num fundo verde). Este arquivo transforma esse
   fundo em transparência, e é usado pelo EDITOR /mapa e pelo JOGO, para os
   dois verem a peça exatamente igual.

   A borda também é tratada: o magenta "vaza" alguns pixels para dentro do
   contorno na geração, e sem tirar isso a peça fica com uma auréola rosa.
   =========================================================================== */
(function (raiz) {
  'use strict';

  // magenta = vermelho e azul altos, verde baixo. `quanto` mede isso.
  function quantoMagenta(r, g, b) { return Math.min(r, b) - g; }

  var CORTE = 70;   // acima disso é fundo: some
  var BORDA = 25;   // entre BORDA e CORTE é franja: desbota e perde o rosa

  /**
   * @param {HTMLImageElement} imagem  peça com fundo magenta
   * @returns {HTMLCanvasElement|null} cópia sem fundo, aceita direto em drawImage
   *   (recebe naturalWidth/naturalHeight/complete para passar pelas mesmas
   *   checagens que uma <img>)
   */
  var TETO = 768;   // as peças são desenhadas com dezenas de px; varrer 1254x1254
                    // inteiro só para tirar o fundo custava caro na abertura

  function semChroma(imagem) {
    var w0 = imagem.naturalWidth || imagem.width;
    var h0 = imagem.naturalHeight || imagem.height;
    if (!w0 || !h0) return null;
    var esc = Math.min(1, TETO / Math.max(w0, h0));
    var w = Math.max(1, Math.round(w0 * esc)), h = Math.max(1, Math.round(h0 * esc));
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingEnabled = true;
    g.drawImage(imagem, 0, 0, w, h);
    var d;
    try { d = g.getImageData(0, 0, w, h); } catch (e) { return null; }
    var px = d.data, tinha = 0;
    for (var i = 0; i < px.length; i += 4) {
      var m = quantoMagenta(px[i], px[i + 1], px[i + 2]);
      if (m > CORTE) { px[i + 3] = 0; tinha++; continue; }
      if (m > BORDA) {
        px[i + 3] = Math.round(px[i + 3] * (CORTE - m) / (CORTE - BORDA));
        var teto = px[i + 1] + BORDA;          // tira o rosa que sobrou
        if (px[i] > teto) px[i] = teto;
        if (px[i + 2] > teto) px[i + 2] = teto;
      }
    }
    // se quase nada era magenta, a peça já vinha com fundo transparente
    if (tinha < w * h * 0.01) return null;
    g.putImageData(d, 0, 0);
    c.naturalWidth = w; c.naturalHeight = h; c.complete = true;
    c.src = imagem.src || '';
    return c;
  }

  /**
   * Carrega uma peça já sem o fundo. Devolve algo que serve direto em
   * drawImage e responde a .complete / .naturalWidth como uma <img>.
   */
  function carregar(src, aoPronto) {
    var im = new Image();
    var saida = im;                       // enquanto não processa, vale a <img>
    im.onload = function () {
      var limpo = semChroma(im);
      if (limpo) saida = limpo;
      if (aoPronto) aoPronto(saida);
    };
    im.onerror = function () { if (aoPronto) aoPronto(null); };
    im.src = src;
    return { get atual() { return saida; }, img: im };
  }

  // ── Ajuste de cor da peça ───────────────────────────────────────────────
  // Um tile gerado à parte vem com a luz de outro lugar: mais claro, mais
  // saturado, ou puxando para outro tom. Isto reacende a peça para casar com o
  // mapa. Mesma função no editor e no jogo, então o que você vê é o que fica.
  function chaveAjuste(aj) {
    if (!aj) return '';
    return [aj.b || 1, aj.s == null ? 1 : aj.s, aj.f || 0, (aj.cor || []).join(',')].join('|');
  }

  function comAjuste(base, aj) {
    var w = base.naturalWidth || base.width, h = base.naturalHeight || base.height;
    if (!w || !h) return base;
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(base, 0, 0, w, h);
    var d;
    try { d = g.getImageData(0, 0, w, h); } catch (e) { return base; }
    var px = d.data;
    var b = aj.b == null ? 1 : aj.b;
    var sat = aj.s == null ? 1 : aj.s;
    var f = aj.f || 0;
    var cor = aj.cor || [128, 128, 128];
    for (var i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      var r = px[i] * b, gg = px[i + 1] * b, bb = px[i + 2] * b;
      var lum = 0.299 * r + 0.587 * gg + 0.114 * bb;
      r = lum + (r - lum) * sat; gg = lum + (gg - lum) * sat; bb = lum + (bb - lum) * sat;
      if (f > 0) {
        // puxa para a cor de referência mantendo o claro/escuro do pixel
        var k = lum / 160;
        r = r * (1 - f) + cor[0] * k * f;
        gg = gg * (1 - f) + cor[1] * k * f;
        bb = bb * (1 - f) + cor[2] * k * f;
      }
      px[i]     = r < 0 ? 0 : r > 255 ? 255 : r;
      px[i + 1] = gg < 0 ? 0 : gg > 255 ? 255 : gg;
      px[i + 2] = bb < 0 ? 0 : bb > 255 ? 255 : bb;
    }
    g.putImageData(d, 0, 0);
    c.naturalWidth = w; c.naturalHeight = h; c.complete = true; c.src = base.src || '';
    return c;
  }

  // Guarda o resultado na própria peça: refazer o ajuste a cada desenho custaria caro
  function ajustada(p, base) {
    if (!p || !p.aj) return base;
    var k = chaveAjuste(p.aj);
    if (!k || k === '1|1|0|') return base;
    if (p._ajK !== k || p._ajBase !== base) {
      p._ajCv = comAjuste(base, p.aj);
      p._ajK = k; p._ajBase = base;
    }
    return p._ajCv || base;
  }

  // Média de cor e de luz dos pixels opacos
  function mediaDe(fonte, sx, sy, sw, sh) {
    var c = document.createElement('canvas');
    var L = Math.min(120, Math.max(1, Math.round(sw)));
    c.width = L; c.height = Math.max(1, Math.round(L * sh / sw));
    var g = c.getContext('2d', { willReadFrequently: true });
    try { g.drawImage(fonte, sx, sy, sw, sh, 0, 0, c.width, c.height); } catch (e) { return null; }
    var d;
    try { d = g.getImageData(0, 0, c.width, c.height).data; } catch (e) { return null; }
    var r = 0, gg = 0, b = 0, n = 0;
    for (var i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 128) continue;
      r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++;
    }
    if (!n) return null;
    r /= n; gg /= n; b /= n;
    return { cor: [r, gg, b], lum: 0.299 * r + 0.587 * gg + 0.114 * b, n: n };
  }

  raiz.Tiles = {
    semChroma: semChroma, carregar: carregar,
    comAjuste: comAjuste, ajustada: ajustada, mediaDe: mediaDe, chaveAjuste: chaveAjuste
  };
})(typeof window !== 'undefined' ? window : globalThis);

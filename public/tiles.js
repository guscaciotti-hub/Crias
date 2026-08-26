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

  raiz.Tiles = { semChroma: semChroma, carregar: carregar };
})(typeof window !== 'undefined' ? window : globalThis);

/* ===========================================================================
   PASSA-ATRÁS — silhueta do objeto dentro da área marcada.

   Carregado pelo JOGO e pelo EDITOR /mapa. Os dois chamam a MESMA função, e o
   cálculo é feito lendo o mapa em escala 1:1 — sem redimensionar. Isso importa:
   o Chromium reduz a mesma imagem de formas ligeiramente diferentes em páginas
   diferentes (cache de escala), e era exatamente por isso que o amarelo do
   editor não batia com o que acontecia no jogo.

   A marcação amarela define apenas a ÁREA DE BUSCA. Dentro dela, o chão entra
   pelas bordas e se espalha enquanto a cor não muda; o que o chão não alcança
   é objeto — a copa do pinheiro, o telhado da casa — e só isso cobre o
   jogador. É o mesmo princípio do orbe, que usa o alfa do próprio sprite.
   =========================================================================== */
(function (raiz) {
  'use strict';

  var PADRAO = {
    tolPasso: 22,     // quanto a cor pode mudar de um pixel para o vizinho
    tolChao: 80,      // quanto pode se afastar da cor de onde aquela onda partiu
    manchaMin: 60,    // manchas menores que isto são textura do chão, não objeto
    ladoMax: 1100,    // teto do recorte: acima disso o custo trava a abertura
                      // (2200 levava ~1s de congelamento; 1100 leva ~250ms)
    remendos: null,   // remendos publicados, para a silhueta ver o mapa corrigido
    tiles: null       // texturas usadas por remendos de tile
  };

  /**
   * @param {HTMLImageElement|HTMLCanvasElement} mapa  mapa inteiro (quadrado)
   * @param {number[][]} marcas   matriz M x M, 1 = dentro da área marcada
   * @param {object} [op]
   * @returns {{canvas:HTMLCanvasElement, area:{x,y,w,h}, mantidos:number, total:number}|null}
   *   `canvas` é branco onde o objeto cobre o jogador; `area` é a posição desse
   *   recorte no mapa, em fração de 0 a 1.
   */
  function construirSilhueta(mapa, marcas, op) {
    var larg = mapa && (mapa.naturalWidth || mapa.width);
    var alt = mapa && (mapa.naturalHeight || mapa.height);
    if (!larg || !alt) return null;
    if (mapa.complete === false) return null;
    if (!marcas || !marcas.length) return null;
    var o = Object.assign({}, PADRAO, op || {});

    var M = marcas.length;

    // 1) Caixa da marcação, com uma célula de folga para o chão ter de onde entrar
    var cx0 = M, cy0 = M, cx1 = -1, cy1 = -1;
    for (var y = 0; y < M; y++) {
      var ln = marcas[y]; if (!ln) continue;
      for (var x = 0; x < ln.length; x++) if (ln[x]) {
        if (x < cx0) cx0 = x; if (x > cx1) cx1 = x;
        if (y < cy0) cy0 = y; if (y > cy1) cy1 = y;
      }
    }
    if (cx1 < 0) return null;
    cx0 = Math.max(0, cx0 - 1); cy0 = Math.max(0, cy0 - 1);
    cx1 = Math.min(M - 1, cx1 + 1); cy1 = Math.min(M - 1, cy1 + 1);

    // 2) Recorte em 1:1 do mapa (drawImage sem escala é cópia exata)
    var sx = Math.floor(cx0 / M * larg), sy = Math.floor(cy0 / M * alt);
    var sw = Math.ceil((cx1 + 1) / M * larg) - sx, sh = Math.ceil((cy1 + 1) / M * alt) - sy;
    var esc = Math.min(1, o.ladoMax / Math.max(sw, sh));
    var W = Math.max(1, Math.round(sw * esc)), H = Math.max(1, Math.round(sh * esc));

    var mc = document.createElement('canvas');
    mc.width = W; mc.height = H;
    var mg = mc.getContext('2d', { willReadFrequently: true });
    mg.imageSmoothingEnabled = false;
    mg.drawImage(mapa, sx, sy, sw, sh, 0, 0, W, H);
    // se o chão foi remendado, a silhueta tem que enxergar o mapa remendado —
    // senão o jogo apagaria a árvore e a máscara continuaria devolvendo ela
    if (o.remendos && o.remendos.length)
      desenharRemendos(mg, mapa, o.remendos, -sx * (W / sw), -sy * (H / sh), larg * (W / sw), null, o.tiles);
    var px;
    try { px = mg.getImageData(0, 0, W, H).data; } catch (e) { return null; }

    // marcado(X,Y) no referencial do recorte
    var celW = W / (cx1 - cx0 + 1), celH = H / (cy1 - cy0 + 1);
    function dentro(X, Y) {
      if (X < 0 || Y < 0 || X >= W || Y >= H) return 0;
      var mx = cx0 + ((X / celW) | 0), my = cy0 + ((Y / celH) | 0);
      var l = marcas[my];
      return (l && l[mx]) ? 1 : 0;
    }

    // 3) O chão entra pelas bordas da área e se espalha. Duas travas: a cor não
    //    pode dar um salto de um pixel para o vizinho, E não pode se afastar
    //    demais da cor de onde a onda partiu — sem a segunda, o chão escorrega
    //    por gradiente para dentro da copa e some com metade da árvore.
    var n = W * H;
    var chao = new Uint8Array(n), fila = new Int32Array(n);
    var semR = new Uint8Array(n), semG = new Uint8Array(n), semB = new Uint8Array(n);
    var a = 0, b = 0;
    for (var Y0 = 0; Y0 < H; Y0++) for (var X0 = 0; X0 < W; X0++) {
      if (dentro(X0, Y0)) continue;
      if (dentro(X0 - 1, Y0) || dentro(X0 + 1, Y0) || dentro(X0, Y0 - 1) || dentro(X0, Y0 + 1)) {
        var i0 = Y0 * W + X0, k0 = i0 * 4;
        fila[b++] = i0; semR[i0] = px[k0]; semG[i0] = px[k0 + 1]; semB[i0] = px[k0 + 2];
      }
    }
    var D4 = [-1, 0, 1, 0, 0, -1, 0, 1];
    while (a < b) {
      var i = fila[a++], xi = i % W, yi = (i / W) | 0, ki = i * 4;
      var sr = semR[i], sg = semG[i], sb = semB[i];
      for (var v = 0; v < 8; v += 2) {
        var X = xi + D4[v], Y = yi + D4[v + 1];
        if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
        var j = Y * W + X;
        if (chao[j] || !dentro(X, Y)) continue;
        var kj = j * 4;
        if (Math.abs(px[kj] - px[ki]) + Math.abs(px[kj + 1] - px[ki + 1]) + Math.abs(px[kj + 2] - px[ki + 2]) >= o.tolPasso) continue;
        if (Math.abs(px[kj] - sr) + Math.abs(px[kj + 1] - sg) + Math.abs(px[kj + 2] - sb) >= o.tolChao) continue;
        chao[j] = 1; semR[j] = sr; semG[j] = sg; semB[j] = sb; fila[b++] = j;
      }
    }

    // 4) O que o chão não alcançou é objeto; manchas minúsculas são textura
    var obj = new Uint8Array(n), total = 0;
    for (var p = 0; p < n; p++) {
      if (!dentro(p % W, (p / W) | 0)) continue;
      total++;
      if (!chao[p]) obj[p] = 1;
    }

    var visto = new Uint8Array(n);
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var g = c.getContext('2d');
    var id = g.createImageData(W, H);
    var mantidos = 0;
    var D8 = [-1, 0, 1, 0, 0, -1, 0, 1, -1, -1, 1, 1, -1, 1, 1, -1];
    var manchaMin = Math.max(8, Math.round(o.manchaMin * esc * esc * (larg / 4000) * (larg / 4000)));
    for (var ini = 0; ini < n; ini++) {
      if (!obj[ini] || visto[ini]) continue;
      var a2 = 0, b2 = 0, mancha = [];
      fila[b2++] = ini; visto[ini] = 1;
      while (a2 < b2) {
        var q = fila[a2++]; mancha.push(q);
        var xq = q % W, yq = (q / W) | 0;
        for (var w = 0; w < 16; w += 2) {
          var XX = xq + D8[w], YY = yq + D8[w + 1];
          if (XX < 0 || YY < 0 || XX >= W || YY >= H) continue;
          var jj = YY * W + XX;
          if (obj[jj] && !visto[jj]) { visto[jj] = 1; fila[b2++] = jj; }
        }
      }
      if (mancha.length < manchaMin) continue;
      for (var m = 0; m < mancha.length; m++) {
        var kk = mancha[m] * 4;
        id.data[kk] = id.data[kk + 1] = id.data[kk + 2] = id.data[kk + 3] = 255;
        mantidos++;
      }
    }
    g.putImageData(id, 0, 0);

    return {
      canvas: c, mantidos: mantidos, total: total,
      area: { x: sx / larg, y: sy / alt, w: sw / larg, h: sh / alt }
    };
  }

  /**
   * Desenha os remendos (pedaços do chão copiados de um lugar para o outro)
   * por cima de um mapa já desenhado. Sempre a partir do mapa ORIGINAL e
   * sempre na mesma ordem, então jogo e editor produzem o mesmo resultado.
   *
   * @param g          contexto 2d de destino
   * @param mapa       imagem do mapa (fonte)
   * @param remendos   em fração do mapa (0..1). Três formatos:
   *   redondo/quadrado: {x,y,ox,oy,r,f}
   *   livre:            {pts:[[x,y],...], dx, dy, f:'livre'}
   * @param destX,destY  onde fica o canto do mapa, no destino
   * @param destLarg     largura do mapa inteiro, no destino
   */
  // `tiles` = { nome: imagem }. Um remendo com `tile` é preenchido com essa
  // textura em vez de copiar um pedaço do mapa — é o que permite pintar piso
  // num mapa que ainda não tem piso nenhum.
  function desenharRemendos(g, mapa, remendos, destX, destY, destLarg, recorte, tiles) {
    if (!remendos || !remendos.length || !mapa) return;
    var iw = mapa.naturalWidth || mapa.width, ih = mapa.naturalHeight || mapa.height;
    if (!iw || !ih) return;
    var destAlt = destLarg * (ih / iw);
    var X = function (u) { return destX + u * destLarg; };
    var Y = function (v) { return destY + v * destAlt; };
    // `recorte` = {x,y,w,h} da área visível no destino. Sem isso, um mapa com
    // mil remendos redesenharia mil recortes por frame, inclusive os que estão
    // fora da tela.
    for (var i = 0; i < remendos.length; i++) {
      var p = remendos[i];
      if (recorte) {
        var bx0, by0, bx1, by1;
        if (p.f === 'livre' && p.pts) {
          bx0 = by0 = 1; bx1 = by1 = 0;
          for (var t = 0; t < p.pts.length; t++) {
            var uu = p.pts[t][0], vv = p.pts[t][1];
            if (uu < bx0) bx0 = uu; if (uu > bx1) bx1 = uu;
            if (vv < by0) by0 = vv; if (vv > by1) by1 = vv;
          }
        } else { bx0 = p.x - p.r; bx1 = p.x + p.r; by0 = p.y - p.r; by1 = p.y + p.r; }
        if (X(bx1) < recorte.x || X(bx0) > recorte.x + recorte.w ||
            Y(by1) < recorte.y || Y(by0) > recorte.y + recorte.h) continue;
      }
      // caixa do remendo e a mesma caixa na origem, em fração do mapa
      var bx0, by0, bx1, by1, ox0, oy0;
      g.save();
      g.beginPath();
      if (p.f === 'livre' && p.pts && p.pts.length > 2) {
        bx0 = by0 = 1; bx1 = by1 = 0;
        for (var k = 0; k < p.pts.length; k++) {
          var u = p.pts[k][0], v = p.pts[k][1];
          if (u < bx0) bx0 = u; if (u > bx1) bx1 = u;
          if (v < by0) by0 = v; if (v > by1) by1 = v;
          if (k === 0) g.moveTo(X(u), Y(v)); else g.lineTo(X(u), Y(v));
        }
        g.closePath();
        ox0 = bx0 + p.dx; oy0 = by0 + p.dy;
      } else {
        bx0 = p.x - p.r; by0 = p.y - p.r; bx1 = p.x + p.r; by1 = p.y + p.r;
        ox0 = p.ox - p.r; oy0 = p.oy - p.r;
        if (p.f === 'quadrado') {
          g.rect(X(bx0), Y(by0), (bx1 - bx0) * destLarg, (by1 - by0) * destAlt);
        } else {
          var rx = p.r * destLarg, ry = p.r * destAlt;
          if (g.ellipse) g.ellipse(X(p.x), Y(p.y), rx, ry, 0, 0, 6.283);
          else g.arc(X(p.x), Y(p.y), rx, 0, 6.283);
        }
      }
      g.clip();
      g.imageSmoothingEnabled = true;
      var bw = bx1 - bx0, bh = by1 - by0;
      var tex = p.tile && tiles && tiles[p.tile];
      if (tex && (tex.naturalWidth || tex.width)) {
        // textura repetida, no tamanho pedido (em fração do mapa)
        var lado = Math.max(2, (p.tesc || 0.02) * destLarg);
        var tmp = document.createElement('canvas');
        tmp.width = tmp.height = Math.round(lado);
        tmp.getContext('2d').drawImage(tex, 0, 0, tmp.width, tmp.height);
        var pat = g.createPattern(tmp, 'repeat');
        if (pat) {
          g.fillStyle = pat;
          g.fillRect(X(bx0) - lado, Y(by0) - lado, bw * destLarg + lado * 2, bh * destAlt + lado * 2);
        }
      } else {
        g.drawImage(mapa,
          ox0 * iw, oy0 * ih, bw * iw, bh * ih,
          X(bx0), Y(by0), bw * destLarg, bh * destAlt);
      }
      g.restore();
    }
  }

  raiz.PassaAtras = {
    construirSilhueta: construirSilhueta,
    desenharRemendos: desenharRemendos,
    PADRAO: PADRAO
  };
})(typeof window !== 'undefined' ? window : globalThis);

"use strict";
(() => {
  const rows = JSON.parse(document.getElementById("experiment-data").textContent);
  const tools = ["gzip", "xz", "bzip2", "lzma", "lz4", "zstd"];
  const colors = {gzip: "#9a5b2d", xz: "#4873a0", bzip2: "#24795c", lzma: "#8262a0", lz4: "#bb4b60", zstd: "#217f98"};
  const dashes = {gzip: "", xz: "7 3", bzip2: "", lzma: "2 3", lz4: "10 3", zstd: "5 2 1 2"};
  const patterns = {
    "all-zero": ["全0列", "00 00 00 00 00 00 …", "各バイトが 0x00 の列"],
    "alternating-00-01": ["周期2", "00 01 00 01 00 01 …", "0x00 と 0x01 を交互に繰り返す"],
    "period-6-010111": ["周期6", "00 01 00 01 01 01 …", "6バイトの並びを繰り返す"]
  };
  let pattern = "all-zero", metric = "total";
  const NS = "http://www.w3.org/2000/svg";
  const element = (tag, attrs = {}, text = null) => {
    const node = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text !== null) node.textContent = text;
    return node;
  };
  const size = n => n >= 1e9 ? `${n / 1e9} GB` : n >= 1e6 ? `${n / 1e6} MB` : n >= 1e3 ? `${n / 1e3} kB` : `${n} B`;
  const number = n => n.toLocaleString("en-US", {maximumFractionDigits: 3});
  const ratio = n => n.toLocaleString("en-US", {maximumFractionDigits: 7});
  const legend = document.getElementById("legend");
  tools.forEach(tool => {
    const li = document.createElement("li");
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    swatch.style.background = colors[tool];
    li.append(swatch, document.createTextNode(tool));
    legend.append(li);
  });
  function render() {
    const selected = rows.filter(r => r.pattern === pattern);
    const meta = patterns[pattern];
    document.getElementById("pattern-bytes").textContent = meta[1];
    document.getElementById("pattern-caption").textContent = meta[2];
    document.getElementById("chart-title").textContent = `${meta[0]}の圧縮率 — ${metric === "total" ? "最終ファイル全体" : "ペイロードのみ"}`;
    const svg = element("svg", {viewBox: "0 0 1050 435", role: "img", "aria-labelledby": "svg-title svg-description"});
    svg.append(element("title", {id: "svg-title"}, `${meta[0]}・${metric === "total" ? "全体" : "ペイロード"}の圧縮率`));
    svg.append(element("desc", {id: "svg-description"}, "横軸は1 Bから1 GBの元サイズ、縦軸は圧縮前サイズを圧縮後サイズで割った圧縮率。両軸は対数目盛。線は6形式。同じ数値は下の開閉式の表で読めます。"));
    const left = 78, right = 944, top = 25, bottom = 368;
    const x = n => left + Math.log10(n) / 9 * (right - left);
    // Fixed domains permit honest comparison across all pattern/metric selections.
    const y = v => top + (7 - Math.log10(v)) / 9 * (bottom - top);
    for (let exp = -2; exp <= 7; exp++) {
      const val = 10 ** exp, py = y(val);
      svg.append(element("line", {x1: left, x2: right, y1: py, y2: py, stroke: exp === 0 ? "#81998a" : "#e6eae5", "stroke-dasharray": exp === 0 ? "5 4" : ""}));
      svg.append(element("text", {x: left - 12, y: py + 4, "text-anchor": "end"}, `${ratio(val)}×`));
    }
    for (let exp = 0; exp <= 9; exp++) {
      const n = 10 ** exp, px = x(n);
      svg.append(element("line", {x1: px, x2: px, y1: top, y2: bottom, stroke: "#f0f2ef"}));
      svg.append(element("text", {x: px, y: bottom + 25, "text-anchor": "middle"}, size(n)));
    }
    svg.append(element("text", {x: left, y: 13, class: "axis-label"}, "圧縮率（圧縮前 ÷ 圧縮後）"));
    svg.append(element("text", {x: (left + right) / 2, y: 426, "text-anchor": "middle", class: "axis-label"}, "元のデータサイズ（10進）"));
    svg.append(element("text", {x: right + 10, y: y(1) + 4}, "元と同じ"));
    const labels = [];
    for (const tool of tools) {
      const points = selected.filter(r => r.tool === tool).sort((a, b) => a.n - b.n);
      svg.append(element("polyline", {points: points.map(r => `${x(r.n)},${y(r.n / r[metric])}`).join(" "), fill: "none", stroke: colors[tool], "stroke-width": 2.4, "stroke-dasharray": dashes[tool], "stroke-linejoin": "round"}));
      points.forEach(r => {
        const compressionRatio = r.n / r[metric];
        const circle = element("circle", {cx: x(r.n), cy: y(compressionRatio), r: 3.2, fill: "white", stroke: colors[tool], "stroke-width": 1.6});
        circle.append(element("title", {}, `${tool} / ${size(r.n)}: ${number(r[metric])} B (${ratio(compressionRatio)}×)`));
        svg.append(circle);
      });
      labels.push({tool, py: y(1e9 / points.at(-1)[metric])});
    }
    labels.sort((a,b) => a.py - b.py);
    let previous = -Infinity;
    labels.forEach(label => {
      const py = Math.max(label.py, previous + 17);
      svg.append(element("line", {x1: right + 5, x2: right + 17, y1: label.py, y2: py, stroke: colors[label.tool], "stroke-width": 1}));
      const text = element("text", {x: right + 22, y: py + 4, class: "series-label"}, label.tool);
      text.style.fill = colors[label.tool]; svg.append(text); previous = py;
    });
    document.getElementById("chart").replaceChildren(svg);
    const best = selected.filter(r => r.n === 1e9).sort((a,b) => a[metric] - b[metric])[0];
    document.getElementById("chart-summary").textContent = `1 GB / ${meta[0]}：${metric === "total" ? "最終サイズ" : "ペイロード換算"}の最小は ${best.tool} の ${number(best[metric])} B（圧縮率 ${ratio(1e9 / best[metric])}×）。`;
    const tbody = document.querySelector("#chart-values tbody");
    tbody.replaceChildren();
    for (const n of [...new Set(selected.map(r => r.n))].sort((a,b) => a-b)) {
      const tr = document.createElement("tr"), th = document.createElement("th");
      th.scope = "row"; th.textContent = size(n); tr.append(th);
      for (const tool of tools) {
        const r = selected.find(r => r.n === n && r.tool === tool);
        const td = document.createElement("td");
        td.textContent = `${ratio(n / r[metric])}×`; tr.append(td);
      }
      tbody.append(tr);
    }
    document.querySelector("#chart-values caption").textContent = `${meta[0]} / ${metric === "total" ? "最終ファイル全体" : "ペイロードのみ"}の圧縮率（圧縮前 ÷ 圧縮後）`;
  }
  for (const control of document.querySelectorAll("[data-pattern], [data-metric]")) {
    control.addEventListener("click", () => {
      if (control.dataset.pattern) pattern = control.dataset.pattern;
      if (control.dataset.metric) metric = control.dataset.metric;
      control.parentElement.querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button === control)));
      render();
    });
  }
  render();
  document.getElementById("chart-controls").hidden = false;

  const estimateRows = JSON.parse(document.getElementById("estimate-data").textContent);
  const estimateLength = document.getElementById("estimate-length");
  const estimateLengthOutput = document.getElementById("estimate-length-output");
  let estimateMetric = "whole";
  const compactCount = value => value < 1e9
    ? Math.round(value).toLocaleString("en-US")
    : value.toExponential(3).replace("e+", "e");
  function renderEstimate() {
    const n = Number(estimateLength.value);
    const row = estimateRows.find(item => item.n === n);
    const block = row[estimateMetric];
    const bins = block.bins.map(item => ({ratio: item[0], occurrences: item[1], relative: item[2]}));
    estimateLengthOutput.textContent = `${n} B`;
    document.getElementById("estimate-chart-title").textContent =
      `${n} B・${estimateMetric === "whole" ? "stream全体" : "Payload"}の推定Occurrence`;
    const svg = element("svg", {viewBox: "0 0 1050 435", role: "img",
      "aria-labelledby": "estimate-svg-title estimate-svg-description"});
    svg.append(element("title", {id: "estimate-svg-title"},
      `${n} B・${estimateMetric === "whole" ? "stream全体" : "Payload"}の推定圧縮率ヒストグラム`));
    svg.append(element("desc", {id: "estimate-svg-description"},
      "横軸は圧縮前サイズを圧縮後サイズで割った圧縮率、縦軸は全てのbyte列へ重み戻した推定発生件数の対数。濃い棒は観測最大圧縮率の90%以上。"));
    const left = 78, right = 974, top = 25, bottom = 368;
    const ratios = bins.map(item => item.ratio);
    const padding = Math.max(.002, (Math.max(...ratios) - Math.min(...ratios)) * .05);
    const xMin = Math.max(0, Math.min(...ratios) - padding), xMax = Math.max(...ratios) + padding;
    const yMin = Math.min(0, Math.floor(Math.log10(Math.min(...bins.map(item => item.occurrences)))));
    const yMax = Math.ceil(n * Math.log10(256));
    const x = value => left + (value - xMin) / (xMax - xMin) * (right - left);
    const y = value => top + (yMax - Math.log10(value)) / (yMax - yMin) * (bottom - top);
    for (let index = 0; index <= 5; index++) {
      const exponent = yMin + (yMax - yMin) * index / 5;
      const py = top + (5 - index) / 5 * (bottom - top);
      svg.append(element("line", {x1: left, x2: right, y1: py, y2: py, stroke: "#e6eae5"}));
      svg.append(element("text", {x: left - 12, y: py + 4, "text-anchor": "end"},
        exponent === 0 ? "1" : `10^${Math.round(exponent)}`));
    }
    for (let index = 0; index <= 5; index++) {
      const value = xMin + (xMax - xMin) * index / 5, px = x(value);
      svg.append(element("line", {x1: px, x2: px, y1: top, y2: bottom, stroke: "#f0f2ef"}));
      svg.append(element("text", {x: px, y: bottom + 25, "text-anchor": "middle"}, `${ratio(value)}×`));
    }
    svg.append(element("text", {x: left, y: 13, class: "axis-label"}, "推定Occurrence（対数目盛）"));
    svg.append(element("text", {x: (left + right) / 2, y: 426, "text-anchor": "middle", class: "axis-label"}, "圧縮率（圧縮前 ÷ 圧縮後）"));
    const barWidth = Math.max(1.5, Math.min(18, (right - left) / Math.max(1, bins.length) * .68));
    const ordinary = estimateMetric === "whole" ? "#c86b3c" : "#217a78";
    const tail = estimateMetric === "whole" ? "#74331d" : "#0d4545";
    bins.forEach(item => {
      const py = y(item.occurrences);
      const bar = element("rect", {x: x(item.ratio) - barWidth / 2, y: py,
        width: barWidth, height: Math.max(.8, bottom - py),
        fill: item.relative >= .9 ? tail : ordinary});
      bar.append(element("title", {}, `${ratio(item.ratio)}×：推定 ${compactCount(item.occurrences)}件`));
      svg.append(bar);
    });
    document.getElementById("estimate-chart").replaceChildren(svg);
    document.getElementById("estimate-chart-summary").textContent =
      `観測最大 ${ratio(block.maximum)}×。90%以上の尾部は推定 ${compactCount(block.tail)}件、` +
      `周期2以下からの厳密な下限 ${block.lower.toLocaleString("en-US")}件。` +
      `尾部zero-hitの非全列挙成分 ${block.zero_hits}件。`;
  }
  estimateLength.addEventListener("input", renderEstimate);
  document.querySelectorAll("[data-estimate-metric]").forEach(control => {
    control.addEventListener("click", () => {
      estimateMetric = control.dataset.estimateMetric;
      control.parentElement.querySelectorAll("button").forEach(button =>
        button.setAttribute("aria-pressed", String(button === control)));
      renderEstimate();
    });
  });
  renderEstimate();
})();

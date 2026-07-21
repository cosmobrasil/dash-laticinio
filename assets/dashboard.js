const apiBaseUrl = window.APP_CONFIG?.apiBaseUrl || "http://localhost:3001";
const form = document.querySelector("#filter-form");
const statusRoot = document.querySelector("#dashboard-status");
const kpisRoot = document.querySelector("#kpis-root");
const chartsRoot = document.querySelector("#charts-root");
const tablesRoot = document.querySelector("#tables-root");
const strategyRoot = document.querySelector("#strategy-root");
const autoRefreshInput = document.querySelector("#auto-refresh");

let lastOverview = null;
let autoRefreshTimer = null;
const PCM_MAX_AVERAGE = 23 / 12;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value, digits = 0) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${formatNumber(value, 1)}%`;
}

function formatPcmPercent(value) {
  return formatPercent((Number(value || 0) / PCM_MAX_AVERAGE) * 100);
}

function formatDate(value) {
  if (!value) {
    return "Nao informado";
  }

  return new Intl.DateTimeFormat("pt-BR").format(new Date(value));
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoString(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function renderMetricCard(label, value, detail, tone = "neutral") {
  return `
    <article class="metric-card metric-card-${escapeHtml(tone)}">
      <p class="metric-label">${escapeHtml(label)}</p>
      <div class="metric-value">${escapeHtml(value)}</div>
      <p class="metric-detail">${escapeHtml(detail)}</p>
    </article>
  `;
}

function buildBarChart(items) {
  if (!items.length) {
    return `<div class="empty-chart">Sem dados no recorte atual.</div>`;
  }

  const width = 620;
  const height = 320;
  const left = 42;
  const right = 16;
  const top = 24;
  const bottom = 58;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const barWidth = chartWidth / items.length;

  const palette = ["#42c85b", "#44b4d0", "#6b67e8", "#ffaa0d", "#f44343", "#7ed957"];

  const grid = [0, 20, 40, 60, 80, 100]
    .map((tick) => {
      const y = top + chartHeight - (tick / 100) * chartHeight;
      return `
        <line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" class="chart-grid-line"></line>
        <text x="${left - 8}" y="${y + 4}" class="chart-axis-text" text-anchor="end">${tick}</text>
      `;
    })
    .join("");

  const bars = items
    .map((item, index) => {
      const value = Number(item.value || 0);
      const innerWidth = Math.max(18, barWidth - 28);
      const x = left + index * barWidth + (barWidth - innerWidth) / 2;
      const barHeight = Math.max(4, (value / 100) * chartHeight);
      const y = top + chartHeight - barHeight;
      const color = palette[index % palette.length];
      return `
        <rect x="${x}" y="${y}" width="${innerWidth}" height="${barHeight}" rx="10" fill="${color}"></rect>
        <text x="${x + innerWidth / 2}" y="${y - 8}" class="chart-value-text" text-anchor="middle">${formatPercent(value)}</text>
        <text x="${x + innerWidth / 2}" y="${height - 16}" class="chart-axis-text" text-anchor="middle">${escapeHtml(item.label)}</text>
      `;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Grafico de barras">
      ${grid}
      ${bars}
    </svg>
  `;
}

function buildDonutChart(value, gap) {
  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const normalizedValue = Math.max(0, Math.min(100, Number(value || 0)));
  const dash = (normalizedValue / 100) * circumference;

  return `
    <div class="donut-wrap">
      <svg viewBox="0 0 280 280" class="donut-svg" role="img" aria-label="Indice global de circularidade">
        <circle cx="140" cy="140" r="${radius}" class="donut-track"></circle>
        <circle
          cx="140"
          cy="140"
          r="${radius}"
          class="donut-value"
          stroke-dasharray="${dash} ${circumference - dash}"
        ></circle>
      </svg>
      <div class="donut-center">
        <strong>${formatPercent(normalizedValue)}</strong>
        <span>gap ${formatPercent(gap)}</span>
      </div>
    </div>
  `;
}

function polarPoint(cx, cy, radius, angle) {
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle)
  };
}

function buildRadarChart(items, tone = "green") {
  if (!items.length) {
    return `<div class="empty-chart">Sem dados no recorte atual.</div>`;
  }

  const width = 620;
  const height = 360;
  const cx = width / 2;
  const cy = 182;
  const maxRadius = 118;
  const levels = [20, 40, 60, 80, 100];
  const points = items.map((item, index) => {
    const angle = -Math.PI / 2 + (index / items.length) * Math.PI * 2;
    const normalized = Math.max(0, Math.min(100, Number(item.value || 0)));
    const point = polarPoint(cx, cy, (normalized / 100) * maxRadius, angle);
    const labelPoint = polarPoint(cx, cy, maxRadius + 26, angle);
    return {
      ...point,
      labelX: labelPoint.x,
      labelY: labelPoint.y,
      angle,
      label: item.label,
      value: normalized
    };
  });

  const grid = levels
    .map((level) => {
      const polygon = items
        .map((_, index) => {
          const angle = -Math.PI / 2 + (index / items.length) * Math.PI * 2;
          const point = polarPoint(cx, cy, (level / 100) * maxRadius, angle);
          return `${point.x},${point.y}`;
        })
        .join(" ");
      return `<polygon points="${polygon}" class="radar-grid"></polygon>`;
    })
    .join("");

  const spokes = points
    .map(
      (point) =>
        `<line x1="${cx}" y1="${cy}" x2="${point.labelX - 10 * Math.cos(point.angle)}" y2="${point.labelY - 10 * Math.sin(point.angle)}" class="radar-spoke"></line>`
    )
    .join("");

  const shape = points.map((point) => `${point.x},${point.y}`).join(" ");
  const labels = points
    .map(
      (point) => `
        <text x="${point.labelX}" y="${point.labelY}" class="radar-label" text-anchor="middle">${escapeHtml(point.label)}</text>
      `
    )
    .join("");

  const valueLabels = levels
    .map((level, index) => {
      const y = cy - (level / 100) * maxRadius;
      return `<text x="${cx + 8}" y="${y + index}" class="radar-scale">${level}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" class="chart-svg" role="img" aria-label="Grafico radar">
      ${grid}
      ${spokes}
      <polygon points="${shape}" class="radar-area radar-area-${escapeHtml(tone)}"></polygon>
      <polyline points="${shape}" class="radar-line radar-line-${escapeHtml(tone)}"></polyline>
      ${labels}
      ${valueLabels}
    </svg>
  `;
}

function renderChartCard(title, body, footer = "") {
  return `
    <article class="panel chart-card">
      <h2>${escapeHtml(title)}</h2>
      <div class="chart-body">${body}</div>
      ${footer ? `<p class="chart-footnote">${escapeHtml(footer)}</p>` : ""}
    </article>
  `;
}

function renderTableCard(title, rows, columns) {
  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const body = rows.length
    ? rows
        .map(
          (row) => `
            <tr>
              ${columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join("")}
            </tr>
          `
        )
        .join("")
    : `<tr><td colspan="${columns.length}">Sem dados para o recorte selecionado.</td></tr>`;

  return `
    <article class="panel table-card">
      <h2>${escapeHtml(title)}</h2>
      <div class="table-wrap">
        <table>
          <thead><tr>${head}</tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
    </article>
  `;
}

function setStatus(content, tone = "default") {
  statusRoot.className = `panel status-panel status-panel-${tone}`;
  statusRoot.innerHTML = content;
}

function updateFilterOptions(overview) {
  if (!overview?.availableFilters) {
    return;
  }

  const filterConfig = [
    { name: "product", values: overview.availableFilters.products, allLabel: "Todos" },
    { name: "city", values: overview.availableFilters.cities, allLabel: "Todas" },
    { name: "state", values: overview.availableFilters.states, allLabel: "Todas" }
  ];

  for (const config of filterConfig) {
    const select = form.elements[config.name];
    const currentValue = String(select.value || "");
    const options = [`<option value="">${config.allLabel}</option>`]
      .concat(config.values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`))
      .join("");

    select.innerHTML = options;
    select.value = config.values.includes(currentValue) ? currentValue : overview.filters?.[config.name] || "";
  }
}

function entriesToMetricItems(source = {}, labels = {}) {
  return Object.entries(source)
    .map(([key, value]) => ({
      key,
      label: labels[key] || key,
      value: Number(value || 0)
    }))
    .filter((item) => Number.isFinite(item.value));
}

function pickExtremeItem(items, direction) {
  if (!items.length) {
    return null;
  }

  return items.slice().sort((left, right) => direction === "max" ? right.value - left.value : left.value - right.value)[0];
}

function normalizeLegacyOverview(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  if (typeof data.sampleSize === "number") {
    return data;
  }

  if (typeof data.totalFormularios !== "number") {
    return null;
  }

  const topicLabels = {
    entrada: "Entrada",
    residuos: "Resíduos",
    output: "Saída",
    vida: "Vida útil",
    monitoramento: "Monitoramento"
  };

  const stageLabels = {
    entrada: "Entrada",
    residuos: "Resíduos",
    desmonte: "Desmonte",
    reciclabilidade: "Reciclabilidade",
    aterro: "Aterro",
    recuperacaoEnergia: "Recuperação de energia",
    reaproveitamento: "Reaproveitamento"
  };

  const topicPercentages = entriesToMetricItems(data.topicos, topicLabels);
  const pcmDimensoes = entriesToMetricItems(data.pcmDimensoes, stageLabels);
  const imeDimensoes = entriesToMetricItems(data.imeDimensoes, stageLabels);
  const strongestTopic = pickExtremeItem(topicPercentages, "max");
  const weakestTopic = pickExtremeItem(topicPercentages, "min");
  const weakestStage = pickExtremeItem(pcmDimensoes.length ? pcmDimensoes : topicPercentages, "min");
  const strongestStage = pickExtremeItem(pcmDimensoes.length ? pcmDimensoes : topicPercentages, "max");
  const igcAverage = Number(data.mediaIGC || 0);
  const pcmAverage = Number(data.mediaPCM || 0);

  return {
    sampleSize: Number(data.totalFormularios || 0),
    filters: {},
    availableFilters: null,
    kpis: {
      validAssessments: Number(data.totalFormularios || 0),
      totalPointsAverage: Number(data.mediaTotalPontos || 0),
      igcAverage,
      pcmAverage,
      igcGap: Number(data.igcGap ?? Math.max(0, 100 - igcAverage))
    },
    chartData: {
      topicPercentages,
      materialProfile: pcmDimensoes.length ? pcmDimensoes : topicPercentages,
      productProfile: imeDimensoes.length ? imeDimensoes : topicPercentages
    },
    cognitiveReadout: {
      strongestStage: strongestStage?.label || strongestTopic?.label || "Sem leitura",
      weakestStage: weakestStage?.label || weakestTopic?.label || "Sem leitura",
      concentration: "dados consolidados da API",
      sampleQuality:
        Number(data.totalFormularios || 0) >= 10
          ? "amostra consolidada"
          : "amostra reduzida",
      executivePriorities: [
        weakestStage || weakestTopic
          ? `Priorizar o bloco ${(weakestStage || weakestTopic).label}.`
          : null,
        strongestStage || strongestTopic
          ? `Preservar a força do bloco ${(strongestStage || strongestTopic).label}.`
          : null
      ].filter(Boolean),
      leadershipQuestions: [
        "Qual indicador precisa de ação primeiro?",
        "Qual bloco concentra o maior gap?",
        "Que recorte adicional vale abrir na próxima análise?"
      ]
    },
    recentAssessments: [],
    standoutCompanies: [],
    attentionCompanies: []
  };
}

function renderOverview(data) {
  lastOverview = data;
  updateFilterOptions(data);

  const executivePriorities =
    data.cognitiveReadout.executivePriorities.length
      ? data.cognitiveReadout.executivePriorities
      : ["Nenhuma prioridade critica detectada no recorte atual."];

  setStatus(`
    <div class="status-row">
      <div>
        <p class="eyebrow">Amostra consolidada</p>
        <h2>${data.sampleSize} avaliacoes validas no recorte atual</h2>
        <p class="muted">
          Qualidade da amostra: ${escapeHtml(data.cognitiveReadout.sampleQuality)}. Concentracao:
          ${escapeHtml(data.cognitiveReadout.concentration)}.
        </p>
      </div>
      <div class="status-aside">
        <span class="status-pill">Atualizado ${escapeHtml(formatDate(new Date().toISOString()))}</span>
        <span class="status-pill">Melhor bloco: ${escapeHtml(data.cognitiveReadout.strongestStage || "Sem leitura")}</span>
        <span class="status-pill status-pill-alert">Ponto de atencao: ${escapeHtml(data.cognitiveReadout.weakestStage || "Sem leitura")}</span>
      </div>
    </div>
  `);

  kpisRoot.innerHTML = [
    renderMetricCard("Total de formularios", formatNumber(data.kpis.validAssessments), "Submissoes persistidas e validas.", "green"),
    renderMetricCard("Media total de pontos", formatNumber(data.kpis.totalPointsAverage, 2), "Media convertida a partir do PCM.", "blue"),
    renderMetricCard("Media IGC", formatPercent(data.kpis.igcAverage), "Indicador geral de circularidade do recorte.", "green"),
    renderMetricCard("Media PCM", formatPcmPercent(data.kpis.pcmAverage), "Pontuacao media normalizada pelas 12 questoes.", "violet")
  ].join("");

  chartsRoot.innerHTML = [
    renderChartCard(
      "Percentual de pontos por topico",
      buildBarChart(data.chartData.topicPercentages.map((item) => ({ label: item.label, value: item.value }))),
      "Os cinco blocos do PDF mostram onde a maturidade media esta mais forte ou mais fragil."
    ),
    renderChartCard(
      "Indice Global de Circularidade (IGC)",
      buildDonutChart(data.kpis.igcAverage, data.kpis.igcGap),
      "O IGC sintetiza o quao circular e o modelo avaliado, consolidando entrada, residuos, saida, vida util e monitoramento."
    ),
    renderChartCard(
      "Perfil de Circularidade de Materiais",
      buildRadarChart(data.chartData.materialProfile, "green"),
      "Este radar representa sinais agregados de origem, residuos, reciclabilidade, retorno e fim de vida."
    ),
    renderChartCard(
      "Indice de Circularidade do Produto",
      buildRadarChart(data.chartData.productProfile, "blue"),
      "Visao media dos cinco blocos: Entrada, Gestao de Residuos, Saida do Produto, Vida Util e Monitoramento."
    )
  ].join("");

  tablesRoot.innerHTML = [
    renderTableCard(
      "Empresas em evidencia",
      data.standoutCompanies.map((row) => ({
        company: row.company,
        city: row.city,
        igc: formatPercent(row.igc),
        band: row.band
      })),
      [
        { key: "company", label: "Empresa" },
        { key: "city", label: "Cidade" },
        { key: "igc", label: "IGC" },
        { key: "band", label: "Banda" }
      ]
    ),
    renderTableCard(
      "Avaliacoes recentes",
      data.recentAssessments.map((row) => ({
        company: row.company,
        product: row.product,
        location: `${row.city}/${row.state}`,
        igc: formatPercent(row.igc),
        createdAt: formatDate(row.createdAt)
      })),
      [
        { key: "company", label: "Empresa" },
        { key: "product", label: "Produto" },
        { key: "location", label: "Cidade / UF" },
        { key: "igc", label: "IGC" },
        { key: "createdAt", label: "Data" }
      ]
    )
  ].join("");

  strategyRoot.innerHTML = `
    <div class="panel-header">
      <div>
        <h2>Pontos estrategicos de atencao</h2>
        <p class="muted">
          Direcionadores imediatos para a proxima rodada de melhoria e para a leitura executiva do territorio.
        </p>
      </div>
    </div>

    <div class="strategy-grid">
      <article class="strategy-card">
        <h3>Prioridades executivas</h3>
        <ul>${executivePriorities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>

      <article class="strategy-card">
        <h3>Perguntas de lideranca</h3>
        <ul>${data.cognitiveReadout.leadershipQuestions.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </article>

      <article class="strategy-card">
        <h3>Empresas de atencao</h3>
        <ul>
          ${data.attentionCompanies.length
            ? data.attentionCompanies
                .map(
                  (item) =>
                    `<li>${escapeHtml(item.company)}: ${escapeHtml(item.band)} com ${escapeHtml(formatPercent(item.igc))}</li>`
                )
                .join("")
            : "<li>Sem alertas no recorte atual.</li>"}
        </ul>
      </article>
    </div>
  `;
}

function renderEmptyState(message) {
  setStatus(`
    <p class="eyebrow">Sem dados</p>
    <h2>Nenhuma avaliacao encontrada</h2>
    <p class="muted">${escapeHtml(message)}</p>
  `);

  kpisRoot.innerHTML = "";
  chartsRoot.innerHTML = "";
  tablesRoot.innerHTML = "";
  strategyRoot.innerHTML = "";
}

async function loadOverview(filters = getFilters()) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value)
  ).toString();

  setStatus(`
    <p class="eyebrow">Carregando</p>
    <h2>Consultando o backend</h2>
    <p class="muted">A leitura executiva depende dos dados persistidos na API.</p>
  `);

  try {
    const response = await fetchComTimeout(`${apiBaseUrl}/api/dashboard/overview${query ? `?${query}` : ""}`);
    const payload = await response.json();
    const source = payload?.data && typeof payload.data === "object" ? payload.data : payload;
    const overview = normalizeLegacyOverview(source);

    if (!response.ok) {
      throw new Error(payload.error || source.error || "Falha ao carregar o dashboard.");
    }

    if (!overview) {
      throw new Error("Formato de resposta da API nao reconhecido.");
    }

    if (!overview.sampleSize) {
      updateFilterOptions(overview);
      renderEmptyState("Ajuste periodo, cidade, UF ou produto para ampliar o recorte.");
      return;
    }

    renderOverview(overview);
  } catch (error) {
    setStatus(
      `
        <p class="eyebrow">Dashboard indisponivel</p>
        <h2>Nao foi possivel consultar a API</h2>
        <p class="muted">${escapeHtml(error.message)}</p>
      `,
      "error"
    );
    kpisRoot.innerHTML = "";
    chartsRoot.innerHTML = "";
    tablesRoot.innerHTML = "";
    strategyRoot.innerHTML = "";
  }
}

function getFilters() {
  const formData = new FormData(form);
  return {
    product: String(formData.get("product") || "").trim(),
    city: String(formData.get("city") || "").trim(),
    state: String(formData.get("state") || "").trim().toUpperCase(),
    startDate: String(formData.get("startDate") || "").trim(),
    endDate: String(formData.get("endDate") || "").trim()
  };
}

function resetAutoRefresh() {
  if (autoRefreshTimer) {
    window.clearInterval(autoRefreshTimer);
    autoRefreshTimer = null;
  }

  if (autoRefreshInput.checked) {
    autoRefreshTimer = window.setInterval(() => loadOverview(), 60000);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  loadOverview();
});

autoRefreshInput.addEventListener("change", resetAutoRefresh);

form.elements.startDate.value = daysAgoString(30);
form.elements.endDate.value = todayString();

loadOverview();

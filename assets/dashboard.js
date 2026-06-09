const apiBaseUrl = window.APP_CONFIG?.apiBaseUrl || "http://localhost:3001";
const form = document.querySelector("#filter-form");
const statusRoot = document.querySelector("#dashboard-status");
const kpisRoot = document.querySelector("#kpis-root");
const insightsRoot = document.querySelector("#insights-root");
const tablesRoot = document.querySelector("#tables-root");

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderMetricCard(label, value, detail) {
  return `
    <article class="card">
      <p class="eyebrow">${escapeHtml(label)}</p>
      <div class="metric">${escapeHtml(value)}</div>
      <p class="muted">${escapeHtml(detail)}</p>
    </article>
  `;
}

function renderListCard(title, items) {
  return `
    <article class="card">
      <h2>${escapeHtml(title)}</h2>
      <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </article>
  `;
}

function renderTableCard(title, rows, columns) {
  const head = columns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join("");
  const body = rows
    .map(
      (row) => `
        <tr>
          ${columns.map((column) => `<td>${escapeHtml(row[column.key])}</td>`).join("")}
        </tr>
      `
    )
    .join("");

  return `
    <article class="card">
      <h2>${escapeHtml(title)}</h2>
      <table>
        <thead><tr>${head}</tr></thead>
        <tbody>${body || `<tr><td colspan="${columns.length}">Sem dados.</td></tr>`}</tbody>
      </table>
    </article>
  `;
}

function renderOverview(data) {
  statusRoot.className = "card";
  statusRoot.innerHTML = `
    <p class="eyebrow">Amostra</p>
    <h2>${data.sampleSize} avaliacoes validas no recorte atual</h2>
    <p class="muted">
      Leitura de amostra: ${escapeHtml(data.cognitiveReadout.sampleQuality)}. Concentracao:
      ${escapeHtml(data.cognitiveReadout.concentration)}.
    </p>
  `;

  kpisRoot.innerHTML = [
    renderMetricCard("Empresas unicas", data.kpis.uniqueCompanies, "Documentos unicos no recorte."),
    renderMetricCard("Avaliacoes validas", data.kpis.validAssessments, "Submissoes persistidas."),
    renderMetricCard("IGC medio", data.kpis.igcAverage, "Indicador geral de circularidade."),
    renderMetricCard("PCM medio", data.kpis.pcmAverage, "Pontuacao media por chave analitica."),
    renderMetricCard('Taxa media de "Nao sei"', `${data.kpis.notKnownRateAverage}%`, "Sinal de desconhecimento da base."),
    renderMetricCard("Confianca amostral", `${data.kpis.confidenceAverage}%`, "Quanto menor a taxa de desconhecimento, maior a confianca.")
  ].join("");

  insightsRoot.innerHTML = [
    renderListCard("Prioridades executivas", data.cognitiveReadout.executivePriorities.length ? data.cognitiveReadout.executivePriorities : ["Nenhuma prioridade critica detectada."]),
    renderListCard(
      "Leitura por estagio",
      data.stageAverages.map((stage) => `${stage.stageTitle}: ${stage.percentage}%`)
    ),
    renderListCard(
      "Perguntas de lideranca",
      data.cognitiveReadout.leadershipQuestions
    ),
    renderListCard(
      "Distribuicao por maturidade",
      data.maturityDistribution.length
        ? data.maturityDistribution.map((item) => `${item.band}: ${item.count}`)
        : ["Sem distribuicao disponivel."]
    )
  ].join("");

  tablesRoot.innerHTML = [
    renderTableCard("Empresas em evidencia", data.standoutCompanies, [
      { key: "company", label: "Empresa" },
      { key: "igc", label: "IGC" },
      { key: "band", label: "Banda" }
    ]),
    renderTableCard("Empresas de atencao", data.attentionCompanies, [
      { key: "company", label: "Empresa" },
      { key: "igc", label: "IGC" },
      { key: "band", label: "Banda" }
    ]),
    renderTableCard("Avaliacoes recentes", data.recentAssessments, [
      { key: "company", label: "Empresa" },
      { key: "city", label: "Cidade" },
      { key: "state", label: "UF" },
      { key: "band", label: "Banda" },
      { key: "igc", label: "IGC" }
    ])
  ].join("");
}

async function loadOverview(filters = {}) {
  const query = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value)
  ).toString();

  statusRoot.className = "card";
  statusRoot.innerHTML = `
    <p class="eyebrow">Carregando</p>
    <h2>Consultando o backend</h2>
    <p class="muted">A leitura coletiva depende de dados persistidos na API.</p>
  `;

  try {
    const response = await fetch(`${apiBaseUrl}/api/dashboard/overview${query ? `?${query}` : ""}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Falha ao carregar o dashboard.");
    }

    renderOverview(data);
  } catch (error) {
    statusRoot.className = "card status-error";
    statusRoot.innerHTML = `
      <p class="eyebrow">Dashboard indisponivel</p>
      <h2>Nao foi possivel consultar a API</h2>
      <p class="muted">${escapeHtml(error.message)}</p>
    `;
    kpisRoot.innerHTML = "";
    insightsRoot.innerHTML = "";
    tablesRoot.innerHTML = "";
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  loadOverview({
    city: String(formData.get("city") || "").trim(),
    state: String(formData.get("state") || "").trim().toUpperCase(),
    segment: String(formData.get("segment") || "").trim()
  });
});

loadOverview();

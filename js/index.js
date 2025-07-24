document.addEventListener("DOMContentLoaded", function () {
  const API_BASE_URL = "https://servicebus2.caixa.gov.br/portaldeloterias/api";

  let currentGame = "megasena";
  let currentYear = new Date().getFullYear();
  let activeFetchController = null;

  const gameTabMs = document.getElementById("game-tab-ms");
  const gameTabLf = document.getElementById("game-tab-lf");
  const gameTabQn = document.getElementById("game-tab-qn");
  const gameTabLm = document.getElementById("game-tab-lm");
  const yearSelector = document.getElementById("year-selector");
  const explorar = document.getElementById("explorar");
  const drawListContainer = document.getElementById("draw-list");
  const loadingIndicator = document.getElementById("loading-indicator");
  const loadingProgress = document.getElementById("loading-progress");
  const errorMessage = document.getElementById("error-message");
  const summaryContainer = document.getElementById("summary-container");
  const totalWinningsSpan = document.getElementById("total-winnings");
  const summaryYearSpan = document.getElementById("summary-year");
  const contestSearchInput = document.getElementById("contest-search-input");
  const contestSearchButton = document.getElementById("contest-search-button");

  const modal = document.getElementById("draw-modal");
  const modalContent = document.getElementById("modal-content");
  const modalCloseBtn = document.getElementById("modal-close");
  const modalTitle = document.getElementById("modal-title");
  const modalDezenas = document.getElementById("modal-dezenas");
  const modalOutrosPremios = document.getElementById("modal-outros-premios");
  const modalTotalPrizeContainer = document.getElementById(
    "modal-total-prize-container"
  );

  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach((btn) => {
        btn.removeAttribute("data-selected");
        btn.classList.remove("active");
      });
      button.setAttribute("data-selected", "true");
      button.classList.add("active");
    });
  });

  const formatPrize = (value) =>
    `R$ ${value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;

  function showLoading(show) {
    loadingIndicator.classList.toggle("hidden", !show);
  }

  function updateLoadingProgress(text) {
    loadingProgress.textContent = text;
  }

  function showError(message) {
    errorMessage.querySelector("p").textContent = message;
    errorMessage.classList.remove("hidden");
  }

  function hideError() {
    errorMessage.classList.add("hidden");
  }

  async function fetchLotteryData(game, contest, signal) {
    try {
      const response = await fetch(`${API_BASE_URL}/${game}/${contest}`, {
        signal,
      });
      if (!response.ok) {
        return { error: true, status: response.status, concurso: contest };
      }
      const data = await response.json();
      data.year = new Date(
        data.dataApuracao.split("/").reverse().join("-")
      ).getFullYear();
      return data;
    } catch (error) {
      if (error.name === "AbortError") {
        return { aborted: true };
      }
      return { error: true, status: "network", concurso: contest };
    }
  }

  function renderResultCard(container, data, game) {
    if (!data) return;

    const card = document.createElement("div");
    card.className =
      "draw-card bg-white p-3 rounded-lg border border-stone-200 shadow-sm text-sm";

    const winnerClass = data.acumulado ? "text-red-600" : "text-green-600";
    const winnerIcon = data.acumulado ? "✗" : "✓";
    const winnerText = data.acumulado ? `Acumulou!` : `Teve Ganhador!`;

    let prizeInfoHtml = "";
    if (data.acumulado) {
      const nextPrize =
        data.valorEstimadoProximoConcurso > 0
          ? data.valorEstimadoProximoConcurso
          : data.valorAcumuladoProximoConcurso;
      prizeInfoHtml = `<div class="text-xs text-stone-500">Próximo: ${formatPrize(
        nextPrize
      )}</div>`;
    } else {
      const mainPrizeTier =
        data.listaRateioPremio.length > 0 ? data.listaRateioPremio[0] : null;
      if (mainPrizeTier) {
        const totalMainPrize =
          mainPrizeTier.valorPremio * mainPrizeTier.numeroDeGanhadores;
        prizeInfoHtml = `<div class="text-xs text-stone-500">Prêmio Total: ${formatPrize(
          totalMainPrize
        )}</div>`;
      }
    }

    card.innerHTML = `
                    <div class="flex justify-between items-center">
                        <span class="font-semibold text-stone-800">Concurso ${String(
                          data.numero
                        ).padStart(4, "0")}</span>
                        <span class="text-xs text-stone-500">${
                          data.dataApuracao
                        }</span>
                    </div>
                    <div class="font-bold mt-1 ${winnerClass}">${winnerIcon} ${winnerText}</div>
                    ${prizeInfoHtml}
                 `;
    card.addEventListener("click", () => showModal(data, game));
    container.appendChild(card);
  }

  async function showModal(data, game) {
    const gameInfo = await getInfoMod(game);
    modalTitle.innerHTML = `
                    <div class="text-2xl font-bold text-amber-900">${gameInfo.nome}</div>
                    <div class="text-sm font-normal text-stone-600">Concurso ${String(
                      data.numero
                    ).padStart(4, "0")} - ${data.dataApuracao}</div>
                `;

    modalDezenas.innerHTML = "";
    const dezenasColor = gameInfo.style;
    data.listaDezenas.forEach((dezena) => {
      const ball = document.createElement("div");
      ball.className = `w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${dezenasColor}`;
      ball.textContent = String(dezena).padStart(2, "0");
      modalDezenas.appendChild(ball);
    });

    if (data.acumulado) {
      modalTotalPrizeContainer.innerHTML = `
                        <h4 class="font-semibold text-red-600 text-2xl mb-1">ACUMULOU!</h4>
                    `;
      modalTotalPrizeContainer.classList.remove("hidden");
    } else if (!data.acumulado && data.listaRateioPremio.length > 0) {
      const mainPrizeTier = data.listaRateioPremio[0];
      const totalMainPrize =
        mainPrizeTier.valorPremio * mainPrizeTier.numeroDeGanhadores;
      modalTotalPrizeContainer.innerHTML = `
                        <h4 class="font-semibold text-stone-700 mb-1">Prêmio Principal Total</h4>
                        <p class="text-2xl font-bold text-green-600">${formatPrize(
                          totalMainPrize
                        )}</p>
                    `;
      modalTotalPrizeContainer.classList.remove("hidden");
    } else {
      modalTotalPrizeContainer.classList.add("hidden");
      modalTotalPrizeContainer.innerHTML = "";
    }

    modalOutrosPremios.innerHTML = "";

    const table = document.createElement("table");
    table.className = "w-full text-left text-sm";

    const tableBodyHtml = data.listaRateioPremio
      .map((p, index) => {
        let rowClass = "bg-white border-b border-stone-100";
        if (index === 0) {
          rowClass += data.acumulado
            ? " font-bold bg-red-50"
            : " font-bold bg-green-50";
        }
        return `
                        <tr class="${rowClass}">
                            <td class="px-4 py-2 font-medium text-stone-900">${
                              p.descricaoFaixa
                            }</td>
                            <td class="px-4 py-2 text-right">${p.numeroDeGanhadores.toLocaleString(
                              "pt-BR"
                            )}</td>
                            <td class="px-4 py-2 text-right">${formatPrize(
                              p.valorPremio
                            )}</td>
                        </tr>
                    `;
      })
      .join("");

    const nextPrize =
      data.valorEstimadoProximoConcurso > 0
        ? data.valorEstimadoProximoConcurso
        : data.valorAcumuladoProximoConcurso;
    const tableFooterHtml = data.acumulado
      ? `
                    <tfoot class="bg-stone-100">
                        <tr>
                            <td colspan="3" class="px-4 py-2 text-sm text-center text-stone-700">
                                Valor para o próximo concurso: <strong>${formatPrize(
                                  nextPrize
                                )}</strong>
                            </td>
                        </tr>
                    </tfoot>
                `
      : "";

    table.innerHTML = `
                    <thead class="text-xs text-stone-700 uppercase bg-stone-100">
                        <tr>
                            <th scope="col" class="px-4 py-2">Faixa</th>
                            <th scope="col" class="px-4 py-2 text-right">Ganhadores</th>
                            <th scope="col" class="px-4 py-2 text-right">Prêmio (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableBodyHtml}
                    </tbody>
                    ${tableFooterHtml}
                `;
    modalOutrosPremios.appendChild(table);

    modal.classList.remove("pointer-events-none");
    modal.classList.add("bg-opacity-50");
    modalContent.classList.remove("opacity-0", "scale-95");
  }

  function hideModal() {
    modal.classList.remove("bg-opacity-50");
    modalContent.classList.add("opacity-0", "scale-95");
    setTimeout(() => {
      modal.classList.add("pointer-events-none");
    }, 300);
  }

  async function findContestBoundary(
    game,
    year,
    latestContest,
    findFirst,
    signal
  ) {
    let low = 1;
    let high = latestContest;
    let boundaryContest = -1;

    while (low <= high) {
      if (signal.aborted) return -1;
      let mid = Math.floor((low + high) / 2);
      if (mid === 0) break;

      updateLoadingProgress(`Verificando concurso ${mid}...`);
      const concursoExistente = await buscarDadosJson(mid);
      const data = concursoExistente
        ? concursoExistente
        : await fetchLotteryData(game, mid, signal);

      if (!data.error) {
        if (!concursoExistente) {
          if (!concursos[currentGame][data.year]) {
            concursos[currentGame][data.year] = [];
          }
          if (
            !concursos[currentGame][data.year]?.find((c) => c.numero === mid)
          ) {
            concursos[currentGame][data.year].push(data);
          }
        }
      }

      if (data && !data.error && !data.aborted) {
        if (findFirst) {
          // Finding the first contest of the year
          if (data.year < year) {
            low = mid + 1;
          } else {
            // data.year >= year
            boundaryContest = mid;
            high = mid - 1;
          }
        } else {
          // Finding the last contest of the year
          if (data.year <= year) {
            boundaryContest = mid;
            low = mid + 1;
          } else {
            // data.year > year
            high = mid - 1;
          }
        }
      } else {
        high = mid - 1;
      }
    }
    ordenarConcursosPorNumero(concursos);
    return boundaryContest;
  }

  let concursos = {};
  const tiposDeJogo = ["megasena", "lotofacil", "quina", "lotomania"];
  async function buscarDadosJson(numeroConcurso) {
    if (!concursos[currentGame]) concursos[currentGame] = {};
    if (!tiposDeJogo.includes(currentGame)) {
      /*console.warn(
        `Tipo de jogo "${currentGame}" não está registrado em tiposDeJogo.`
      );*/
      return;
    }
    try {
      const response = await fetch(`../dados/${currentGame}.json`);
      const jsonConcursos = await response.json();
      //console.log(jsonConcursos);
      for (const ano in jsonConcursos) {
        const emJsonLocal = jsonConcursos[ano].find(
          (c) => c.numero === numeroConcurso
        );
        if (emJsonLocal) {
          if (!concursos[currentGame][emJsonLocal.year])
            concursos[currentGame][emJsonLocal.year] = [];
          if (
            !concursos[currentGame][emJsonLocal.year]?.find(
              (c) => c.numero === numeroConcurso
            )
          ) {
            concursos[currentGame][emJsonLocal.year].push(emJsonLocal);
          }
          return emJsonLocal;
        }
      }
    } catch (e) {
      return false;
    }
  }

  /*function buscarConcursoPorNumero(concursos, numeroProcurado) {
    for (const ano in concursos) {
      const encontrado = concursos[ano].find(
        (c) => c.numero === numeroProcurado
      );
      if (encontrado) return encontrado;
    }
    return null;
  }*/

  function ordenarConcursosPorNumero(concursos) {
    for (const ano in concursos[currentGame]) {
      concursos[currentGame][ano].sort((a, b) => a.numero - b.numero);
    }
  }

  async function loadYearData() {
    if (activeFetchController) {
      activeFetchController.abort();
    }
    activeFetchController = new AbortController();
    const signal = activeFetchController.signal;

    drawListContainer.innerHTML = "";
    hideError();
    summaryContainer.classList.add("hidden");
    let totalWinnings = 0;
    totalWinningsSpan.textContent = formatPrize(totalWinnings);
    showLoading(true);
    updateLoadingProgress("Buscando último concurso...");

    const latestData = await fetchLotteryData(currentGame, "", signal);
    if (signal.aborted) return;
    if (!latestData || latestData.error) {
      showLoading(false);
      showError("Não foi possível buscar os dados iniciais.");
      return;
    }

    updateLoadingProgress("Localizando concursos do ano...");
    const firstContestOfNextYear = await findContestBoundary(
      currentGame,
      currentYear + 1,
      latestData.numero,
      true,
      signal
    );
    if (signal.aborted) return;

    const lastContestOfCurrentYear =
      firstContestOfNextYear !== -1
        ? firstContestOfNextYear - 1
        : latestData.numero;

    const firstContestOfCurrentYear = await findContestBoundary(
      currentGame,
      currentYear,
      lastContestOfCurrentYear,
      true,
      signal
    );
    if (signal.aborted) return;

    if (firstContestOfCurrentYear === -1) {
      showLoading(false);
      drawListContainer.innerHTML = `<p class="col-span-full text-center text-stone-500 p-8">Nenhum resultado encontrado para ${currentGame} em ${currentYear}.</p>`;
      return;
    }

    summaryContainer.classList.remove("hidden");
    summaryYearSpan.textContent = currentYear;
    let foundContestsCount = 0;
    for (
      let contestToFetch = lastContestOfCurrentYear;
      contestToFetch >= firstContestOfCurrentYear;
      contestToFetch--
    ) {
      if (signal.aborted) break;

      updateLoadingProgress(`Buscando concurso ${contestToFetch}...`);
      const concursoExistente = await buscarDadosJson(contestToFetch);
      const data = concursoExistente
        ? concursoExistente
        : await fetchLotteryData(currentGame, contestToFetch, signal);
      // const jaExiste = concursos[currentYear]?.some(
      //   (c) => c.numero === contestToFetch
      // );

      if (!data.error) {
        if (!concursoExistente) {
          if (!concursos[currentGame][data.year]) {
            concursos[currentGame][data.year] = [];
          }
          if (
            !concursos[currentGame][data.year]?.find(
              (c) => c.numero === contestToFetch
            )
          ) {
            concursos[currentGame][data.year].push(data);
          }
        }
      }

      if (data && !data.error && !data.aborted && data.year === currentYear) {
        renderResultCard(drawListContainer, data, currentGame);
        if (!data.acumulado) {
          const mainPrizeTier =
            data.listaRateioPremio.length > 0
              ? data.listaRateioPremio[0]
              : null;
          if (mainPrizeTier) {
            const totalMainPrize =
              mainPrizeTier.valorPremio * mainPrizeTier.numeroDeGanhadores;
            totalWinnings += totalMainPrize;
            totalWinningsSpan.textContent = formatPrize(totalWinnings);
          }
        }
        foundContestsCount++;
      } else if (data && data.error && data.status !== 404) {
        showError("Ocorreu um erro ao buscar os dados. Tente novamente.");
        break;
      }
    }

    if (!signal.aborted) {
      showLoading(false);
      if (foundContestsCount === 0) {
        summaryContainer.classList.add("hidden");
        drawListContainer.innerHTML = `<p class="col-span-full text-center text-stone-500 p-8">Nenhum resultado encontrado para ${currentGame} em ${currentYear}.</p>`;
      }
    }
    console.log(concursos);
    ordenarConcursosPorNumero(concursos);
  }

  async function getGameName(game) {
    const infoMod = await getInfoMod(currentGame);
    const gameName = infoMod.nome;

    return `Explorar ${gameName} por Ano`;
  }

  async function setupYearSelector() {
    const infoMod = await getInfoMod(currentGame);
    yearSelector.innerHTML = "";
    explorar.innerHTML = "Explorar por Ano";
    const startYear = infoMod.anoinicio;
    const endYear = new Date().getFullYear();
    for (let y = endYear; y >= startYear; y--) {
      const button = document.createElement("button");
      button.textContent = y;
      button.dataset.year = y;
      button.className =
        "year-button py-1 px-3 text-sm font-medium text-stone-700 bg-white rounded-md border border-stone-200 hover:bg-stone-100 hover:text-stone-700 transition-colors";
      if (y === currentYear) button.classList.add("active");
      button.addEventListener("click", () => {
        currentYear = y;
        document
          .querySelectorAll("#year-selector button")
          .forEach((b) => b.classList.remove("active"));
        button.classList.add("active");
        loadYearData();
      });
      yearSelector.appendChild(button);
    }
    explorar.innerHTML = await getGameName(currentGame);
  }

  async function handleContestSearch() {
    const infoMod = await getInfoMod(currentGame);
    const contestNumber = contestSearchInput.value;
    if (!contestNumber) {
      showError("Por favor, digite um número de concurso.");
      return;
    }
    hideError();
    showLoading(true);
    updateLoadingProgress(`Buscando concurso ${contestNumber}...`);
    //const concursoExistente = await buscarDadosJson(+contestNumber);
    //console.log(concursoExistente);
    const data = /*concursoExistente
      ? concursoExistente
      :*/ await fetchLotteryData(currentGame, contestNumber);
    showLoading(false);
    if (data && !data.error) {
      showModal(data, currentGame);
    } else {
      showError(
        `Concurso ${contestNumber} não encontrado para ${infoMod.nome}.`
      );
    }
  }

  const tiposJogos = [];

  async function getInfoMod(currentGame) {
    if (tiposJogos.length === 0) {
      const response = await fetch("../dados/modalidades.json");
      const data = await response.json();
      tiposJogos.push(...data);
    }
    return tiposJogos.find((c) => c.id === currentGame);
  }

  gameTabMs.addEventListener("click", () => {
    currentGame = "megasena";
    currentYear = new Date().getFullYear();
    /*gameTabMs.classList.add("active");
    gameTabLf.classList.remove("active");
    gameTabQn.classList.remove("active");*/
    setupYearSelector();
    loadYearData();
  });

  gameTabLf.addEventListener("click", () => {
    currentGame = "lotofacil";
    currentYear = new Date().getFullYear();
    /*gameTabLf.classList.add("active");
    gameTabMs.classList.remove("active");
    gameTabQn.classList.remove("active");*/
    setupYearSelector();
    loadYearData();
  });

  gameTabQn.addEventListener("click", () => {
    currentGame = "quina";
    currentYear = new Date().getFullYear();
    /*/gameTabQn.classList.add("active");
    gameTabMs.classList.remove("active");
    gameTabLf.classList.remove("active");*/
    setupYearSelector();
    loadYearData();
  });

  gameTabLm.addEventListener("click", () => {
    currentGame = "lotomania";
    currentYear = new Date().getFullYear();
    /*/gameTabQn.classList.add("active");
    gameTabMs.classList.remove("active");
    gameTabLf.classList.remove("active");*/
    setupYearSelector();
    loadYearData();
  });

  contestSearchButton.addEventListener("click", handleContestSearch);
  contestSearchInput.addEventListener("keyup", (e) => {
    if (e.key === "Enter") handleContestSearch();
  });

  modalCloseBtn.addEventListener("click", hideModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) hideModal();
  });

  // Initial Load
  setupYearSelector();
  loadYearData();
});

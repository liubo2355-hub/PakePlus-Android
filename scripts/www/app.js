const typeNames = {
  single: "单项选择题",
  multiple: "多项选择题",
  judge: "判断题",
  blank: "填空题",
};

const HISTORY_KEY = "partyQuizHistoryV1";

let allQuestions = [];
let session = {
  mode: "practice",
  questions: [],
  current: 0,
  answers: {},
  checked: {},
  submitted: false,
};

const $ = (id) => document.getElementById(id);

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 100)));
}

function addHistoryRecord(record) {
  const history = loadHistory();
  history.unshift(record);
  saveHistory(history);
}

function formatTime(value) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function arraysEqual(a, b) {
  return JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, "").replace(/[。；;，,]/g, "");
}

function getCounts() {
  return allQuestions.reduce((acc, question) => {
    acc.total += 1;
    acc[question.type] = (acc[question.type] || 0) + 1;
    return acc;
  }, { total: 0 });
}

function updateStats() {
  const counts = getCounts();
  $("questionStats").textContent = `题库共 ${counts.total} 题，模拟考试每次随机抽 50 题`;
  $("totalCount").textContent = counts.total;
  $("singleCount").textContent = counts.single || 0;
  $("multipleCount").textContent = counts.multiple || 0;
  $("judgeCount").textContent = counts.judge || 0;
  $("blankCount").textContent = counts.blank || 0;
}

function showView(name) {
  $("homeView").classList.toggle("hidden", name !== "home");
  $("quizView").classList.toggle("hidden", name !== "quiz");
  $("resultView").classList.toggle("hidden", name !== "result");
  $("historyView").classList.toggle("hidden", name !== "history");
  $("sheetToggle").classList.toggle("hidden", name !== "quiz");
  $("homeButton").classList.toggle("hidden", name === "home");
  if (name === "history") renderHistory();
}

function startPractice() {
  const filter = $("typeFilter").value;
  let questions = filter === "all" ? allQuestions : allQuestions.filter((q) => q.type === filter);
  if ($("shufflePractice").checked) questions = shuffle(questions);
  session = { mode: "practice", questions, current: 0, answers: {}, checked: {}, submitted: false };
  showView("quiz");
  renderQuestion();
}

function startExam() {
  session = {
    mode: "exam",
    questions: shuffle(allQuestions).slice(0, 50),
    current: 0,
    answers: {},
    checked: {},
    submitted: false,
  };
  showView("quiz");
  renderQuestion();
}

function setAnswer(value) {
  const question = session.questions[session.current];
  if (question.type === "multiple") {
    const selected = new Set(session.answers[question.id] || []);
    selected.has(value) ? selected.delete(value) : selected.add(value);
    session.answers[question.id] = [...selected].sort();
  } else {
    session.answers[question.id] = value;
  }
  if (session.mode === "practice") {
    delete session.checked[question.id];
  }
  renderQuestion();
}

function getUserAnswer(question) {
  if (question.type === "blank") {
    return $("blankInput")?.value || session.answers[question.id] || "";
  }
  return session.answers[question.id];
}

function saveBlankAnswer() {
  const question = session.questions[session.current];
  if (question?.type === "blank") {
    session.answers[question.id] = $("blankInput")?.value || "";
  }
}

function isCorrect(question) {
  const answer = getUserAnswer(question);
  if (question.type === "single") return answer === question.answer[0];
  if (question.type === "multiple") return Array.isArray(answer) && arraysEqual(answer, question.answer);
  if (question.type === "judge") return answer === question.answer;
  return normalizeText(answer) === normalizeText(question.answer);
}

function answerText(question, answer) {
  if (!answer || (Array.isArray(answer) && answer.length === 0)) return "未作答";
  if (question.type === "single" || question.type === "multiple") {
    const keys = Array.isArray(answer) ? answer : [answer];
    return keys.map((key) => {
      const option = question.options.find((item) => item.key === key);
      return option ? `${key}. ${option.text}` : key;
    }).join("；");
  }
  return Array.isArray(answer) ? answer.join("") : answer;
}

function makeQuestionSnapshot(question) {
  return {
    id: question.id,
    type: question.type,
    stem: question.stem,
    userAnswer: getUserAnswer(question),
    correctAnswer: question.answer,
    userAnswerText: answerText(question, getUserAnswer(question)),
    correctAnswerText: answerText(question, question.answer),
    correct: isCorrect(question),
    explanation: question.explanation || "",
  };
}

function confirmAnswer() {
  const question = session.questions[session.current];
  saveBlankAnswer();
  session.checked[question.id] = true;
  addHistoryRecord({
    id: crypto.randomUUID(),
    mode: "practice",
    createdAt: new Date().toISOString(),
    total: 1,
    correctCount: isCorrect(question) ? 1 : 0,
    score: isCorrect(question) ? 2 : 0,
    questions: [makeQuestionSnapshot(question)],
  });
  renderQuestion();
}

function renderQuestion() {
  const question = session.questions[session.current];
  if (!question) return;
  const currentNumber = session.current + 1;
  $("modeLabel").textContent = session.mode === "practice" ? "练习模式" : "模拟考试";
  $("progressLabel").textContent = `第 ${currentNumber} 题 / 共 ${session.questions.length} 题`;
  $("questionTitle").textContent = `${typeNames[question.type]} · 第 ${currentNumber} 题`;
  $("questionStem").textContent = question.stem;
  renderOptions(question);
  renderFeedback(question);
  renderButtons();
  renderSheet();
}

function renderOptions(question) {
  const area = $("optionArea");
  area.innerHTML = "";
  const checked = session.checked[question.id] || session.submitted;
  const answer = session.answers[question.id];

  if (question.type === "blank") {
    const input = document.createElement("input");
    input.id = "blankInput";
    input.className = "blank-input";
    input.placeholder = "请输入答案";
    input.value = answer || "";
    input.addEventListener("input", () => {
      session.answers[question.id] = input.value;
    });
    input.disabled = checked && session.mode === "practice";
    area.appendChild(input);
    return;
  }

  const options = question.type === "judge"
    ? [{ key: "对", text: "正确" }, { key: "错", text: "错误" }]
    : question.options;
  if (question.type === "judge") area.classList.add("judge-row");
  else area.classList.remove("judge-row");

  options.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "choice";
    const selected = question.type === "multiple"
      ? Array.isArray(answer) && answer.includes(option.key)
      : answer === option.key;
    if (selected) button.classList.add("selected");
    if (checked) {
      const correctKeys = Array.isArray(question.answer) ? question.answer : [question.answer];
      if (correctKeys.includes(option.key)) button.classList.add("correct");
      if (selected && !correctKeys.includes(option.key)) button.classList.add("wrong");
    }
    button.innerHTML = `<span class="key">${option.key}</span><span>${option.text}</span>`;
    button.addEventListener("click", () => setAnswer(option.key));
    area.appendChild(button);
  });
}

function renderFeedback(question) {
  const feedback = $("feedback");
  feedback.className = "feedback hidden";
  feedback.textContent = "";
  if (!(session.checked[question.id] || session.submitted)) return;

  const correct = isCorrect(question);
  feedback.classList.remove("hidden");
  feedback.classList.add(correct ? "ok" : "bad");
  const right = answerText(question, question.answer);
  const mine = answerText(question, getUserAnswer(question));
  feedback.innerHTML = correct
    ? `回答正确。正确答案：${right}`
    : `回答错误。你的答案：${mine}<br>正确答案：${right}`;
  if (question.explanation) {
    feedback.innerHTML += `<br>${question.explanation}`;
  }
}

function renderButtons() {
  $("prevButton").disabled = session.current === 0;
  $("nextButton").textContent = session.current === session.questions.length - 1 ? "最后一题" : "下一题";
  $("answerButton").classList.toggle("hidden", session.mode !== "practice");
  $("submitButton").classList.toggle("hidden", session.mode !== "exam");
}

function renderSheet() {
  const grid = $("sheetGrid");
  grid.innerHTML = "";
  let answered = 0;
  session.questions.forEach((question, index) => {
    const hasAnswer = hasUserAnswer(question);
    if (hasAnswer) answered += 1;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "sheet-item";
    if (hasAnswer) button.classList.add("answered");
    if (index === session.current) button.classList.add("current");
    if (session.submitted && !isCorrect(question)) button.classList.add("wrong");
    button.textContent = String(index + 1).padStart(2, "0");
    button.addEventListener("click", () => {
      saveBlankAnswer();
      session.current = index;
      $("answerSheet").classList.remove("open");
      renderQuestion();
    });
    grid.appendChild(button);
  });
  $("answeredCount").textContent = `已答 ${answered} / ${session.questions.length}`;
  $("sheetToggle").textContent = `答题卡 ${answered}/${session.questions.length}`;
}

function hasUserAnswer(question) {
  const answer = session.answers[question.id];
  if (Array.isArray(answer)) return answer.length > 0;
  return String(answer || "").trim() !== "";
}

function moveQuestion(delta) {
  saveBlankAnswer();
  const next = session.current + delta;
  if (next < 0 || next >= session.questions.length) return;
  session.current = next;
  renderQuestion();
}

function submitExam() {
  saveBlankAnswer();
  session.submitted = true;
  const correctCount = session.questions.filter((question) => isCorrect(question)).length;
  const score = correctCount * 2;
  addHistoryRecord({
    id: crypto.randomUUID(),
    mode: "exam",
    createdAt: new Date().toISOString(),
    total: session.questions.length,
    correctCount,
    score,
    questions: session.questions.map((question) => makeQuestionSnapshot(question)),
  });
  $("scoreLabel").textContent = `${score} 分`;
  $("resultSummary").textContent = `共 50 题，答对 ${correctCount} 题，答错 ${50 - correctCount} 题。`;
  showView("result");
}

function reviewWrong() {
  const wrongQuestions = session.questions.filter((question) => !isCorrect(question));
  const previousAnswers = { ...session.answers };
  if (wrongQuestions.length === 0) {
    showView("home");
    return;
  }
  session = {
    mode: "practice",
    questions: wrongQuestions,
    current: 0,
    answers: previousAnswers,
    checked: Object.fromEntries(wrongQuestions.map((question) => [question.id, true])),
    submitted: true,
  };
  showView("quiz");
  renderQuestion();
}

function renderHistory() {
  const history = loadHistory();
  $("historySummary").textContent = history.length
    ? `已保存 ${history.length} 条答题记录，最多保留最近 100 条。`
    : "暂无答题历史";
  const list = $("historyList");
  list.innerHTML = "";
  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "history-item";
    empty.textContent = "完成练习题或交卷后，这里会自动保存答题记录。";
    list.appendChild(empty);
    return;
  }

  history.forEach((record) => {
    const item = document.createElement("article");
    item.className = "history-item";
    const title = record.mode === "exam" ? "模拟考试" : "练习记录";
    const wrong = record.total - record.correctCount;
    item.innerHTML = `
      <div class="history-item-main">
        <div>
          <h3>${title} · ${formatTime(record.createdAt)}</h3>
          <p>${record.total} 题，答对 ${record.correctCount} 题，答错 ${wrong} 题，得分 ${record.score} 分</p>
        </div>
        <button type="button" data-history-id="${record.id}">回看</button>
      </div>
      <div class="history-detail hidden" id="history-${record.id}"></div>
    `;
    list.appendChild(item);
  });
}

function toggleHistoryDetail(recordId) {
  const history = loadHistory();
  const record = history.find((item) => item.id === recordId);
  const detail = $(`history-${recordId}`);
  if (!record || !detail) return;
  if (!detail.classList.contains("hidden")) {
    detail.classList.add("hidden");
    return;
  }
  detail.classList.remove("hidden");
  detail.innerHTML = `
    <div class="history-detail-list">
      ${record.questions.map((question, index) => `
        <div class="history-question ${question.correct ? "ok" : "bad"}">
          <strong>${index + 1}. ${typeNames[question.type]} · ${question.correct ? "正确" : "错误"}</strong>
          <p>${question.stem}</p>
          <p>你的答案：${question.userAnswerText}</p>
          <p>正确答案：${question.correctAnswerText}</p>
          ${question.explanation ? `<p>${question.explanation}</p>` : ""}
        </div>
      `).join("")}
    </div>
  `;
}

function clearHistory() {
  if (!loadHistory().length) return;
  if (!confirm("确定要清空所有答题历史吗？")) return;
  localStorage.removeItem(HISTORY_KEY);
  renderHistory();
}

function handleEnterKey(event) {
  if (event.key !== "Enter" || $("quizView").classList.contains("hidden")) return;
  if (event.target?.tagName === "TEXTAREA") return;
  event.preventDefault();
  const question = session.questions[session.current];
  if (!question) return;
  if (session.mode === "practice" && !session.checked[question.id] && !session.submitted) {
    confirmAnswer();
    return;
  }
  moveQuestion(1);
}

function bindEvents() {
  $("practiceEntry").addEventListener("click", startPractice);
  $("examEntry").addEventListener("click", startExam);
  $("prevButton").addEventListener("click", () => moveQuestion(-1));
  $("nextButton").addEventListener("click", () => moveQuestion(1));
  $("answerButton").addEventListener("click", confirmAnswer);
  $("submitButton").addEventListener("click", submitExam);
  $("reviewWrongButton").addEventListener("click", reviewWrong);
  $("newExamButton").addEventListener("click", startExam);
  $("backHomeButton").addEventListener("click", () => showView("home"));
  $("homeButton").addEventListener("click", () => showView("home"));
  $("sheetToggle").addEventListener("click", () => $("answerSheet").classList.toggle("open"));
  $("historyEntry").addEventListener("click", () => showView("history"));
  $("historyBackButton").addEventListener("click", () => showView("home"));
  $("clearHistoryButton").addEventListener("click", clearHistory);
  $("historyList").addEventListener("click", (event) => {
    const button = event.target.closest("button[data-history-id]");
    if (button) toggleHistoryDetail(button.dataset.historyId);
  });
  document.addEventListener("keydown", handleEnterKey);
}

async function init() {
  bindEvents();
  const response = await fetch("./questions.json");
  allQuestions = await response.json();
  updateStats();
  showView("home");
}

init().catch((error) => {
  $("questionStats").textContent = `题库加载失败：${error.message}`;
});

let tasks = [];
let customFilters = [];
let editingTaskId = null;
let viewingTaskId = null;
let activeFilterView = "all";
let pendingDeleteId = null;
let dragSrcId = null;
const TASKS_KEY = "tm_tasks_v2";
const FILTERS_KEY = "tm_filters_v1";
const THEME_KEY = "tm_theme";
const SORT_KEY = "tm_sort";
function save() {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}
function load() {
  try {
    tasks = JSON.parse(localStorage.getItem(TASKS_KEY)) || [];
  } catch {
    tasks = [];
  }
  try {
    customFilters = JSON.parse(localStorage.getItem(FILTERS_KEY)) || [];
  } catch {
    customFilters = [];
  }
}
function saveFilters() {
  localStorage.setItem(FILTERS_KEY, JSON.stringify(customFilters));
}
function genId() {
  return (
    "task_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7)
  );
}
function initTheme() {
  const t = localStorage.getItem(THEME_KEY) || "light";
  document.documentElement.setAttribute("data-theme", t);
  document.getElementById("themeThumb").textContent =
    t === "dark" ? "" : "";
}
document.getElementById("themeBtn").addEventListener("click", () => {
  const cur = document.documentElement.getAttribute("data-theme");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  document.getElementById("themeThumb").textContent =
    next === "dark" ? "" : "";
  localStorage.setItem(THEME_KEY, next);
});
function initSort() {
  const s = localStorage.getItem(SORT_KEY) || "created";
  document.getElementById("sortSelect").value = s;
}
function sortTasks() {
  localStorage.setItem(
    SORT_KEY,
    document.getElementById("sortSelect").value,
  );
  renderAll();
}
function setFilterView(key, btn) {
  activeFilterView = key;
  document
    .querySelectorAll(".sidebar-btn")
    .forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
  renderAll();
}
function passesFilterView(task) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (activeFilterView === "all") return true;
  if (activeFilterView === "today") {
    if (!task.deadline) return false;
    const d = new Date(task.deadline);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }
  if (activeFilterView === "overdue") {
    if (!task.deadline) return false;
    const d = new Date(task.deadline);
    d.setHours(0, 0, 0, 0);
    return d < today && task.status !== "completed";
  }
  if (activeFilterView === "high") return task.priority === "high";
  if (activeFilterView.startsWith("cat_"))
    return task.filter === activeFilterView;
  return task.filter === activeFilterView;
}
const PRIORITY_ORDER = { high: 0, med: 1, low: 2, none: 3 };
function getSortedTasks(arr) {
  const sortBy = document.getElementById("sortSelect").value;
  return [...arr].sort((a, b) => {
    if (sortBy === "deadline") {
      const da = a.deadline
        ? new Date(a.deadline)
        : new Date("9999-12-31");
      const db = b.deadline
        ? new Date(b.deadline)
        : new Date("9999-12-31");
      return da - db;
    }
    if (sortBy === "priority")
      return (
        (PRIORITY_ORDER[a.priority] || 3) -
        (PRIORITY_ORDER[b.priority] || 3)
      );
    if (sortBy === "name")
      return (a.name || "").localeCompare(b.name || "");
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}
function deadlineClass(task) {
  if (!task.deadline || task.status === "completed") return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(task.deadline);
  d.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return "overdue";
  if (diff <= 2) return "soon";
  return "";
}
function formatDate(str) {
  if (!str) return "";
  const d = new Date(str + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
function renderCard(task) {
  const q = document
    .getElementById("searchInput")
    .value.trim()
    .toLowerCase();
  const hidden =
    q &&
    !(
      task.name.toLowerCase().includes(q) ||
      (task.desc || "").toLowerCase().includes(q)
    )
      ? "search-hidden"
      : "";
  const dClass = deadlineClass(task);
  const subDone = (task.subtasks || []).filter((s) => s.done).length;
  const subTotal = (task.subtasks || []).length;
  const subPct = subTotal ? Math.round((subDone / subTotal) * 100) : 0;
  const filterLabel = getFilterLabel(task.filter);
  return `
<div class="task-card ${hidden}" id="card-${task.id}" draggable="true"
  ondragstart="onDragStart(event,'${task.id}')"
  ondragend="onDragEnd(event)"
  onclick="openDetail('${task.id}')">
  <div class="card-top">
    <div class="card-title${task.status === "completed" ? " strikethrough" : ""}">${escHtml(task.name)}</div>
    <button class="card-menu-btn" onclick="event.stopPropagation();toggleCtxMenu('${task.id}')" title="Options">⋯</button>
  </div>
  ${task.desc ? `<div class="card-desc">${escHtml(task.desc)}</div>` : ""}
  <div class="card-tags">
    ${task.priority && task.priority !== "none" ? `<span class="priority-badge priority-${task.priority}">${task.priority === "high" ? "🔥 High" : task.priority === "med" ? "⚡ Medium" : "✅ Low"}</span>` : ""}
    ${filterLabel ? `<span class="card-tag filter-tag">${filterLabel}</span>` : ""}
  </div>
  <div class="card-footer">
    ${task.deadline ? `<span class="card-deadline ${dClass}">📅 ${formatDate(task.deadline)}${dClass === "overdue" ? " • Overdue" : dClass === "soon" ? " • Soon" : ""}</span>` : "<span></span>"}
    ${subTotal ? `<div class="card-subtasks"><span>${subDone}/${subTotal}</span><div class="subtask-progress"><div class="subtask-bar" style="width:${subPct}%"></div></div></div>` : ""}
  </div>
  <div class="card-ctx-menu" id="ctx-${task.id}" style="display:none" onclick="event.stopPropagation()">
    <button class="ctx-item" onclick="openEdit('${task.id}');closeAllCtx()">Edit</button>
    <div class="ctx-divider"></div>
    <button class="ctx-item danger" onclick="askDelete('${task.id}');closeAllCtx()">Delete</button>
  </div>
</div>`;
}
function renderAll() {
  ["start", "progress", "completed"].forEach((status) => {
    const body = document.getElementById("body-" + status);
    const filtered = getSortedTasks(
      tasks.filter((t) => t.status === status && passesFilterView(t)),
    );
    if (filtered.length === 0) {
      body.innerHTML = `<div class="empty-col"><div class="empty-col-icon">${status === "start" ? "📭" : status === "progress" ? "⏳" : "🎉"}</div>No tasks here yet.<br>Click ＋ to add one.</div>`;
    } else {
      body.innerHTML = filtered.map(renderCard).join("");
    }
    document.getElementById("count-" + status).textContent = tasks.filter(
      (t) => t.status === status,
    ).length;
  });
  updateCounts();
  renderCustomFilterBtns();
}
function updateCounts() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  document.getElementById("cnt-all").textContent = tasks.length;
  document.getElementById("cnt-today").textContent = tasks.filter((t) => {
    if (!t.deadline) return false;
    const d = new Date(t.deadline);
    d.setHours(0, 0, 0, 0);
    return d.getTime() === today.getTime();
  }).length;
  document.getElementById("cnt-overdue").textContent = tasks.filter(
    (t) => {
      if (!t.deadline || t.status === "completed") return false;
      const d = new Date(t.deadline);
      d.setHours(0, 0, 0, 0);
      return d < today;
    },
  ).length;
  document.getElementById("cnt-high").textContent = tasks.filter(
    (t) => t.priority === "high",
  ).length;
  document.getElementById("cnt-cat_assignment").textContent =
    tasks.filter((t) => t.filter === "cat_assignment").length;
  document.getElementById("cnt-cat_personal").textContent = tasks.filter(
    (t) => t.filter === "cat_personal",
  ).length;
  document.getElementById("cnt-cat_reminder").textContent = tasks.filter(
    (t) => t.filter === "cat_reminder",
  ).length;
  customFilters.forEach((f) => {
    const el = document.getElementById("cnt-" + f.id);
    if (el)
      el.textContent = tasks.filter((t) => t.filter === f.id).length;
  });
}
let modalSubtasks = [];
function openAddTask(status) {
  editingTaskId = null;
  modalSubtasks = [];
  document.getElementById("taskModalTitle").textContent = "New Task";
  document.getElementById("taskName").value = "";
  document.getElementById("taskDesc").value = "";
  document.getElementById("taskStatus").value = status || "start";
  document.getElementById("taskPriority").value = "low";
  document.getElementById("taskDeadline").value = "";
  populateFilterSelect();
  document.getElementById("taskFilter").value = "";
  renderSubtasksList();
  openModal("taskModal");
  setTimeout(() => document.getElementById("taskName").focus(), 100);
}
function openEdit(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  editingTaskId = id;
  modalSubtasks = (t.subtasks || []).map((s) => ({ ...s }));
  document.getElementById("taskModalTitle").textContent = "Edit Task";
  document.getElementById("taskName").value = t.name;
  document.getElementById("taskDesc").value = t.desc || "";
  document.getElementById("taskStatus").value = t.status;
  document.getElementById("taskPriority").value = t.priority || "none";
  document.getElementById("taskDeadline").value = t.deadline || "";
  populateFilterSelect();
  document.getElementById("taskFilter").value = t.filter || "";
  renderSubtasksList();
  openModal("taskModal");
  closeModal("detailModal");
  setTimeout(() => document.getElementById("taskName").focus(), 100);
}
function saveTask() {
  const name = document.getElementById("taskName").value.trim();
  if (!name) {
    showToast("Task name is required.");
    return;
  }
  if (editingTaskId) {
    const t = tasks.find((x) => x.id === editingTaskId);
    if (t) {
      t.name = name;
      t.desc = document.getElementById("taskDesc").value.trim();
      t.status = document.getElementById("taskStatus").value;
      t.priority = document.getElementById("taskPriority").value;
      t.deadline = document.getElementById("taskDeadline").value;
      t.filter = document.getElementById("taskFilter").value;
      t.subtasks = [...modalSubtasks];
      t.updatedAt = Date.now();
    }
    showToast("✅ Task updated!");
  } else {
    tasks.push({
      id: genId(),
      name,
      desc: document.getElementById("taskDesc").value.trim(),
      status: document.getElementById("taskStatus").value,
      priority: document.getElementById("taskPriority").value,
      deadline: document.getElementById("taskDeadline").value,
      filter: document.getElementById("taskFilter").value,
      subtasks: [...modalSubtasks],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    showToast("✨ Task created!");
  }
  save();
  renderAll();
  closeModal("taskModal");
}
function renderSubtasksList() {
  const list = document.getElementById("subtasksList");
  list.innerHTML = modalSubtasks
    .map(
      (s, i) => `
<siv class="subtask-item">
<input type="checkbox" class="subtask-check" ${s.done ? "checked" : ""} onchange="toggleModalSubtask(${i},this.checked)"/>
<input class="subtask-text form-input ${s.done ? "done-text" : ""}" value="${escHtml(s.text)}" oninput="editModalSubtask(${i},this.value)" placeholder="Sub-topic…"/>
<button class="subtask-del" onclick="removeModalSubtask(${i})" title="Remove">✕</button>
</div>`,
  )
    .join("");
}
function addSubtask() {
  const inp = document.getElementById("newSubtaskInput");
  const val = inp.value.trim();
  if (!val) return;
  modalSubtasks.push({ text: val, done: false });
  inp.value = "";
  renderSubtasksList();
  inp.focus();
}
function toggleModalSubtask(i, v) {
  modalSubtasks[i].done = v;
  renderSubtasksList();
}
function editModalSubtask(i, v) {
  modalSubtasks[i].text = v;
}
function removeModalSubtask(i) {
  modalSubtasks.splice(i, 1);
  renderSubtasksList();
}
function openDetail(id) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  viewingTaskId = id;
  closeAllCtx();
  document.getElementById("detailTitle").textContent = t.name;
  const dClass = deadlineClass(t);
  const filterLabel = getFilterLabel(t.filter);
  const subDone = (t.subtasks || []).filter((s) => s.done).length;
  const subTotal = (t.subtasks || []).length;
  document.getElementById("detailBody").innerHTML = `
<div class="detail-meta">
  <span class="detail-meta-item">📌 ${t.status === "start" ? "To Start" : t.status === "progress" ? "In Progress" : "Completed"}</span>
  ${t.priority && t.priority !== "none" ? `<span class="detail-meta-item priority-badge priority-${t.priority}">${t.priority === "high" ? "🔥 High" : t.priority === "med" ? "⚡ Medium" : "✅ Low"}</span>` : ""}
  ${t.deadline ? `<span class="detail-meta-item card-deadline ${dClass}">📅 ${formatDate(t.deadline)}${dClass === "overdue" ? " (Overdue)" : dClass === "soon" ? " (Soon)" : ""}</span>` : ""}
  ${filterLabel ? `<span class="detail-meta-item">🏷 ${filterLabel}</span>` : ""}
</div>
${t.desc ? `<div class="form-group"><div class="detail-section-title">Description</div><p style="font-size:0.88rem;color:var(--text2);line-height:1.7">${escHtml(t.desc).replace(/\n/g, "<br>")}</p></div>` : ""}
${
  subTotal
    ? `
<div class="form-group">
  <div class="detail-section-title">Sub-Topics (${subDone}/${subTotal})</div>
  <div class="subtasks-list">
    ${(t.subtasks || [])
      .map(
        (s, i) => `
      <div class="subtask-item">
        <input type="checkbox" class="subtask-check" ${s.done ? "checked" : ""} onchange="toggleDetailSubtask('${id}',${i},this.checked)"/>
        <span class="subtask-text ${s.done ? "done-text" : ""}">${escHtml(s.text)}</span>
      </div>`,
      )
      .join("")}
  </div>
</div>`
    : ""
}
<div class="form-group">
  <div class="detail-section-title">Move to</div>
  <div class="move-btns">
    <button class="move-btn${t.status === "start" ? " active-col" : ""}" onclick="moveTask('${id}','start');openDetail('${id}')">⬜ To Start</button>
    <button class="move-btn${t.status === "progress" ? " active-col" : ""}" onclick="moveTask('${id}','progress');openDetail('${id}')">🔄 In Progress</button>
    <button class="move-btn${t.status === "completed" ? " active-col" : ""}" onclick="moveTask('${id}','completed');openDetail('${id}')">✅ Completed</button>
  </div>
</div>
<div style="font-size:0.72rem;color:var(--text3);margin-top:8px">
  Created: ${new Date(t.createdAt).toLocaleString()}
  ${t.updatedAt && t.updatedAt !== t.createdAt ? " · Updated: " + new Date(t.updatedAt).toLocaleString() : ""}
</div>
`;
  document.getElementById("detailDeleteBtn").onclick = () =>
    askDelete(id);
  document.getElementById("detailEditBtn").onclick = () => openEdit(id);
  openModal("detailModal");
}
function toggleDetailSubtask(taskId, i, val) {
  const t = tasks.find((x) => x.id === taskId);
  if (!t) return;
  t.subtasks[i].done = val;
  t.updatedAt = Date.now();
  save();
  renderAll();
  openDetail(taskId);
}
function moveTask(id, status) {
  const t = tasks.find((x) => x.id === id);
  if (!t) return;
  t.status = status;
  t.updatedAt = Date.now();
  save();
  renderAll();
  showToast(
    "Moved to " +
      (status === "start"
        ? "To Start"
        : status === "progress"
          ? "In Progress"
          : "Completed"),
  );
}
function askDelete(id) {
  pendingDeleteId = id;
  closeModal("detailModal");
  document.getElementById("confirmDeleteBtn").onclick = () => {
    deleteTask(pendingDeleteId);
    closeModal("confirmModal");
  };
  openModal("confirmModal");
}
function deleteTask(id) {
  tasks = tasks.filter((x) => x.id !== id);
  save();
  renderAll();
  showToast("🗑 Task deleted.");
}
function onDragStart(e, id) {
  dragSrcId = id;
  e.dataTransfer.effectAllowed = "move";
  setTimeout(() => {
    const c = document.getElementById("card-" + id);
    if (c) c.classList.add("dragging");
  }, 10);
}
function onDragEnd(e) {
  document
    .querySelectorAll(".task-card")
    .forEach((c) => c.classList.remove("dragging"));
  document
    .querySelectorAll(".col-body")
    .forEach((b) => b.classList.remove("drag-over"));
}
function onDragOver(e, status) {
  e.preventDefault();
  e.dataTransfer.dropEffect = "move";
  document.getElementById("body-" + status).classList.add("drag-over");
}
function onDragLeave(e) {
  document
    .querySelectorAll(".col-body")
    .forEach((b) => b.classList.remove("drag-over"));
}
function onDrop(e, status) {
  e.preventDefault();
  document
    .querySelectorAll(".col-body")
    .forEach((b) => b.classList.remove("drag-over"));
  if (dragSrcId) moveTask(dragSrcId, status);
  dragSrcId = null;
}
document
  .getElementById("searchInput")
  .addEventListener("input", function () {
    const q = this.value.trim();
    document
      .getElementById("searchClear")
      .classList.toggle("visible", q.length > 0);
    renderAll();
  });
document.getElementById("searchClear").addEventListener("click", () => {
  document.getElementById("searchInput").value = "";
  document.getElementById("searchClear").classList.remove("visible");
  renderAll();
});
function populateFilterSelect() {
  const sel = document.getElementById("taskFilter");
  [...sel.options].forEach((o) => {
    if (o.dataset.custom) o.remove();
  });
  customFilters.forEach((f) => {
    const o = document.createElement("option");
    o.value = f.id;
    o.textContent = f.name;
    o.dataset.custom = "1";
    sel.appendChild(o);
  });
}
function getFilterLabel(key) {
  if (!key) return "";
  const presets = {
    cat_assignment: "Assignment",
    cat_personal: "Personal Goals",
    cat_reminder: "Reminder",
  };
  if (presets[key]) return presets[key];
  const c = customFilters.find((f) => f.id === key);
  return c ? c.name : "";
}
function renderCustomFilterBtns() {
  const container = document.getElementById("customFiltersBtns");
  container.innerHTML = customFilters
    .map(
      (f) => `
<button class="sidebar-btn${activeFilterView === f.id ? " active" : ""}" onclick="setFilterView('${f.id}',this)">
<span class="sb-icon">🏷</span> ${escHtml(f.name)}
<span class="sb-count" id="cnt-${f.id}">0</span>
</button>`,
    )
    .join("");
}
function openManageFilters() {
  renderManageFilters();
  openModal("filtersModal");
}
function renderManageFilters() {
  const list = document.getElementById("manageFiltersList");
  if (customFilters.length === 0) {
    list.innerHTML =
      '<p style="color:var(--text3);font-size:0.82rem">No custom filters yet.</p>';
    return;
  }
  list.innerHTML = customFilters
    .map(
      (f) => `
<div class="manage-filter-item">
<span class="mfi-name">${escHtml(f.name)}</span>
<button class="mfi-del" onclick="deleteCustomFilter('${f.id}')" title="Delete filter">✕</button>
</div>`,
    )
    .join("");
}
function addCustomFilter() {
  const inp = document.getElementById("newFilterInput");
  const name = inp.value.trim();
  if (!name) return;
  const id = "cf_" + Date.now();
  customFilters.push({ id, name });
  saveFilters();
  inp.value = "";
  renderManageFilters();
  renderAll();
  showToast('Filter "' + name + '" added!');
}
function deleteCustomFilter(id) {
  tasks.forEach((t) => {
    if (t.filter === id) t.filter = "";
  });
  customFilters = customFilters.filter((f) => f.id !== id);
  saveFilters();
  save();
  if (activeFilterView === id) {
    activeFilterView = "all";
    document.querySelectorAll(".sidebar-btn").forEach((b) => {
      if (b.dataset.filter === "all") b.classList.add("active");
      else b.classList.remove("active");
    });
  }
  renderManageFilters();
  renderAll();
}
function openModal(id) {
  document.getElementById(id).style.display = "flex";
}
function closeModal(id) {
  document.getElementById(id).style.display = "none";
}
function closeModalOnOverlay(e, id) {
  if (e.target === document.getElementById(id)) closeModal(id);
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    ["taskModal", "detailModal", "filtersModal", "confirmModal"].forEach(
      closeModal,
    );
    closeAllCtx();
  }
});
function toggleCtxMenu(id) {
  const el = document.getElementById("ctx-" + id);
  const wasOpen = el.style.display === "block";
  closeAllCtx();
  if (!wasOpen) el.style.display = "block";
}
function closeAllCtx() {
  document
    .querySelectorAll(".card-ctx-menu")
    .forEach((m) => (m.style.display = "none"));
}
document.addEventListener("click", () => closeAllCtx());
let toastTimer = null;
function showToast(msg) {
  let t = document.querySelector(".toast");
  if (t) t.remove();
  t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t && t.remove(), 3000);
}
function escHtml(s) {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
function init() {
  load();
  initTheme();
  initSort();
  renderAll();
}
init();
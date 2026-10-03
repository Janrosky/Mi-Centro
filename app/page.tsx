"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, ArrowDownToLine, BriefcaseBusiness, CalendarDays, Check, CircleDollarSign, Download, FileUp, FolderKanban, HardDrive, NotebookPen, Pencil, Plus, ReceiptText, RotateCcw, Share2, Target, Trash2, Upload, Users } from "lucide-react";
import * as XLSX from "xlsx";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Quadrant = "do" | "plan" | "delegate" | "delete";
type Task = { id: string; title: string; quadrant: Quadrant; projectId: string; start: string; due: string; done: boolean };
type Project = { id: string; name: string; color: string };
type Budget = { id: string; category: string; amount: number; color: string };
type Expense = { id: string; description: string; categoryId: string; amount: number; date: string };
type Meeting = { id: string; title: string; date: string; projectId: string; attendees: string; notes: string; agreements: string; nextSteps: string; createdAt: string; updatedAt: string };
type PlannerState = { version: 1; month: string; tasks: Task[]; projects: Project[]; budgets: Budget[]; expenses: Expense[]; meetings: Meeting[]; updatedAt: string };

const today = new Date().toISOString().slice(0, 10);
const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
const currentMonth = today.slice(0, 7);
const storageKey = "mi-centro-state-v1";
const money = new Intl.NumberFormat("es-CR", { style: "currency", currency: "CRC", maximumFractionDigits: 0 });
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;

const seed: PlannerState = {
  version: 1,
  month: currentMonth,
  updatedAt: new Date().toISOString(),
  projects: [
    { id: "p1", name: "Proyecto Nextek", color: "#2563eb" },
    { id: "p2", name: "Organización personal", color: "#7c3aed" },
  ],
  tasks: [
    { id: "t1", title: "Definir las 3 prioridades de hoy", quadrant: "do", projectId: "p2", start: today, due: today, done: false },
    { id: "t2", title: "Planear el siguiente avance de Nextek", quadrant: "plan", projectId: "p1", start: today, due: today, done: false },
    { id: "t3", title: "Revisar gastos del día", quadrant: "plan", projectId: "p2", start: today, due: today, done: false },
  ],
  budgets: [
    { id: "b1", category: "Alimentación", amount: 120000, color: "#f97316" },
    { id: "b2", category: "Transporte", amount: 60000, color: "#0ea5e9" },
    { id: "b3", category: "Servicios", amount: 90000, color: "#8b5cf6" },
    { id: "b4", category: "Ahorro", amount: 100000, color: "#16a34a" },
    { id: "b5", category: "Otros", amount: 50000, color: "#64748b" },
  ],
  expenses: [],
  meetings: [],
};

const quadrantInfo: Record<Quadrant, { title: string; hint: string; accent: string; soft: string }> = {
  do: { title: "Hacer ahora", hint: "Urgente e importante", accent: "#dc2626", soft: "#fef2f2" },
  plan: { title: "Planificar", hint: "Importante, no urgente", accent: "#2563eb", soft: "#eff6ff" },
  delegate: { title: "Delegar", hint: "Urgente, no importante", accent: "#d97706", soft: "#fffbeb" },
  delete: { title: "Eliminar", hint: "No urgente ni importante", accent: "#64748b", soft: "#f8fafc" },
};

const quadrantOptions: { value: Quadrant; label: string }[] = [
  { value: "do", label: "Urgente e importante" },
  { value: "delegate", label: "Urgente no importante" },
  { value: "plan", label: "Importante no urgente" },
  { value: "delete", label: "No urgente ni importante" },
];

function normalizeState(state: PlannerState): PlannerState {
  return {
    ...state,
    tasks: state.tasks.map((task) => ({ ...task, start: task.start || task.due || today, due: task.due || task.start || today })),
    meetings: Array.isArray(state.meetings) ? state.meetings : [],
  };
}

function safeFileName(value: string) {
  return value.toLocaleLowerCase("es-CR").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "reunion";
}

function meetingAsMarkdown(meeting: Meeting, projects: Project[]) {
  const project = projects.find((item) => item.id === meeting.projectId)?.name || "Sin proyecto";
  const formattedDate = new Date(meeting.date).toLocaleString("es-CR", { dateStyle: "long", timeStyle: "short" });
  return `# ${meeting.title}\n\n**Fecha:** ${formattedDate}\n**Proyecto:** ${project}\n**Participantes:** ${meeting.attendees || "Sin participantes registrados"}\n\n## Notas\n\n${meeting.notes || "Sin notas"}\n\n## Acuerdos\n\n${meeting.agreements || "Sin acuerdos registrados"}\n\n## Próximos pasos\n\n${meeting.nextSteps || "Sin próximos pasos registrados"}\n`;
}

function projectProgress(projectId: string, tasks: Task[]) {
  const projectTasks = tasks.filter((task) => task.projectId === projectId);
  return projectTasks.length ? Math.round(projectTasks.filter((task) => task.done).length / projectTasks.length * 100) : 0;
}

function makeSheet(rows: Record<string, string | number>[]) {
  const sheet = XLSX.utils.json_to_sheet(rows);
  if (rows.length) {
    const headers = Object.keys(rows[0]);
    sheet["!cols"] = headers.map((header) => ({
      wch: Math.min(48, Math.max(header.length + 2, ...rows.map((row) => String(row[header] ?? "").length + 2))),
    }));
    sheet["!autofilter"] = { ref: sheet["!ref"] || `A1:${XLSX.utils.encode_col(headers.length - 1)}1` };
  }
  return sheet;
}

function saveWorkbook(fileName: string, sheets: { name: string; rows: Record<string, string | number>[] }[]) {
  const workbook = XLSX.utils.book_new();
  sheets.forEach(({ name, rows }) => XLSX.utils.book_append_sheet(workbook, makeSheet(rows), name));
  XLSX.writeFile(workbook, fileName, { compression: true });
}

function SelectField({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; placeholder: string }) {
  return <Select value={value} onValueChange={(v) => onChange(v || "")}><SelectTrigger className="w-full"><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;
}

export default function Home() {
  const [data, setData] = useState<PlannerState>(seed);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [meetingOpen, setMeetingOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [pendingImport, setPendingImport] = useState<PlannerState | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const meetingFileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadLocal = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) setData(normalizeState(JSON.parse(saved)));
      } catch { toast.error("No se pudieron leer los datos guardados en este dispositivo."); }
      finally { setLoaded(true); }
    };
    loadLocal();
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      setSaving(true);
      try {
        localStorage.setItem(storageKey, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }));
      } catch { toast.error("No se guardó el último cambio en este dispositivo."); }
      finally { setSaving(false); }
    }, 250);
    return () => clearTimeout(timer);
  }, [data, loaded]);

  const spent = useMemo(() => data.expenses.filter((e) => e.date.startsWith(data.month)).reduce((sum, e) => sum + e.amount, 0), [data]);
  const budgetTotal = data.budgets.reduce((sum, b) => sum + b.amount, 0);
  const completed = data.tasks.filter((t) => t.done).length;
  const monthLabel = new Date(`${data.month}-01T12:00:00`).toLocaleDateString("es-CR", { month: "long", year: "numeric" });
  const sortedMeetings = useMemo(() => [...data.meetings].sort((a, b) => b.date.localeCompare(a.date)), [data.meetings]);

  const update = (change: (state: PlannerState) => PlannerState) => setData((prev) => ({ ...change(prev), updatedAt: new Date().toISOString() }));
  const toggleTask = (id: string) => update((s) => ({ ...s, tasks: s.tasks.map((t) => t.id === id ? { ...t, done: !t.done } : t) }));
  const deleteTask = (id: string) => update((s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }));
  const deleteExpense = (id: string) => update((s) => ({ ...s, expenses: s.expenses.filter((e) => e.id !== id) }));
  const deleteMeeting = (id: string) => update((s) => ({ ...s, meetings: s.meetings.filter((meeting) => meeting.id !== id) }));

  useEffect(() => {
    const context = (document as Document & { modelContext?: { registerTool: (tool: unknown, options?: unknown) => void | Promise<void> } }).modelContext;
    if (!context?.registerTool) return;
    const life = new AbortController();
    const register = (tool: unknown) => Promise.resolve(context.registerTool(tool, { signal: life.signal })).catch(() => undefined);
    register({ name: "create_task", title: "Crear tarea", description: "Crea una tarea visible en la matriz Eisenhower.", inputSchema: { type: "object", properties: { title: { type: "string" }, quadrant: { type: "string", enum: ["do", "plan", "delegate", "delete"] } }, required: ["title", "quadrant"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input: { title: string; quadrant: Quadrant }) => { const task = { id: uid(), title: input.title, quadrant: input.quadrant, projectId: "", start: today, due: today, done: false }; update((s) => ({ ...s, tasks: [...s.tasks, task] })); return { id: task.id, created: true }; } });
    register({ name: "create_expense", title: "Registrar gasto", description: "Registra un gasto en el presupuesto mensual.", inputSchema: { type: "object", properties: { description: { type: "string" }, amount: { type: "number", minimum: 0 }, categoryId: { type: "string" } }, required: ["description", "amount", "categoryId"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input: { description: string; amount: number; categoryId: string }) => { const expense = { id: uid(), description: input.description, amount: input.amount, categoryId: input.categoryId, date: today }; update((s) => ({ ...s, expenses: [expense, ...s.expenses] })); return { id: expense.id, created: true }; } });
    register({ name: "create_meeting", title: "Crear reunión", description: "Crea una reunión para tomar notas, registrar acuerdos y próximos pasos.", inputSchema: { type: "object", properties: { title: { type: "string" }, projectId: { type: "string" }, attendees: { type: "string" }, notes: { type: "string" } }, required: ["title"], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: (input: { title: string; projectId?: string; attendees?: string; notes?: string }) => { const meeting = { id: uid(), title: input.title, date: localNow, projectId: input.projectId || "", attendees: input.attendees || "", notes: input.notes || "", agreements: "", nextSteps: "", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; update((s) => ({ ...s, meetings: [meeting, ...s.meetings] })); return { id: meeting.id, created: true }; } });
    return () => life.abort();
  }, []);

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `mi-centro-backup-${today}.json`; a.click(); URL.revokeObjectURL(url);
    toast.success("Respaldo descargado");
  }

  function exportMatrix() {
    const rows = data.tasks.map((task) => ({
      Tarea: task.title,
      Prioridad: quadrantInfo[task.quadrant].title,
      Clasificación: quadrantInfo[task.quadrant].hint,
      Proyecto: data.projects.find((project) => project.id === task.projectId)?.name || "Sin proyecto",
      Inicio: task.start,
      Fin: task.due,
      Estado: task.done ? "Completada" : "Pendiente",
    }));
    saveWorkbook(`mi-centro-matriz-${today}.xlsx`, [{ name: "Matriz", rows }]);
    toast.success("Matriz descargada en Excel");
  }

  function exportTimeline() {
    const projectRows = data.projects.map((project) => {
      const projectTasks = data.tasks.filter((task) => task.projectId === project.id);
      const done = projectTasks.filter((task) => task.done).length;
      return {
        Proyecto: project.name,
        "Total de tareas": projectTasks.length,
        Completadas: done,
        Pendientes: projectTasks.length - done,
        "Avance (%)": projectProgress(project.id, data.tasks),
      };
    });
    const taskRows = data.tasks.filter((task) => task.projectId).map((task) => {
      const start = new Date(`${task.start}T12:00:00`);
      const due = new Date(`${task.due}T12:00:00`);
      return {
        Proyecto: data.projects.find((project) => project.id === task.projectId)?.name || "Proyecto eliminado",
        Tarea: task.title,
        Inicio: task.start,
        Fin: task.due,
        "Duración (días)": Math.max(1, Math.round((due.getTime() - start.getTime()) / 86400000) + 1),
        Estado: task.done ? "Completada" : "Pendiente",
      };
    });
    saveWorkbook(`mi-centro-cronograma-${today}.xlsx`, [
      { name: "Proyectos", rows: projectRows },
      { name: "Cronograma", rows: taskRows },
    ]);
    toast.success("Cronograma descargado en Excel");
  }

  function exportFinances() {
    const monthExpenses = data.expenses.filter((expense) => expense.date.startsWith(data.month));
    const summaryRows = [
      { Concepto: "Mes", Valor: monthLabel },
      { Concepto: "Presupuesto total", Valor: budgetTotal },
      { Concepto: "Total gastado", Valor: spent },
      { Concepto: "Disponible", Valor: budgetTotal - spent },
      { Concepto: "Uso del presupuesto (%)", Valor: budgetTotal ? Math.round(spent / budgetTotal * 100) : 0 },
    ];
    const budgetRows = data.budgets.map((budget) => {
      const used = monthExpenses.filter((expense) => expense.categoryId === budget.id).reduce((sum, expense) => sum + expense.amount, 0);
      return {
        Categoría: budget.category,
        Presupuesto: budget.amount,
        Gastado: used,
        Disponible: budget.amount - used,
        "Uso (%)": budget.amount ? Math.round(used / budget.amount * 100) : 0,
      };
    });
    const expenseRows = monthExpenses.map((expense) => ({
      Fecha: expense.date,
      Descripción: expense.description,
      Categoría: data.budgets.find((budget) => budget.id === expense.categoryId)?.category || "Sin categoría",
      Monto: expense.amount,
    }));
    saveWorkbook(`mi-centro-finanzas-${data.month}.xlsx`, [
      { name: "Resumen", rows: summaryRows },
      { name: "Presupuesto", rows: budgetRows },
      { name: "Gastos", rows: expenseRows },
    ]);
    toast.success("Finanzas descargadas en Excel");
  }

  function downloadMeeting(meeting: Meeting) {
    const blob = new Blob([meetingAsMarkdown(meeting, data.projects)], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFileName(meeting.title)}.md`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Nota descargada");
  }

  async function shareMeeting(meeting: Meeting) {
    const text = meetingAsMarkdown(meeting, data.projects);
    const file = new File([text], `${safeFileName(meeting.title)}.md`, { type: "text/markdown" });
    try {
      if (!navigator.share) {
        downloadMeeting(meeting);
        toast.info("Tu navegador no ofrece el menú Compartir; descargamos la nota en su lugar.");
        return;
      }
      const files = navigator.canShare?.({ files: [file] }) ? [file] : undefined;
      await navigator.share({ title: meeting.title, text: files ? undefined : text, files });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast.error("No se pudo abrir el menú para compartir.");
    }
  }

  async function importMeeting(file?: File) {
    if (!file) return;
    try {
      const content = await file.text();
      const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
      const title = heading || file.name.replace(/\.(md|markdown|txt)$/i, "") || "Nota importada";
      const now = new Date().toISOString();
      const meeting: Meeting = { id: uid(), title, date: localNow, projectId: "", attendees: "", notes: content.replace(/^#\s+.+\r?\n*/m, "").trim(), agreements: "", nextSteps: "", createdAt: now, updatedAt: now };
      update((state) => ({ ...state, meetings: [meeting, ...state.meetings] }));
      setEditingMeeting(meeting);
      setMeetingOpen(true);
      toast.success("Nota importada; puedes completar los datos de la reunión.");
    } catch {
      toast.error("No se pudo leer esa nota.");
    }
    if (meetingFileInput.current) meetingFileInput.current.value = "";
  }

  async function readBackup(file?: File) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as PlannerState;
      if (parsed.version !== 1 || !Array.isArray(parsed.tasks) || !Array.isArray(parsed.projects) || !Array.isArray(parsed.budgets) || !Array.isArray(parsed.expenses)) throw new Error();
      setPendingImport(normalizeState(parsed));
    } catch { toast.error("Ese archivo no es un respaldo válido de Mi Centro."); }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <main className="min-h-screen">
      <Toaster richColors position="top-center" />
      <header className="app-header">
        <div className="brand"><span className="brand-mark"><Target /></span><div><strong>Mi Centro</strong><small>Organiza lo que sí importa</small></div></div>
        <div className="header-actions"><span className="save-status"><HardDrive /> {saving ? "Guardando…" : loaded ? "Guardado en este dispositivo" : "Cargando…"}</span><Button variant="outline" onClick={() => setBackupOpen(true)}><Archive /> Respaldo</Button></div>
      </header>

      <section className="workspace">
        <div className="welcome-row"><div><p className="eyebrow">{new Date().toLocaleDateString("es-CR", { weekday: "long", day: "numeric", month: "long" })}</p><h1>Buenos días</h1></div><div className="mini-stats"><span><b>{data.tasks.filter(t => !t.done).length}</b> pendientes</span><span><b>{data.projects.length}</b> proyectos</span></div></div>

        <Tabs defaultValue="productividad" className="main-tabs">
          <TabsList className="nav-tabs">
            <TabsTrigger value="productividad"><FolderKanban /> Productividad</TabsTrigger>
            <TabsTrigger value="finanzas"><CircleDollarSign /> Finanzas</TabsTrigger>
            <TabsTrigger value="reuniones"><NotebookPen /> Reuniones</TabsTrigger>
          </TabsList>

          <TabsContent value="productividad" className="space-y-5">
            <div className="summary-grid">
              <article className="summary-card blue"><div><span>Avance de tareas</span><strong>{completed}/{data.tasks.length}</strong></div><Progress value={data.tasks.length ? completed / data.tasks.length * 100 : 0} /></article>
              <article className="summary-card violet"><div><span>Proyectos activos</span><strong>{data.projects.length}</strong></div><p>Conecta cada tarea con su resultado</p></article>
              <article className="summary-card coral"><div><span>Para hacer ahora</span><strong>{data.tasks.filter(t => t.quadrant === "do" && !t.done).length}</strong></div><p>Tu foco inmediato</p></article>
            </div>
            <div className="section-heading"><div><p className="eyebrow">Matriz Eisenhower</p><h2>Tareas y prioridades</h2></div><div className="section-actions"><Button variant="outline" onClick={exportMatrix}><ArrowDownToLine /> Descargar Excel</Button><Dialog open={taskOpen} onOpenChange={setTaskOpen}><DialogTrigger asChild><Button><Plus /> Nueva tarea</Button></DialogTrigger><TaskDialog projects={data.projects} onSave={(task) => { update((s) => ({ ...s, tasks: [...s.tasks, task] })); setTaskOpen(false); }} /></Dialog></div></div>
            <div className="eisenhower-grid">{(Object.keys(quadrantInfo) as Quadrant[]).map((quadrant) => <QuadrantCard key={quadrant} quadrant={quadrant} tasks={data.tasks.filter(t => t.quadrant === quadrant)} projects={data.projects} onToggle={toggleTask} onDelete={deleteTask} />)}</div>
            <div className="section-heading project-heading"><div><p className="eyebrow">Resultados</p><h2>Proyectos</h2></div><Dialog open={projectOpen} onOpenChange={setProjectOpen}><DialogTrigger asChild><Button variant="outline"><Plus /> Nuevo proyecto</Button></DialogTrigger><ProjectDialog onSave={(project) => { update((s) => ({ ...s, projects: [...s.projects, project] })); setProjectOpen(false); }} /></Dialog></div>
            <Tabs defaultValue="tarjetas" className="project-views">
              <TabsList className="project-view-tabs"><TabsTrigger value="tarjetas">Tarjetas</TabsTrigger><TabsTrigger value="cronograma">Cronograma</TabsTrigger></TabsList>
              <TabsContent value="tarjetas"><div className="project-grid">{data.projects.map((p) => { const total = data.tasks.filter(t => t.projectId === p.id).length; const done = data.tasks.filter(t => t.projectId === p.id && t.done).length; const progress = projectProgress(p.id, data.tasks); return <article className="project-card" key={p.id}><div className="project-top"><span className="project-dot" style={{ background: p.color }} /><BriefcaseBusiness /><Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${p.name}`} onClick={() => update((s) => ({ ...s, projects: s.projects.filter(x => x.id !== p.id), tasks: s.tasks.map(t => t.projectId === p.id ? { ...t, projectId: "" } : t) }))}><Trash2 /></Button></div><h3>{p.name}</h3><div className="progress-label"><span>{done} de {total} tareas listas</span><b>{progress}%</b></div><Progress value={progress} /></article>; })}</div></TabsContent>
              <TabsContent value="cronograma"><ProjectTimeline projects={data.projects} tasks={data.tasks} onExport={exportTimeline} /></TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="finanzas" className="space-y-5">
            <div className="finance-hero"><div><p className="eyebrow">Presupuesto de {monthLabel}</p><h2>{money.format(Math.max(budgetTotal - spent, 0))}</h2><span>disponibles de {money.format(budgetTotal)}</span></div><div className="finance-actions"><Input aria-label="Mes del presupuesto" type="month" value={data.month} onChange={(e) => update((s) => ({ ...s, month: e.target.value }))} /><Button variant="outline" onClick={exportFinances}><ArrowDownToLine /> Descargar Excel</Button><Button variant="outline" onClick={() => setBudgetOpen(true)}>Editar presupuesto</Button><Dialog open={expenseOpen} onOpenChange={setExpenseOpen}><DialogTrigger asChild><Button><Plus /> Registrar gasto</Button></DialogTrigger><ExpenseDialog budgets={data.budgets} onSave={(expense) => { update((s) => ({ ...s, expenses: [expense, ...s.expenses] })); setExpenseOpen(false); }} /></Dialog></div></div>
            <div className="summary-grid finance-summary"><article className="summary-card green"><div><span>Presupuesto</span><strong>{money.format(budgetTotal)}</strong></div></article><article className="summary-card coral"><div><span>Gastado</span><strong>{money.format(spent)}</strong></div></article><article className="summary-card blue"><div><span>Uso</span><strong>{budgetTotal ? Math.round(spent / budgetTotal * 100) : 0}%</strong></div><Progress value={budgetTotal ? spent / budgetTotal * 100 : 0} /></article></div>
            <div className="finance-layout"><section className="panel"><div className="panel-title"><div><p className="eyebrow">Por categoría</p><h2>Presupuesto mensual</h2></div><ReceiptText /></div><div className="budget-list">{data.budgets.map((b) => { const used = data.expenses.filter(e => e.categoryId === b.id && e.date.startsWith(data.month)).reduce((s,e) => s + e.amount, 0); const pct = b.amount ? Math.min(used / b.amount * 100, 100) : 0; return <div className="budget-row" key={b.id}><div className="budget-name"><span style={{ background: b.color }} /> <strong>{b.category}</strong><small>{money.format(used)} / {money.format(b.amount)}</small></div><Progress value={pct} /><b className={pct > 90 ? "danger" : ""}>{Math.round(pct)}%</b></div>; })}</div></section><section className="panel"><div className="panel-title"><div><p className="eyebrow">Movimientos</p><h2>Gastos recientes</h2></div><CalendarDays /></div>{data.expenses.length === 0 ? <div className="empty-state"><ReceiptText /><strong>Aún no hay gastos</strong><span>Registra el primero para ver el avance real.</span></div> : <div className="expense-list">{data.expenses.filter(e => e.date.startsWith(data.month)).slice(0,8).map((e) => { const category = data.budgets.find(b => b.id === e.categoryId); return <div className="expense-row" key={e.id}><span className="expense-icon" style={{ background: `${category?.color || "#64748b"}18`, color: category?.color }}><ReceiptText /></span><div><strong>{e.description}</strong><small>{category?.category} · {new Date(`${e.date}T12:00:00`).toLocaleDateString("es-CR")}</small></div><b>-{money.format(e.amount)}</b><Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${e.description}`} onClick={() => deleteExpense(e.id)}><Trash2 /></Button></div>; })}</div>}</section></div>
          </TabsContent>

          <TabsContent value="reuniones" className="space-y-5">
            <div className="meeting-hero"><div><span className="meeting-hero-icon"><NotebookPen /></span><div><p className="eyebrow">Memoria de trabajo</p><h2>Reuniones y notas</h2><p>Conserva el contexto, los acuerdos y lo que sigue.</p></div></div><div className="section-actions"><Button variant="outline" onClick={() => meetingFileInput.current?.click()}><FileUp /> Importar nota</Button><Button onClick={() => { setEditingMeeting(null); setMeetingOpen(true); }}><Plus /> Nueva reunión</Button></div></div>
            <input ref={meetingFileInput} className="hidden" type="file" accept="text/plain,text/markdown,.txt,.md,.markdown" onChange={(event) => importMeeting(event.target.files?.[0])} />
            <div className="summary-grid meeting-summary">
              <article className="summary-card violet"><div><span>Reuniones guardadas</span><strong>{data.meetings.length}</strong></div><p>Tu historial permanece en este dispositivo</p></article>
              <article className="summary-card blue"><div><span>Ligadas a proyectos</span><strong>{data.meetings.filter((meeting) => meeting.projectId).length}</strong></div><p>Contexto conectado con tus resultados</p></article>
              <article className="summary-card green"><div><span>Sin proyecto</span><strong>{data.meetings.filter((meeting) => !meeting.projectId).length}</strong></div><p>Para conversaciones generales</p></article>
            </div>
            <aside className="notes-bridge"><Share2 /><div><strong>Lleva tus notas a otras apps</strong><span>Usa “Compartir” para enviarlas a Notas, OneNote u otra app compatible del dispositivo. También puedes descargar o importar archivos Markdown y texto.</span></div></aside>
            {sortedMeetings.length === 0 ? <div className="meeting-empty"><NotebookPen /><h3>Aún no hay reuniones</h3><p>Crea la primera o importa una nota existente para comenzar.</p><Button onClick={() => { setEditingMeeting(null); setMeetingOpen(true); }}><Plus /> Crear reunión</Button></div> : <div className="meeting-grid">{sortedMeetings.map((meeting) => { const project = data.projects.find((item) => item.id === meeting.projectId); return <article className="meeting-card" key={meeting.id}><div className="meeting-card-top"><div><span className="meeting-date"><CalendarDays /> {new Date(meeting.date).toLocaleString("es-CR", { dateStyle: "medium", timeStyle: "short" })}</span>{project ? <span className="meeting-project"><i style={{ background: project.color }} />{project.name}</span> : <span className="meeting-project muted">Sin proyecto</span>}</div><div className="meeting-icon-actions"><Button variant="ghost" size="icon-sm" aria-label={`Editar ${meeting.title}`} onClick={() => { setEditingMeeting(meeting); setMeetingOpen(true); }}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${meeting.title}`} onClick={() => deleteMeeting(meeting.id)}><Trash2 /></Button></div></div><h3>{meeting.title}</h3>{meeting.attendees && <p className="meeting-attendees"><Users /> {meeting.attendees}</p>}<p className="meeting-preview">{meeting.notes || meeting.agreements || meeting.nextSteps || "Sin notas todavía."}</p><div className="meeting-card-actions"><Button variant="outline" size="sm" onClick={() => shareMeeting(meeting)}><Share2 /> Compartir</Button><Button variant="ghost" size="sm" onClick={() => downloadMeeting(meeting)}><Download /> Descargar .md</Button><Button variant="ghost" size="sm" onClick={() => { setEditingMeeting(meeting); setMeetingOpen(true); }}><Pencil /> Abrir</Button></div></article>; })}</div>}
          </TabsContent>
        </Tabs>
      </section>

      <BudgetDialog open={budgetOpen} onOpenChange={setBudgetOpen} budgets={data.budgets} onSave={(budgets) => { update((s) => ({ ...s, budgets })); setBudgetOpen(false); }} />
      <Dialog open={meetingOpen} onOpenChange={(open) => { setMeetingOpen(open); if (!open) setEditingMeeting(null); }}>{meetingOpen && <MeetingDialog meeting={editingMeeting} projects={data.projects} onSave={(meeting) => { update((state) => ({ ...state, meetings: state.meetings.some((item) => item.id === meeting.id) ? state.meetings.map((item) => item.id === meeting.id ? meeting : item) : [meeting, ...state.meetings] })); setMeetingOpen(false); setEditingMeeting(null); toast.success(editingMeeting ? "Reunión actualizada" : "Reunión guardada"); }} />}</Dialog>
      <Dialog open={backupOpen} onOpenChange={setBackupOpen}><DialogContent><DialogHeader><DialogTitle>Respaldo y restauración</DialogTitle><DialogDescription>Tus datos viven únicamente en este dispositivo. Descarga una copia para llevarlos a otro.</DialogDescription></DialogHeader><div className="backup-grid"><button className="backup-option" onClick={exportBackup}><ArrowDownToLine /><strong>Descargar respaldo</strong><span>Archivo JSON con todos tus datos.</span></button><button className="backup-option" onClick={() => fileInput.current?.click()}><Upload /><strong>Cargar respaldo</strong><span>Reemplaza los datos locales tras confirmar.</span></button></div><input ref={fileInput} className="hidden" type="file" accept="application/json,.json" onChange={(e) => readBackup(e.target.files?.[0])} /><DialogFooter><Button variant="outline" onClick={() => setBackupOpen(false)}>Cerrar</Button></DialogFooter></DialogContent></Dialog>
      <AlertDialog open={!!pendingImport} onOpenChange={(open) => !open && setPendingImport(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Restaurar este respaldo?</AlertDialogTitle><AlertDialogDescription>Los datos actuales serán reemplazados. Descarga un respaldo primero si deseas conservarlos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => { if (pendingImport) { setData(pendingImport); toast.success("Respaldo restaurado"); } setPendingImport(null); setBackupOpen(false); }}><RotateCcw /> Restaurar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </main>
  );
}

function QuadrantCard({ quadrant, tasks, projects, onToggle, onDelete }: { quadrant: Quadrant; tasks: Task[]; projects: Project[]; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  const info = quadrantInfo[quadrant];
  return <article className="quadrant" style={{ "--accent": info.accent, "--soft": info.soft } as React.CSSProperties}><div className="quadrant-title"><span /><div><h3>{info.title}</h3><p>{info.hint}</p></div><b>{tasks.filter(t => !t.done).length}</b></div><div className="task-list">{tasks.length === 0 && <p className="quadrant-empty">Todo despejado</p>}{tasks.map((task) => <div className={`task-row ${task.done ? "done" : ""}`} key={task.id}><button className="task-check" aria-label={task.done ? "Marcar pendiente" : "Completar tarea"} onClick={() => onToggle(task.id)}>{task.done && <Check />}</button><div><strong>{task.title}</strong><small>{projects.find(p => p.id === task.projectId)?.name || "Sin proyecto"}{task.due ? ` · ${new Date(`${task.due}T12:00:00`).toLocaleDateString("es-CR", { day: "numeric", month: "short" })}` : ""}</small></div><Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${task.title}`} onClick={() => onDelete(task.id)}><Trash2 /></Button></div>)}</div></article>;
}

function TaskDialog({ projects, onSave }: { projects: Project[]; onSave: (task: Task) => void }) {
  const [title, setTitle] = useState(""); const [quadrant, setQuadrant] = useState<Quadrant>("do"); const [projectId, setProjectId] = useState(""); const [start, setStart] = useState(today); const [due, setDue] = useState(today);
  return <DialogContent><DialogHeader><DialogTitle>Nueva tarea</DialogTitle><DialogDescription>Clasifícala por importancia y urgencia desde el inicio.</DialogDescription></DialogHeader><div className="form-grid"><div><Label htmlFor="task-title">Tarea</Label><Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. preparar propuesta" /></div><div><Label>Cuadrante</Label><SelectField value={quadrant} onChange={(v) => setQuadrant(v as Quadrant)} placeholder="Selecciona" options={quadrantOptions} /></div><div><Label>Proyecto</Label><SelectField value={projectId} onChange={setProjectId} placeholder="Sin proyecto" options={[{ value: "none", label: "Sin proyecto" }, ...projects.map(p => ({ value: p.id, label: p.name }))]} /></div><div><Label htmlFor="task-start">Inicio</Label><Input id="task-start" type="date" value={start} onChange={(e) => { setStart(e.target.value); if (due < e.target.value) setDue(e.target.value); }} /></div><div><Label htmlFor="task-date">Fin</Label><Input id="task-date" type="date" min={start} value={due} onChange={(e) => setDue(e.target.value)} /></div></div><DialogFooter><Button disabled={!title.trim()} onClick={() => { onSave({ id: uid(), title: title.trim(), quadrant, projectId: projectId === "none" ? "" : projectId, start, due: due < start ? start : due, done: false }); setTitle(""); }}>Crear tarea</Button></DialogFooter></DialogContent>;
}

function ProjectDialog({ onSave }: { onSave: (project: Project) => void }) {
  const [name, setName] = useState("");
  return <DialogContent><DialogHeader><DialogTitle>Nuevo proyecto</DialogTitle><DialogDescription>Agrupa tareas bajo un resultado concreto. El avance se calcula automáticamente.</DialogDescription></DialogHeader><div className="form-grid"><div><Label htmlFor="project-name">Nombre</Label><Input id="project-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. nueva web Nextek" /></div></div><DialogFooter><Button disabled={!name.trim()} onClick={() => { onSave({ id: uid(), name: name.trim(), color: ["#2563eb", "#7c3aed", "#16a34a", "#ea580c"][Math.floor(Math.random()*4)] }); setName(""); }}>Crear proyecto</Button></DialogFooter></DialogContent>;
}

function MeetingDialog({ meeting, projects, onSave }: { meeting: Meeting | null; projects: Project[]; onSave: (meeting: Meeting) => void }) {
  const [title, setTitle] = useState(meeting?.title || "");
  const [date, setDate] = useState(meeting?.date || localNow);
  const [projectId, setProjectId] = useState(meeting?.projectId || "none");
  const [attendees, setAttendees] = useState(meeting?.attendees || "");
  const [notes, setNotes] = useState(meeting?.notes || "");
  const [agreements, setAgreements] = useState(meeting?.agreements || "");
  const [nextSteps, setNextSteps] = useState(meeting?.nextSteps || "");

  return <DialogContent className="meeting-dialog"><DialogHeader><DialogTitle>{meeting ? "Editar reunión" : "Nueva reunión"}</DialogTitle><DialogDescription>Registra el contexto, las decisiones y los próximos pasos en un solo lugar.</DialogDescription></DialogHeader><div className="meeting-form"><div className="meeting-form-row"><div><Label htmlFor="meeting-title">Título</Label><Input id="meeting-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Revisión semanal del proyecto" /></div><div><Label htmlFor="meeting-date">Fecha y hora</Label><Input id="meeting-date" type="datetime-local" value={date} onChange={(event) => setDate(event.target.value)} /></div></div><div className="meeting-form-row"><div><Label>Proyecto</Label><SelectField value={projectId} onChange={setProjectId} placeholder="Sin proyecto" options={[{ value: "none", label: "Sin proyecto" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} /></div><div><Label htmlFor="meeting-attendees">Participantes</Label><Input id="meeting-attendees" value={attendees} onChange={(event) => setAttendees(event.target.value)} placeholder="Nombres separados por comas" /></div></div><div><Label htmlFor="meeting-notes">Notas</Label><Textarea id="meeting-notes" rows={7} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ideas, temas conversados, contexto y observaciones…" /></div><div className="meeting-form-row"><div><Label htmlFor="meeting-agreements">Acuerdos</Label><Textarea id="meeting-agreements" rows={4} value={agreements} onChange={(event) => setAgreements(event.target.value)} placeholder="Decisiones tomadas…" /></div><div><Label htmlFor="meeting-next">Próximos pasos</Label><Textarea id="meeting-next" rows={4} value={nextSteps} onChange={(event) => setNextSteps(event.target.value)} placeholder="Responsables, tareas y fechas…" /></div></div></div><DialogFooter><Button disabled={!title.trim() || !date} onClick={() => { const now = new Date().toISOString(); onSave({ id: meeting?.id || uid(), title: title.trim(), date, projectId: projectId === "none" ? "" : projectId, attendees: attendees.trim(), notes: notes.trim(), agreements: agreements.trim(), nextSteps: nextSteps.trim(), createdAt: meeting?.createdAt || now, updatedAt: now }); }}>{meeting ? "Guardar cambios" : "Guardar reunión"}</Button></DialogFooter></DialogContent>;
}

function ProjectTimeline({ projects, tasks, onExport }: { projects: Project[]; tasks: Task[]; onExport: () => void }) {
  const projectTasks = tasks.filter((task) => task.projectId && projects.some((project) => project.id === task.projectId));
  const dateValues = projectTasks.flatMap((task) => [task.start || task.due, task.due || task.start]).filter(Boolean).map((date) => new Date(`${date}T12:00:00`).getTime());
  const firstDate = new Date(Math.min(new Date(`${today}T12:00:00`).getTime(), ...dateValues));
  firstDate.setDate(firstDate.getDate() - 2);
  const days = Array.from({ length: 28 }, (_, index) => { const date = new Date(firstDate); date.setDate(firstDate.getDate() + index); return date; });
  const dayMs = 86400000;
  const position = (date: string) => Math.max(0, Math.min(days.length - 1, Math.round((new Date(`${date}T12:00:00`).getTime() - days[0].getTime()) / dayMs)));

  return <section className="gantt-shell"><div className="gantt-intro"><div><strong>Cronograma de proyectos</strong><span>Desliza horizontalmente para recorrer 28 días.</span></div><div className="gantt-tools"><span className="gantt-legend"><i /> Pendiente <i className="done" /> Lista</span><Button variant="outline" size="sm" onClick={onExport}><ArrowDownToLine /> Descargar Excel</Button></div></div><div className="gantt-scroll"><div className="gantt-board"><div className="gantt-header"><div className="gantt-label header">Proyecto / tarea</div><div className="gantt-days">{days.map((day) => <div key={day.toISOString()} className={day.getDay() === 0 || day.getDay() === 6 ? "weekend" : ""}><small>{day.toLocaleDateString("es-CR", { weekday: "short" }).slice(0, 2)}</small><b>{day.getDate()}</b></div>)}</div></div>{projects.map((project) => { const rows = tasks.filter((task) => task.projectId === project.id); const progress = projectProgress(project.id, tasks); return <div className="gantt-project" key={project.id}><div className="gantt-project-row"><div className="gantt-label"><span className="project-dot" style={{ background: project.color }} /><strong>{project.name}</strong><b>{progress}%</b></div><div className="gantt-track"><span className="gantt-summary" style={{ background: project.color, width: `${Math.max(progress, 3)}%` }} /></div></div>{rows.length === 0 ? <div className="gantt-task-row"><div className="gantt-label muted">Sin tareas asociadas</div><div className="gantt-track" /></div> : rows.map((task) => { const startIndex = position(task.start || task.due); const endIndex = Math.max(startIndex, position(task.due || task.start)); return <div className="gantt-task-row" key={task.id}><div className="gantt-label"><span className={`timeline-check ${task.done ? "done" : ""}`}>{task.done && <Check />}</span><span>{task.title}</span></div><div className="gantt-track"><span className={`gantt-bar ${task.done ? "done" : ""}`} style={{ background: task.done ? undefined : project.color, left: `${startIndex / days.length * 100}%`, width: `${(endIndex - startIndex + 1) / days.length * 100}%` }} title={`${task.start} – ${task.due}`}>{task.done ? "Lista" : ""}</span></div></div>; })}</div>; })}</div></div></section>;
}

function ExpenseDialog({ budgets, onSave }: { budgets: Budget[]; onSave: (expense: Expense) => void }) {
  const [description, setDescription] = useState(""); const [amount, setAmount] = useState(""); const [categoryId, setCategoryId] = useState(budgets[0]?.id || ""); const [date, setDate] = useState(today);
  return <DialogContent><DialogHeader><DialogTitle>Registrar gasto</DialogTitle><DialogDescription>Se descontará de la categoría elegida.</DialogDescription></DialogHeader><div className="form-grid"><div><Label htmlFor="expense-desc">Descripción</Label><Input id="expense-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ej. supermercado" /></div><div><Label htmlFor="expense-amount">Monto en colones</Label><Input id="expense-amount" inputMode="numeric" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="25000" /></div><div><Label>Categoría</Label><SelectField value={categoryId} onChange={setCategoryId} placeholder="Selecciona" options={budgets.map(b => ({ value: b.id, label: b.category }))} /></div><div><Label htmlFor="expense-date">Fecha</Label><Input id="expense-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div></div><DialogFooter><Button disabled={!description.trim() || !(Number(amount) > 0)} onClick={() => { onSave({ id: uid(), description: description.trim(), amount: Number(amount), categoryId, date }); setDescription(""); setAmount(""); }}>Guardar gasto</Button></DialogFooter></DialogContent>;
}

function BudgetDialog({ open, onOpenChange, budgets, onSave }: { open: boolean; onOpenChange: (v: boolean) => void; budgets: Budget[]; onSave: (b: Budget[]) => void }) {
  const [draft, setDraft] = useState(budgets);
  return <Dialog open={open} onOpenChange={(nextOpen) => { if (nextOpen) setDraft(budgets); onOpenChange(nextOpen); }}><DialogContent><DialogHeader><DialogTitle>Editar presupuesto mensual</DialogTitle><DialogDescription>Ajusta cuánto quieres destinar a cada categoría.</DialogDescription></DialogHeader><div className="budget-editor">{draft.map((b, i) => <div key={b.id}><span style={{ background: b.color }} /><Input aria-label={`Categoría ${i+1}`} value={b.category} onChange={(e) => setDraft(draft.map(x => x.id === b.id ? { ...x, category: e.target.value } : x))} /><Input aria-label={`Presupuesto de ${b.category}`} type="number" min="0" value={b.amount} onChange={(e) => setDraft(draft.map(x => x.id === b.id ? { ...x, amount: Number(e.target.value) || 0 } : x))} /><Button variant="ghost" size="icon-sm" aria-label={`Eliminar ${b.category}`} onClick={() => setDraft(draft.filter(x => x.id !== b.id))}><Trash2 /></Button></div>)}</div><Button variant="outline" onClick={() => setDraft([...draft, { id: uid(), category: "Nueva categoría", amount: 0, color: "#0ea5e9" }])}><Plus /> Añadir categoría</Button><DialogFooter><Button onClick={() => onSave(draft)}>Guardar presupuesto</Button></DialogFooter></DialogContent></Dialog>;
}

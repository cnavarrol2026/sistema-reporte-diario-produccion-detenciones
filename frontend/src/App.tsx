import {
  Activity,
  CheckCircle2,
  Clock3,
  ClipboardList,
  Download,
  Trash2,
  Edit3,
  FileDown,
  Plus,
  RefreshCw,
  Save,
  X,
  XCircle
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell as ChartCell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  createIndicador,
  createCaja,
  createDetencion,
  createLinea,
  createTurno,
  createTurnoHorario,
  deactivateIndicador,
  deactivateLinea,
  deactivateTurno,
  deactivateTurnoHorario,
  deleteDetencion,
  deleteCaja,
  downloadDatabaseBackup,
  fetchDashboard,
  fetchCajas,
  fetchDetenciones,
  fetchInitialConfiguration,
  fetchReporteActual,
  fetchReporteInforme,
  fetchReporteResumen,
  fetchReportesFinalizados,
  finalizarReporte,
  downloadReportePdf,
  iniciarReporte,
  updateIndicador,
  updateCaja,
  updateDetencion,
  updateLinea,
  updateReporte,
  updateTurno,
  updateTurnoHorario,
  type DashboardFilters,
  type DashboardResumen,
  type CajaRetenidaRechazada,
  type CajaRetenidaRechazadaInput,
  type CajaTipo,
  type Detencion,
  type DetencionInput,
  type Indicador,
  type IndicadorInput,
  type Linea,
  type LineaInput,
  type Reporte,
  type ReporteFinalizadoFilters,
  type ReporteFinalizadoListItem,
  type ReporteFinalizadoResponse,
  type ReporteInforme,
  type ReporteResumen,
  type ReporteUpdateInput,
  type TipoAtrasoAdelanto,
  type Turno,
  type TurnoHorario,
  type TurnoHorarioInput,
  type TurnoInput
} from "./services/api";

interface ConfigurationState {
  lineas: Linea[];
  indicadores: Indicador[];
  turnos: Turno[];
  horarios: TurnoHorario[];
}

type SectionKey = "reporte" | "informes" | "dashboard" | "configuracion";

const navItems: Array<{ key: SectionKey | "placeholder"; label: string }> = [
  { key: "reporte", label: "Reporte del dia" },
  { key: "informes", label: "Informes" },
  { key: "dashboard", label: "Dashboard" },
  { key: "configuracion", label: "Configuracion" }
];

const dayNames = new Map([
  [1, "Lunes"],
  [2, "Martes"],
  [3, "Miercoles"],
  [4, "Jueves"],
  [5, "Viernes"],
  [6, "Sabado"],
  [7, "Domingo"]
]);

const emptyLinea: LineaInput = { nombre: "", activa: true };
const emptyIndicador: IndicadorInput = { codigo: "", nombre: "", color: "#d9ecfb", orden: 1, activo: true };
const emptyTurno: TurnoInput = { codigo: "", nombre: "", activo: true };
const emptyHorario: TurnoHorarioInput = {
  turno_id: 0,
  dia_semana: 1,
  hora_inicio: "08:10",
  hora_fin: "15:30",
  cruza_medianoche: false,
  activo: true
};

interface ReporteFormState {
  fecha_reporte: string;
  linea_id: string;
  opinona_planificada: string;
  opinona_real: string;
  producciones_programadas: string;
  producciones_realizadas: string;
  tipo_atraso_adelanto: TipoAtrasoAdelanto;
  minutos_atraso_adelanto: string;
  observacion_general: string;
  imagen_reporte_data: string;
  imagen_reporte_mime: string;
  imagen_reporte_nombre: string;
}

const emptyReporteForm: ReporteFormState = {
  fecha_reporte: "",
  linea_id: "",
  opinona_planificada: "",
  opinona_real: "",
  producciones_programadas: "",
  producciones_realizadas: "",
  tipo_atraso_adelanto: "Atraso",
  minutos_atraso_adelanto: "0",
  observacion_general: "",
  imagen_reporte_data: "",
  imagen_reporte_mime: "",
  imagen_reporte_nombre: ""
};

interface DetencionFormState {
  indicador_id: string;
  turno_id: string;
  hora_inicio: string;
  hora_fin: string;
  descripcion: string;
  plan_accion: string;
}

const emptyDetencionForm: DetencionFormState = {
  indicador_id: "",
  turno_id: "",
  hora_inicio: "",
  hora_fin: "",
  descripcion: "",
  plan_accion: ""
};

interface CajaFormState {
  tipo: CajaTipo;
  cantidad: string;
  producto_id: string;
  producto_nombre: string;
  turno_id: string;
}

const emptyCajaForm: CajaFormState = {
  tipo: "Retenida",
  cantidad: "1",
  producto_id: "",
  producto_nombre: "",
  turno_id: ""
};

export function App() {
  const [activeSection, setActiveSection] = useState<SectionKey>("reporte");
  const [configuration, setConfiguration] = useState<ConfigurationState | null>(null);
  const [reporte, setReporte] = useState<Reporte | null>(null);
  const [reporteResumen, setReporteResumen] = useState<ReporteResumen | null>(null);
  const [reporteForm, setReporteForm] = useState<ReporteFormState>(emptyReporteForm);
  const [detenciones, setDetenciones] = useState<Detencion[]>([]);
  const [cajas, setCajas] = useState<CajaRetenidaRechazada[]>([]);
  const [reportesFinalizados, setReportesFinalizados] = useState<ReporteFinalizadoListItem[]>([]);
  const [informeSeleccionado, setInformeSeleccionado] = useState<ReporteInforme | null>(null);
  const [isLoadingInformes, setIsLoadingInformes] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardResumen | null>(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [liveNow, setLiveNow] = useState(() => new Date());
  const [showInactive, setShowInactive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reportSaveStatus, setReportSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const lastReportSignature = useRef("");
  const reporteRequestVersion = useRef(0);

  async function applyReporteActual(reporteResponse: Reporte | null) {
    setReporte(reporteResponse);
    if (!reporteResponse) {
      setReporteForm(emptyReporteForm);
      setDetenciones([]);
      setCajas([]);
      setReporteResumen(null);
      lastReportSignature.current = "";
      return;
    }

    const nextForm = reporteToForm(reporteResponse);
    setReporteForm(nextForm);
    lastReportSignature.current = JSON.stringify(reporteToPayload(nextForm));
    const [detencionesResponse, cajasResponse, resumenResponse] = await Promise.all([
      fetchDetenciones(reporteResponse.id),
      fetchCajas(reporteResponse.id),
      fetchReporteResumen(reporteResponse.id)
    ]);
    setDetenciones(detencionesResponse);
    setCajas(cajasResponse);
    setReporteResumen(resumenResponse);
  }

  async function loadDashboardData(incluirInactivas = showInactive) {
    const requestVersion = ++reporteRequestVersion.current;
    setIsLoading(true);
    setError(null);
    try {
      const [configurationResponse, reporteResponse] = await Promise.all([
        fetchInitialConfiguration(incluirInactivas),
        fetchReporteActual()
      ]);
      setConfiguration(configurationResponse);
      if (requestVersion !== reporteRequestVersion.current) return;
      await applyReporteActual(reporteResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los datos iniciales.");
    } finally {
      setIsLoading(false);
    }
  }

  async function refreshReporteActual() {
    const requestVersion = ++reporteRequestVersion.current;
    setIsLoading(true);
    setError(null);
    try {
      const reporteResponse = await fetchReporteActual();
      if (requestVersion !== reporteRequestVersion.current) return;
      await applyReporteActual(reporteResponse);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el reporte del dia.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData(false);
  }, []);

  async function runMutation(action: () => Promise<unknown>, successMessage: string) {
    setIsSaving(true);
    setError(null);
    setMessage("Guardando...");
    try {
      await action();
      await loadDashboardData(showInactive);
      setMessage(successMessage);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error al guardar");
      setMessage(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveReporte(input: ReporteUpdateInput) {
    if (!reporte) return;
    setReportSaveStatus("saving");
    setMessage("Guardando...");
    setError(null);
    try {
      const updated = await updateReporte(reporte.id, input);
      setReporte(updated);
      setReporteResumen(await fetchReporteResumen(updated.id));
      lastReportSignature.current = JSON.stringify(input);
      setReportSaveStatus("saved");
      setMessage("Guardado correctamente");
    } catch (saveError) {
      setReportSaveStatus("error");
      setError(saveError instanceof Error ? saveError.message : "Error al guardar");
      setMessage(null);
    }
  }

  async function reloadDetenciones(reporteId = reporte?.id) {
    if (!reporteId) return;
    const [detencionesResponse, resumenResponse] = await Promise.all([
      fetchDetenciones(reporteId),
      fetchReporteResumen(reporteId)
    ]);
    setDetenciones(detencionesResponse);
    setReporteResumen(resumenResponse);
  }

  async function reloadCajas(reporteId = reporte?.id) {
    if (!reporteId) return;
    setCajas(await fetchCajas(reporteId));
  }

  async function loadInformes(filters: ReporteFinalizadoFilters = {}) {
    setIsLoadingInformes(true);
    setError(null);
    try {
      setReportesFinalizados(await fetchReportesFinalizados(filters));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar los informes.");
    } finally {
      setIsLoadingInformes(false);
    }
  }

  async function openInforme(reporteId: number) {
    setIsLoadingInformes(true);
    setError(null);
    try {
      setInformeSeleccionado(await fetchReporteInforme(reporteId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el informe.");
    } finally {
      setIsLoadingInformes(false);
    }
  }

  async function loadDashboard(filters: DashboardFilters = defaultDashboardFilters()) {
    setIsLoadingDashboard(true);
    setError(null);
    try {
      setDashboardData(await fetchDashboard(filters));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No fue posible cargar el dashboard.");
    } finally {
      setIsLoadingDashboard(false);
    }
  }

  function triggerPdfDownload(blob: Blob, reporteId: number) {
    triggerBlobDownload(blob, `reporte-diario-${reporteId}.pdf`);
  }

  function triggerBlobDownload(blob: Blob, filename: string) {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  }

  async function downloadPdf(reporteId: number) {
    setIsSaving(true);
    setError(null);
    setMessage("Preparando PDF...");
    try {
      triggerPdfDownload(await downloadReportePdf(reporteId), reporteId);
      setMessage("PDF descargado correctamente");
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Error al descargar PDF");
      setMessage(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function downloadBackup() {
    setIsSaving(true);
    setError(null);
    setMessage("Preparando respaldo...");
    try {
      triggerBlobDownload(await downloadDatabaseBackup(), `respaldo-reporte-detenciones-${dateInputValue(new Date())}.sql`);
      setMessage("Respaldo descargado correctamente");
    } catch (backupError) {
      setError(backupError instanceof Error ? backupError.message : "Error al descargar respaldo");
      setMessage(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function startNewReporte(fechaReporte: string) {
    const requestVersion = ++reporteRequestVersion.current;
    setIsSaving(true);
    setReportSaveStatus("idle");
    setError(null);
    setMessage("Iniciando reporte...");
    try {
      const nextReporte = await iniciarReporte(fechaReporte) ?? await fetchReporteActual();
      if (!nextReporte) throw new Error("No fue posible iniciar el reporte.");
      if (requestVersion !== reporteRequestVersion.current) return;
      await applyReporteActual(nextReporte);
      setMessage("Reporte iniciado correctamente");
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "No fue posible iniciar el reporte.");
      setMessage(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function finalizeCurrentReporte() {
    if (!reporte) return;
    setIsSaving(true);
    setReportSaveStatus("saving");
    setMessage("Finalizando reporte...");
    setError(null);
    try {
      const missingGeneralFields = validateReporteGeneralFields(reporteForm);
      if (missingGeneralFields.length > 0) {
        throw new Error(`No se puede finalizar el reporte. Faltan datos obligatorios:\n- ${missingGeneralFields.join("\n- ")}`);
      }

      const payload = reporteToPayload(reporteForm);
      const signature = JSON.stringify(payload);
      if (signature !== lastReportSignature.current && reporte.estado !== "finalizado") {
        await updateReporte(reporte.id, payload);
        lastReportSignature.current = signature;
      }

      const finalized: ReporteFinalizadoResponse = await finalizarReporte(reporte.id);
      setReporte(null);
      setReporteResumen(null);
      setReporteForm(emptyReporteForm);
      setDetenciones([]);
      setCajas([]);
      lastReportSignature.current = "";
      setReportSaveStatus("saved");
      setMessage(`Reporte ${finalized.reporte.id} finalizado correctamente. El PDF queda disponible en Informes.`);
      await loadInformes();
      setActiveSection("informes");
    } catch (finalizeError) {
      setReportSaveStatus("error");
      setError(finalizeError instanceof Error ? finalizeError.message : "Error al finalizar reporte");
      setMessage(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveDetencion(input: DetencionInput, detencionId?: number) {
    if (!reporte) return;
    setIsSaving(true);
    setMessage("Guardando...");
    setError(null);
    try {
      if (detencionId) {
        await updateDetencion(detencionId, input);
      } else {
        await createDetencion(reporte.id, input);
      }
      await reloadDetenciones(reporte.id);
      setReporte(await fetchReporteActual());
      setMessage("Guardado correctamente");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error al guardar");
      setMessage(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function removeDetencion(detencionId: number) {
    setIsSaving(true);
    setMessage("Guardando...");
    setError(null);
    try {
      await deleteDetencion(detencionId);
      await reloadDetenciones();
      setReporte(await fetchReporteActual());
      setMessage("Detencion eliminada correctamente");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar");
      setMessage(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCaja(input: CajaRetenidaRechazadaInput, cajaId?: number) {
    if (!reporte) return;
    setIsSaving(true);
    setMessage("Guardando...");
    setError(null);
    try {
      if (cajaId) {
        await updateCaja(cajaId, input);
      } else {
        await createCaja(reporte.id, input);
      }
      await reloadCajas(reporte.id);
      setReporte(await fetchReporteActual());
      setMessage("Registro de cajas guardado correctamente");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Error al guardar cajas");
      setMessage(null);
    } finally {
      setIsSaving(false);
    }
  }

  async function removeCaja(cajaId: number) {
    setIsSaving(true);
    setMessage("Guardando...");
    setError(null);
    try {
      await deleteCaja(cajaId);
      await reloadCajas();
      setReporte(await fetchReporteActual());
      setMessage("Registro de cajas eliminado correctamente");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Error al eliminar cajas");
      setMessage(null);
    } finally {
      setIsSaving(false);
    }
  }

  useEffect(() => {
    if (!reporte || activeSection !== "reporte") return;
    if (reporte.estado === "finalizado") return;

    const payload = reporteToPayload(reporteForm);
    const nextSignature = JSON.stringify(payload);
    if (nextSignature === lastReportSignature.current) return;

    const timeoutId = window.setTimeout(() => {
      lastReportSignature.current = nextSignature;
      saveReporte(payload);
    }, 800);

    return () => window.clearTimeout(timeoutId);
  }, [activeSection, reporte, reporteForm]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setLiveNow(new Date()), 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (activeSection === "informes") {
      loadInformes();
    }
    if (activeSection === "dashboard") {
      loadDashboard();
    }
    if (activeSection === "reporte") {
      refreshReporteActual();
    }
  }, [activeSection]);

  const turnosActivos = useMemo(() => {
    return configuration?.turnos.filter((turno) => Boolean(turno.activo)) ?? [];
  }, [configuration]);

  return (
    <main className="min-h-dvh bg-industrial-50 text-industrial-900">
      <header className="border-b border-industrial-100 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-industrial-500">Produccion y detenciones</p>
              <h1 className="mt-1 text-2xl font-bold leading-tight text-industrial-900 sm:text-3xl">
                Sistema Web de Reporte Diario
              </h1>
            </div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-industrial-100 bg-industrial-50 px-4 py-2 text-sm font-medium text-industrial-700">
              <Activity className="h-4 w-4" aria-hidden="true" />
              Modulo de configuracion
            </div>
          </div>
          <nav aria-label="Navegacion principal" className="flex gap-2 overflow-x-auto pb-1">
            {navItems.map((item) => (
              <button
                className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-industrial-500 ${
                  item.key === activeSection
                    ? "app-active-nav bg-industrial-900 text-white"
                    : "text-industrial-600 hover:bg-industrial-100 hover:text-industrial-900"
                }`}
                disabled={item.key === "placeholder"}
                key={item.label}
                onClick={() => item.key !== "placeholder" && setActiveSection(item.key)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <StatusBar error={error} isLoading={isLoading} isSaving={isSaving} message={message} />

      {activeSection === "reporte" ? (
        <ReporteDiaView
          cajas={cajas}
          configuration={configuration}
          detenciones={detenciones}
          isSaving={isSaving}
          liveNow={liveNow}
          onDeleteCaja={removeCaja}
          onDeleteDetencion={removeDetencion}
          onFinalizeReporte={finalizeCurrentReporte}
          onSaveCaja={saveCaja}
          onSaveDetencion={saveDetencion}
          onFormChange={setReporteForm}
          onStartReporte={startNewReporte}
          reportSaveStatus={reportSaveStatus}
          reporte={reporte}
          reporteForm={reporteForm}
          reporteResumen={reporteResumen}
        />
      ) : activeSection === "informes" ? (
        <InformesView
          configuration={configuration}
          informe={informeSeleccionado}
          isLoading={isLoadingInformes}
          onDownloadPdf={downloadPdf}
          onOpenInforme={openInforme}
          onBackToList={() => setInformeSeleccionado(null)}
          onReload={loadInformes}
          reportes={reportesFinalizados}
        />
      ) : activeSection === "dashboard" ? (
        <DashboardView
          configuration={configuration}
          dashboard={dashboardData}
          isLoading={isLoadingDashboard}
          onReload={loadDashboard}
        />
      ) : (
        <ConfigurationView
          configuration={configuration}
          isSaving={isSaving}
          onCreateHorario={(input) => runMutation(() => createTurnoHorario(input), "Guardado correctamente")}
          onCreateIndicador={(input) => runMutation(() => createIndicador(input), "Guardado correctamente")}
          onCreateLinea={(input) => runMutation(() => createLinea(input), "Guardado correctamente")}
          onCreateTurno={(input) => runMutation(() => createTurno(input), "Guardado correctamente")}
          onDeactivateHorario={(id) =>
            runMutation(() => deactivateTurnoHorario(id), "Registro desactivado correctamente")
          }
          onDeactivateIndicador={(id) => runMutation(() => deactivateIndicador(id), "Registro desactivado correctamente")}
          onDeactivateLinea={(id) => runMutation(() => deactivateLinea(id), "Registro desactivado correctamente")}
          onDeactivateTurno={(id) => runMutation(() => deactivateTurno(id), "Registro desactivado correctamente")}
          onDownloadBackup={downloadBackup}
          onReload={() => loadDashboardData(showInactive)}
          onShowInactiveChange={(value) => {
            setShowInactive(value);
            loadDashboardData(value);
          }}
          onUpdateHorario={(id, input) => runMutation(() => updateTurnoHorario(id, input), "Guardado correctamente")}
          onUpdateIndicador={(id, input) => runMutation(() => updateIndicador(id, input), "Guardado correctamente")}
          onUpdateLinea={(id, input) => runMutation(() => updateLinea(id, input), "Guardado correctamente")}
          onUpdateTurno={(id, input) => runMutation(() => updateTurno(id, input), "Guardado correctamente")}
          showInactive={showInactive}
          turnosActivos={turnosActivos}
        />
      )}
    </main>
  );
}

function DashboardView({
  configuration,
  dashboard,
  isLoading,
  onReload
}: {
  configuration: ConfigurationState | null;
  dashboard: DashboardResumen | null;
  isLoading: boolean;
  onReload: (filters?: DashboardFilters) => Promise<void>;
}) {
  const [filters, setFilters] = useState<DashboardFilters>(() => defaultDashboardFilters());
  const data = dashboard ?? emptyDashboard();

  const applyFilters = () => {
    onReload(filters);
  };

  const setToday = () => {
    const nextFilters = defaultDashboardFilters();
    setFilters(nextFilters);
    onReload(nextFilters);
  };

  const setWeek = () => {
    const nextFilters = currentWeekFilters();
    setFilters(nextFilters);
    onReload(nextFilters);
  };

  const clearFilters = () => {
    const nextFilters: DashboardFilters = {};
    setFilters(nextFilters);
    onReload(nextFilters);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-industrial-100 bg-white p-5 shadow-panel lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-industrial-500">Dashboard historico</p>
          <h2 className="mt-1 text-xl font-semibold text-industrial-900">Analisis de produccion y detenciones</h2>
          <p className="mt-2 text-sm leading-6 text-industrial-600">
            Vista ejecutiva para analizar el dia actual, una semana o un rango personalizado.
          </p>
        </div>
        <button
          className="app-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-industrial-900 px-4 text-sm font-semibold text-white"
          onClick={applyFilters}
          type="button"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      <article className="mb-6 rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-4 lg:grid-cols-4">
            <DateInput
              label="Fecha inicio"
              onChange={(fecha_inicio) => setFilters((current) => ({ ...current, fecha_inicio }))}
              value={filters.fecha_inicio ?? ""}
            />
            <DateInput
              label="Fecha fin"
              onChange={(fecha_fin) => setFilters((current) => ({ ...current, fecha_fin }))}
              value={filters.fecha_fin ?? ""}
            />
            <SelectInput
              label="Linea"
              onChange={(linea_id) => setFilters((current) => ({ ...current, linea_id: linea_id === "0" ? "" : linea_id }))}
              options={(configuration?.lineas ?? []).map((linea) => ({ label: linea.nombre, value: String(linea.id) }))}
              value={filters.linea_id || "0"}
            />
            <SelectInput
              label="Turno"
              onChange={(turno_id) => setFilters((current) => ({ ...current, turno_id: turno_id === "0" ? "" : turno_id }))}
              options={(configuration?.turnos ?? []).map((turno) => ({ label: turno.nombre, value: String(turno.id) }))}
              value={filters.turno_id || "0"}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="app-secondary-button min-h-11 rounded-md border border-industrial-100 px-3 text-sm font-semibold text-industrial-700" onClick={setToday} type="button">
              Hoy
            </button>
            <button className="app-secondary-button min-h-11 rounded-md border border-industrial-100 px-3 text-sm font-semibold text-industrial-700" onClick={setWeek} type="button">
              Semana
            </button>
            <button className="app-secondary-button min-h-11 rounded-md border border-industrial-100 px-3 text-sm font-semibold text-industrial-700" onClick={clearFilters} type="button">
              Limpiar
            </button>
          </div>
        </div>
      </article>

      {isLoading ? (
        <p className="mb-6 rounded-md bg-white p-4 text-sm text-industrial-600 shadow-sm">Cargando dashboard...</p>
      ) : null}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total minutos" value={`${data.total_minutos} min`} emphasis />
        <SummaryCard label="Total detenciones" value={String(data.total_detenciones)} />
        <SummaryCard label="Cumplimiento" value={formatValueWithFallback(data.cumplimiento_promedio_o_calculado, "%")} />
        <SummaryCard
          label="OPINONA"
          value={`${formatNullableNumber(data.opinona_real_promedio)}% / ${formatNullableNumber(data.opinona_planificada_promedio)}%`}
        />
        <SummaryCard
          label="Producciones"
          value={`${data.producciones_realizadas_total} / ${data.producciones_programadas_total}`}
        />
      </div>

      <div className="mb-6 grid gap-5 xl:grid-cols-2">
        <ChartPanel title="Minutos por indicador">
          <ResponsiveContainer height={300} width="100%">
            <BarChart data={data.minutos_por_indicador} margin={{ bottom: 8, left: 0, right: 10, top: 10 }}>
              <CartesianGrid stroke="#e5edf4" vertical={false} />
              <XAxis dataKey="codigo" tick={{ fill: "#526274", fontSize: 12 }} />
              <YAxis tick={{ fill: "#526274", fontSize: 12 }} />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#d9e2ec" }} formatter={(value) => [`${value} min`, "Minutos"]} />
              <Bar dataKey="minutos" radius={[6, 6, 0, 0]}>
                {data.minutos_por_indicador.map((item) => (
                  <ChartCell fill={item.color ?? "#d9ecfb"} key={item.id} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>

        <ChartPanel title="Minutos por turno">
          <ResponsiveContainer height={300} width="100%">
            <BarChart data={data.minutos_por_turno} layout="vertical" margin={{ bottom: 8, left: 20, right: 16, top: 10 }}>
              <CartesianGrid stroke="#e5edf4" horizontal={false} />
              <XAxis tick={{ fill: "#526274", fontSize: 12 }} type="number" />
              <YAxis dataKey="codigo" tick={{ fill: "#526274", fontSize: 12 }} type="category" width={40} />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#d9e2ec" }} formatter={(value) => [`${value} min`, "Minutos"]} />
              <Bar dataKey="minutos" fill="#9ed6bd" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartPanel>
      </div>

      <article className="rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-industrial-900">Ranking de detenciones mas largas</h3>
        {data.ranking_detenciones_largas.length === 0 ? (
          <p className="mt-4 rounded-md bg-industrial-50 p-4 text-sm text-industrial-600">No hay detenciones finalizadas para el periodo seleccionado.</p>
        ) : (
          <DashboardRankingList items={data.ranking_detenciones_largas} />
        )}
      </article>
    </section>
  );
}

function ChartPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <article className="rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-industrial-900">{title}</h3>
      <div className="mt-4 h-[300px]">{children}</div>
    </article>
  );
}

function DashboardRankingList({ items }: { items: DashboardResumen["ranking_detenciones_largas"] }) {
  return (
    <div className="mt-5">
      <div className="hidden overflow-hidden rounded-lg border border-industrial-100 md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-industrial-50 text-xs uppercase text-industrial-500">
            <tr>
              {["Fecha", "Linea", "Indicador", "Turno", "Minutos", "Descripcion"].map((column) => (
                <th className="px-4 py-3 font-semibold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-industrial-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-semibold text-industrial-900">{formatDate(item.fecha)}</td>
                <td className="px-4 py-3 text-industrial-700">{item.linea}</td>
                <td className="px-4 py-3 text-industrial-700">{item.indicador_codigo} - {item.indicador}</td>
                <td className="px-4 py-3 text-industrial-700">{item.turno}</td>
                <td className="px-4 py-3 font-semibold text-industrial-900">{item.minutos} min</td>
                <td className="px-4 py-3 text-industrial-700">{item.descripcion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {items.map((item) => (
          <article className="rounded-lg border border-industrial-100 bg-white p-4 shadow-sm" key={item.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-industrial-900">{formatDate(item.fecha)} - {item.linea}</p>
                <p className="mt-1 text-sm text-industrial-600">{item.indicador_codigo} - {item.indicador}</p>
              </div>
              <span className="rounded-full bg-signal-sky px-2.5 py-1 text-xs font-semibold text-industrial-800">{item.minutos} min</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <SmallFact label="Turno" value={item.turno} />
              <SmallFact label="Minutos" value={`${item.minutos} min`} />
            </div>
            <p className="mt-4 text-sm font-semibold text-industrial-900">Descripcion</p>
            <p className="mt-1 text-sm text-industrial-700">{item.descripcion}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function InformesView({
  configuration,
  informe,
  isLoading,
  onBackToList,
  onDownloadPdf,
  onOpenInforme,
  onReload,
  reportes
}: {
  configuration: ConfigurationState | null;
  informe: ReporteInforme | null;
  isLoading: boolean;
  onBackToList: () => void;
  onDownloadPdf: (reporteId: number) => Promise<void>;
  onOpenInforme: (reporteId: number) => Promise<void>;
  onReload: (filters?: ReporteFinalizadoFilters) => Promise<void>;
  reportes: ReporteFinalizadoListItem[];
}) {
  const [filters, setFilters] = useState<ReporteFinalizadoFilters>({});

  if (informe) {
    return (
      <InformeDetalleView
        informe={informe}
        isLoading={isLoading}
        onBack={onBackToList}
        onDownloadPdf={() => onDownloadPdf(informe.reporte.id)}
      />
    );
  }

  const applyFilters = () => {
    onReload(filters);
  };

  const clearFilters = () => {
    const nextFilters: ReporteFinalizadoFilters = {};
    setFilters(nextFilters);
    onReload(nextFilters);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-industrial-100 bg-white p-5 shadow-panel lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-industrial-500">Informes</p>
          <h2 className="mt-1 text-xl font-semibold text-industrial-900">Reportes finalizados</h2>
          <p className="mt-2 text-sm leading-6 text-industrial-600">
            Consulta online de reportes cerrados y descarga del PDF ejecutivo cuando sea necesario.
          </p>
        </div>
        <button
          className="app-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-industrial-900 px-4 text-sm font-semibold text-white"
          onClick={() => onReload(filters)}
          type="button"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Actualizar
        </button>
      </div>

      <article className="mb-6 rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-industrial-900">Filtros</h3>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1.2fr_auto_auto]">
          <DateInput
            label="Fecha inicio"
            onChange={(fecha_inicio) => setFilters((current) => ({ ...current, fecha_inicio }))}
            value={filters.fecha_inicio ?? ""}
          />
          <DateInput
            label="Fecha fin"
            onChange={(fecha_fin) => setFilters((current) => ({ ...current, fecha_fin }))}
            value={filters.fecha_fin ?? ""}
          />
          <SelectInput
            label="Linea"
            onChange={(linea_id) => setFilters((current) => ({ ...current, linea_id: linea_id === "0" ? "" : linea_id }))}
            options={(configuration?.lineas ?? []).map((linea) => ({ label: linea.nombre, value: String(linea.id) }))}
            value={filters.linea_id || "0"}
          />
          <button
            className="app-primary-button inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-md bg-industrial-900 px-4 text-sm font-semibold text-white"
            onClick={applyFilters}
            type="button"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Filtrar
          </button>
          <button
            className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-md border border-industrial-100 px-4 text-sm font-semibold text-industrial-700"
            onClick={clearFilters}
            type="button"
          >
            Limpiar
          </button>
        </div>
      </article>

      <article className="rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
        {isLoading ? (
          <p className="rounded-md bg-industrial-50 p-4 text-sm text-industrial-600">Cargando informes...</p>
        ) : reportes.length === 0 ? (
          <p className="rounded-md bg-industrial-50 p-4 text-sm text-industrial-600">Todavia no hay reportes finalizados.</p>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-lg border border-industrial-100 md:block">
              <table className="w-full border-collapse text-left text-sm">
                <thead className="bg-industrial-50 text-xs uppercase text-industrial-500">
                  <tr>
                    {["Fecha", "Linea", "OPINONA real", "Producciones", "Cumplimiento", "Total minutos", "Acciones"].map((column) => (
                      <th className="px-4 py-3 font-semibold" key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-industrial-100">
                  {reportes.map((reporte) => (
                    <tr key={reporte.id}>
                      <td className="px-4 py-3 font-semibold text-industrial-900">{formatDate(reporte.fecha_reporte)}</td>
                      <td className="px-4 py-3 text-industrial-700">{reporte.linea_nombre}</td>
                      <td className="px-4 py-3 text-industrial-700">{formatValueWithFallback(reporte.opinona_real, "%")}</td>
                      <td className="px-4 py-3 text-industrial-700">
                        {reporte.producciones_realizadas ?? 0} / {reporte.producciones_programadas ?? 0}
                      </td>
                      <td className="px-4 py-3 text-industrial-700">{formatValueWithFallback(reporte.cumplimiento, "%")}</td>
                      <td className="px-4 py-3 font-semibold text-industrial-900">{reporte.total_minutos} min</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <ViewInformeButton onClick={() => onOpenInforme(reporte.id)} />
                          <DownloadPdfButton onClick={() => onDownloadPdf(reporte.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 md:hidden">
              {reportes.map((reporte) => (
                <article className="rounded-lg border border-industrial-100 bg-white p-4 shadow-sm" key={reporte.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-industrial-900">{formatDate(reporte.fecha_reporte)}</p>
                      <p className="mt-1 text-sm text-industrial-600">{reporte.linea_nombre}</p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Finalizado</span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <SmallFact label="OPINONA real" value={formatValueWithFallback(reporte.opinona_real, "%")} />
                    <SmallFact label="Producciones" value={`${reporte.producciones_realizadas ?? 0} / ${reporte.producciones_programadas ?? 0}`} />
                    <SmallFact label="Cumplimiento" value={formatValueWithFallback(reporte.cumplimiento, "%")} />
                    <SmallFact label="Total minutos" value={`${reporte.total_minutos} min`} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <ViewInformeButton onClick={() => onOpenInforme(reporte.id)} />
                    <DownloadPdfButton onClick={() => onDownloadPdf(reporte.id)} />
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
      </article>
    </section>
  );
}

function InformeDetalleView({
  informe,
  isLoading,
  onBack,
  onDownloadPdf
}: {
  informe: ReporteInforme;
  isLoading: boolean;
  onBack: () => void;
  onDownloadPdf: () => Promise<void>;
}) {
  const { reporte, resumen, detenciones, cajas } = informe;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-industrial-100 bg-white p-5 shadow-panel lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-industrial-500">Informe finalizado</p>
          <h2 className="mt-1 text-xl font-semibold text-industrial-900">
            {formatDate(reporte.fecha_reporte)} - {reporte.linea_nombre}
          </h2>
          <p className="mt-2 text-sm leading-6 text-industrial-600">
            Consulta online de solo lectura. Finalizado el {reporte.finalizado_at ?? "-"}.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            className="app-secondary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-industrial-100 px-4 text-sm font-semibold text-industrial-700"
            onClick={onBack}
            type="button"
          >
            Volver a informes
          </button>
          <button
            className="app-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-industrial-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            disabled={isLoading}
            onClick={onDownloadPdf}
            type="button"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Descargar PDF
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total minutos" value={`${resumen.total_minutos} min`} emphasis />
        <SummaryCard label="Total detenciones" value={String(resumen.total_detenciones)} />
        <SummaryCard label="Cumplimiento" value={formatValueWithFallback(resumen.cumplimiento, "%")} />
        <SummaryCard label="Estado" value="Finalizado" />
        <SummaryCard label="OPINONA" value={`${formatNullableNumber(reporte.opinona_real)}% / ${formatNullableNumber(reporte.opinona_planificada)}%`} />
        <SummaryCard label="Producciones" value={`${reporte.producciones_realizadas ?? 0} / ${reporte.producciones_programadas ?? 0}`} />
        <SummaryCard label="Atraso / Adelanto" value={`${reporte.tipo_atraso_adelanto}: ${reporte.minutos_atraso_adelanto} min`} />
        <SummaryCard label="Periodo" value={formatDate(reporte.fecha_reporte)} />
      </div>

      <article className="mb-6 rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-industrial-900">Observacion general</h3>
        <p className="mt-3 rounded-md bg-industrial-50 p-4 text-sm leading-6 text-industrial-700">
          {informe.observacion_general ?? "Sin observacion registrada."}
        </p>
      </article>

      <article className="mb-6 rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-industrial-900">Detenciones</h3>
        {detenciones.length === 0 ? (
          <p className="mt-4 rounded-md bg-industrial-50 p-4 text-sm text-industrial-600">Este reporte no registro detenciones.</p>
        ) : (
          <InformeDetencionesList detenciones={detenciones} />
        )}
      </article>

      <article className="mb-6 rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-semibold text-industrial-900">Cajas retenidas/rechazadas</h3>
        {cajas.length === 0 ? (
          <p className="mt-4 rounded-md bg-industrial-50 p-4 text-sm text-industrial-600">Este reporte no registro cajas retenidas o rechazadas.</p>
        ) : (
          <InformeCajasList cajas={cajas} />
        )}
      </article>

      {reporte.imagen_reporte_data ? (
        <article className="mb-6 rounded-lg border border-industrial-100 bg-white p-5 text-center shadow-sm">
          <h3 className="text-lg font-semibold text-industrial-900">
            Captura OPINONA {formatDate(reporte.fecha_reporte)}
          </h3>
          <p className="mt-1 text-sm text-industrial-600">{reporte.imagen_reporte_nombre ?? "Imagen adjunta"}</p>
          <img
            alt="Imagen adjunta del reporte"
            className="mx-auto mt-4 max-h-[520px] max-w-full rounded-lg object-contain"
            src={reporte.imagen_reporte_data}
          />
        </article>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <ResumenBreakdownPanel
          title="Minutos por indicador"
          items={[...informe.total_por_indicador].sort((a, b) => b.minutos - a.minutos || a.codigo.localeCompare(b.codigo))}
          renderName={(item) => `${item.codigo} - ${item.nombre}`}
        />
        <ResumenBreakdownPanel
          title="Minutos por turno"
          items={[...informe.total_por_turno].sort((a, b) => b.minutos - a.minutos || a.codigo.localeCompare(b.codigo))}
          renderName={(item) => item.nombre}
        />
      </div>
    </section>
  );
}

function InformeDetencionesList({ detenciones }: { detenciones: Detencion[] }) {
  return (
    <div className="mt-5">
      <div className="hidden overflow-hidden rounded-lg border border-industrial-100 md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-industrial-50 text-xs uppercase text-industrial-500">
            <tr>
              {["Indicador", "Turno", "Hora inicio", "Hora fin", "Minutos", "Descripcion", "Plan de accion"].map((column) => (
                <th className="px-4 py-3 font-semibold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-industrial-100">
            {detenciones.map((detencion) => (
              <tr key={detencion.id}>
                <td className="px-4 py-3"><IndicatorPill detencion={detencion} /></td>
                <td className="px-4 py-3 text-industrial-700">{detencion.turno_nombre}</td>
                <td className="px-4 py-3 text-industrial-700">{detencion.hora_inicio}</td>
                <td className="px-4 py-3 text-industrial-700">{detencion.hora_fin ?? "-"}</td>
                <td className="px-4 py-3 font-semibold text-industrial-900">{detencion.minutos_finales ?? detencion.minutos_calculados}</td>
                <td className="px-4 py-3 text-industrial-700">{detencion.descripcion}</td>
                <td className="px-4 py-3 text-industrial-700">{detencion.plan_accion ?? "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {detenciones.map((detencion) => (
          <article className="rounded-lg border border-industrial-100 bg-white p-4 shadow-sm" key={detencion.id}>
            <div className="flex items-start justify-between gap-3">
              <IndicatorPill detencion={detencion} />
              <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">Cerrada</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <SmallFact label="Turno" value={detencion.turno_nombre} />
              <SmallFact label="Minutos" value={String(detencion.minutos_finales ?? detencion.minutos_calculados)} />
              <SmallFact label="Inicio" value={detencion.hora_inicio} />
              <SmallFact label="Fin" value={detencion.hora_fin ?? "-"} />
            </div>
            <p className="mt-4 text-sm font-semibold text-industrial-900">Descripcion</p>
            <p className="mt-1 text-sm text-industrial-700">{detencion.descripcion}</p>
            <p className="mt-3 text-sm font-semibold text-industrial-900">Plan de accion</p>
            <p className="mt-1 text-sm text-industrial-700">{detencion.plan_accion ?? "-"}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function InformeCajasList({ cajas }: { cajas: CajaRetenidaRechazada[] }) {
  return (
    <div className="mt-5">
      <div className="hidden overflow-hidden rounded-lg border border-industrial-100 md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-industrial-50 text-xs uppercase text-industrial-500">
            <tr>
              {["Tipo", "Cantidad", "ID producto", "Producto", "Turno"].map((column) => (
                <th className="px-4 py-3 font-semibold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-industrial-100">
            {cajas.map((caja) => (
              <tr key={caja.id}>
                <td className="px-4 py-3"><CajaTipoPill tipo={caja.tipo} /></td>
                <td className="px-4 py-3 font-semibold text-industrial-900">{caja.cantidad}</td>
                <td className="px-4 py-3 text-industrial-700">{caja.producto_id}</td>
                <td className="px-4 py-3 text-industrial-700">{caja.producto_nombre}</td>
                <td className="px-4 py-3 text-industrial-700">{caja.turno_nombre}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {cajas.map((caja) => (
          <article className="rounded-lg border border-industrial-100 bg-white p-4 shadow-sm" key={caja.id}>
            <div className="flex items-start justify-between gap-3">
              <CajaTipoPill tipo={caja.tipo} />
              <p className="text-lg font-semibold text-industrial-900">{caja.cantidad} cajas</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <SmallFact label="Turno" value={caja.turno_nombre} />
              <SmallFact label="ID producto" value={caja.producto_id} />
            </div>
            <p className="mt-4 text-sm font-semibold text-industrial-900">Producto</p>
            <p className="mt-1 text-sm text-industrial-700">{caja.producto_nombre}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ReporteDiaView({
  cajas,
  configuration,
  detenciones,
  isSaving,
  liveNow,
  onDeleteCaja,
  onDeleteDetencion,
  onFinalizeReporte,
  onFormChange,
  onSaveCaja,
  onSaveDetencion,
  onStartReporte,
  reportSaveStatus,
  reporte,
  reporteForm,
  reporteResumen
}: {
  cajas: CajaRetenidaRechazada[];
  configuration: ConfigurationState | null;
  detenciones: Detencion[];
  isSaving: boolean;
  liveNow: Date;
  onDeleteCaja: (id: number) => Promise<void>;
  onDeleteDetencion: (id: number) => Promise<void>;
  onFinalizeReporte: () => Promise<void>;
  onFormChange: (form: ReporteFormState) => void;
  onSaveCaja: (input: CajaRetenidaRechazadaInput, cajaId?: number) => Promise<void>;
  onSaveDetencion: (input: DetencionInput, detencionId?: number) => Promise<void>;
  onStartReporte: (fechaReporte: string) => Promise<void>;
  reportSaveStatus: "idle" | "saving" | "saved" | "error";
  reporte: Reporte | null;
  reporteForm: ReporteFormState;
  reporteResumen: ReporteResumen | null;
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCajaModalOpen, setIsCajaModalOpen] = useState(false);
  const [showCajaSection, setShowCajaSection] = useState(false);
  const [editingDetencion, setEditingDetencion] = useState<Detencion | null>(null);
  const [editingCaja, setEditingCaja] = useState<CajaRetenidaRechazada | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [startReportDate, setStartReportDate] = useState(() => dateInputValue(new Date()));
  const cumplimiento = calculateCumplimiento(reporteForm.producciones_programadas, reporteForm.producciones_realizadas);
  const turnoActual = getTurnoActual(configuration?.horarios ?? []);
  const isFinalizado = reporte?.estado === "finalizado";
  const liveSummary = buildLiveSummary(detenciones, reporte?.fecha_reporte, liveNow, configuration, reporteResumen);
  const shouldShowCajaSection = showCajaSection || cajas.length > 0;

  function updateForm(next: Partial<ReporteFormState>) {
    onFormChange({ ...reporteForm, ...next });
  }

  async function handleImageChange(file: File | null) {
    setImageError(null);
    if (!file) return;
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setImageError("La imagen debe ser JPG o PNG.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setImageError("La imagen no debe superar 2 MB.");
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    updateForm({
      imagen_reporte_data: dataUrl,
      imagen_reporte_mime: file.type,
      imagen_reporte_nombre: file.name
    });
  }

  if (!reporte) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-industrial-100 bg-white p-6 shadow-panel">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-industrial-500">Reporte del dia</p>
              <h2 className="mt-1 text-xl font-semibold text-industrial-900">No hay reporte abierto</h2>
            </div>
            <button
              className="app-primary-button inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-industrial-900 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-industrial-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
              onClick={() => onStartReporte(startReportDate)}
              type="button"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Iniciar nuevo reporte
            </button>
          </div>
          <label className="mt-5 block max-w-xs text-sm font-medium text-industrial-700">
            Fecha del reporte
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
              onChange={(event) => setStartReportDate(event.target.value)}
              type="date"
              value={startReportDate}
            />
          </label>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-industrial-500">Estado</p>
            <p className="mt-2 text-lg font-semibold text-industrial-900">Sin reporte abierto</p>
          </div>
          <div className="rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-industrial-500">Siguiente accion</p>
            <p className="mt-2 text-lg font-semibold text-industrial-900">Iniciar cuando corresponda</p>
          </div>
          <div className="rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase text-industrial-500">Turno actual</p>
            <p className="mt-2 text-lg font-semibold text-industrial-900">
              {turnoActual ? `${turnoActual.turno_nombre} (${turnoActual.hora_inicio}-${turnoActual.hora_fin})` : "N/A"}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 rounded-lg border border-industrial-100 bg-white p-6 shadow-panel">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold text-industrial-500">Reporte del dia</p>
            <h2 className="mt-1 text-xl font-semibold text-industrial-900">
              {reporte ? `Reporte abierto ${formatDate(reporte.fecha_reporte)}` : "Cargando reporte actual"}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-industrial-600">
              Panel operativo para datos generales, detenciones y resumen de minutos del dia.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[520px]">
            <button
              className="app-success-button inline-flex min-h-14 items-center justify-center gap-2 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!reporte || isSaving}
              onClick={onFinalizeReporte}
              type="button"
            >
              <FileDown className="h-4 w-4" aria-hidden="true" />
              Finalizar reporte
            </button>
            <div className="flex min-h-14 flex-col justify-center rounded-lg border border-industrial-100 bg-industrial-50 px-4 py-2">
              <p className="text-xs font-semibold uppercase text-industrial-500">Ultima actualizacion</p>
              <p className="mt-1 text-sm font-semibold text-industrial-900">{reporte?.ultima_actualizacion ?? "Pendiente"}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 space-y-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Total minutos" value={`${liveSummary.totalMinutos} min`} emphasis />
          <SummaryCard label="Detenciones" value={String(liveSummary.totalDetenciones)} />
          <SummaryCard label="Detenciones abiertas" value={String(liveSummary.detencionesAbiertas)} />
          <SummaryCard label="Cumplimiento" value={cumplimiento} />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryCard label="Linea" value={selectedLineaName(configuration?.lineas ?? [], reporteForm.linea_id)} />
          <SummaryCard label="Turno actual" value={turnoActual ? `${turnoActual.turno_nombre} (${turnoActual.hora_inicio}-${turnoActual.hora_fin})` : "N/A"} />
          <SummaryCard label="OPINONA planificada" value={formatPercentValue(reporteForm.opinona_planificada)} />
          <SummaryCard label="OPINONA real" value={formatPercentValue(reporteForm.opinona_real)} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <SummaryCard label="Producciones programadas" value={reporteForm.producciones_programadas || "Pendiente"} />
          <SummaryCard label="Producciones realizadas" value={reporteForm.producciones_realizadas || "Pendiente"} />
        </div>
      </div>

      <article className="rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-industrial-900">Datos generales</h3>
            <p className="mt-1 text-sm text-industrial-600">Los cambios se guardan automaticamente despues de escribir.</p>
          </div>
          {isFinalizado ? (
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">Solo consulta</span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Reporte abierto
            </span>
          )}
        </div>

        <fieldset className="mt-6 grid gap-4 lg:grid-cols-3" disabled={isFinalizado || !reporte}>
          <label className="block text-sm font-medium text-industrial-700">
            Fecha del reporte
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
              onChange={(event) => updateForm({ fecha_reporte: event.target.value })}
              type="date"
              value={reporteForm.fecha_reporte}
            />
          </label>
          <SelectInput
            label="Linea"
            onChange={(linea_id) => updateForm({ linea_id })}
            options={(configuration?.lineas ?? []).map((linea) => ({ label: linea.nombre, value: String(linea.id) }))}
            value={reporteForm.linea_id}
          />
          <NumericTextInput
            label="OPINONA planificada %"
            onChange={(opinona_planificada) => updateForm({ opinona_planificada })}
            value={reporteForm.opinona_planificada}
          />
          <NumericTextInput
            label="OPINONA real %"
            onChange={(opinona_real) => updateForm({ opinona_real })}
            value={reporteForm.opinona_real}
          />
          <NumericTextInput
            label="Producciones programadas"
            onChange={(producciones_programadas) => updateForm({ producciones_programadas })}
            value={reporteForm.producciones_programadas}
          />
          <NumericTextInput
            label="Producciones realizadas"
            onChange={(producciones_realizadas) => updateForm({ producciones_realizadas })}
            value={reporteForm.producciones_realizadas}
          />
          <SelectInput
            label="Tipo atraso/adelanto"
            onChange={(tipo_atraso_adelanto) => updateForm({ tipo_atraso_adelanto: tipo_atraso_adelanto as TipoAtrasoAdelanto })}
            options={[
              { label: "Atraso", value: "Atraso" },
              { label: "Adelanto", value: "Adelanto" }
            ]}
            value={reporteForm.tipo_atraso_adelanto}
          />
          <NumericTextInput
            label="Minutos atraso/adelanto"
            onChange={(minutos_atraso_adelanto) => updateForm({ minutos_atraso_adelanto })}
            value={reporteForm.minutos_atraso_adelanto}
          />
          <label className="block text-sm font-medium text-industrial-700 lg:col-span-2">
            Observacion general
            <textarea
              className="mt-1 min-h-28 w-full rounded-md border border-industrial-100 px-3 py-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
              onChange={(event) => updateForm({ observacion_general: event.target.value })}
              value={reporteForm.observacion_general}
            />
          </label>
          <div className="lg:col-span-3">
            <label className="block text-sm font-medium text-industrial-700">
              Agrega captura del OPINONA JPG/PNG obligatoria
              <input
                accept="image/jpeg,image/png"
                className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 py-2 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
                onChange={(event) => handleImageChange(event.target.files?.[0] ?? null)}
                type="file"
              />
            </label>
            {imageError ? <p className="mt-2 text-sm font-medium text-red-700">{imageError}</p> : null}
            {reporteForm.imagen_reporte_data ? (
              <div className="mt-3 rounded-lg border border-industrial-100 bg-industrial-50 p-3">
                <p className="text-sm font-semibold text-industrial-700">{reporteForm.imagen_reporte_nombre || "Captura OPINONA cargada"}</p>
                <img
                  alt="Captura OPINONA cargada para el informe"
                  className="mt-3 max-h-56 w-full rounded-md object-contain"
                  src={reporteForm.imagen_reporte_data}
                />
              </div>
            ) : (
              <p className="mt-2 text-sm text-industrial-600">Esta captura OPINONA se mostrara en el informe online, debajo de detenciones. No se incluira en el PDF.</p>
            )}
          </div>
        </fieldset>
      </article>

      <article className="mt-6 rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-industrial-900">Detenciones</h3>
            <p className="mt-1 text-sm text-industrial-600">Registra paradas por indicador y turno. Las abiertas actualizan minutos en vivo.</p>
          </div>
          <button
            className="app-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-industrial-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isFinalizado || !reporte}
            onClick={() => {
              setEditingDetencion(null);
              setIsModalOpen(true);
            }}
            type="button"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar detencion
          </button>
        </div>

        <DetencionesList
          detenciones={detenciones}
          horarios={configuration?.horarios ?? []}
          liveNow={liveNow}
          onDelete={onDeleteDetencion}
          onEdit={(detencion) => {
            setEditingDetencion(detencion);
            setIsModalOpen(true);
          }}
          reporteFecha={reporte?.fecha_reporte}
        />
      </article>

      <article className="mt-6 rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-industrial-900">Cajas retenidas/rechazadas</h3>
            <p className="mt-1 text-sm text-industrial-600">
              Registra cajas solo cuando exista una retencion o rechazo de producto durante el turno.
            </p>
            <label className="mt-4 inline-flex items-center gap-3 text-sm font-semibold text-industrial-800">
              <input
                checked={shouldShowCajaSection}
                className="h-4 w-4 rounded border-industrial-200 text-industrial-900 focus:ring-industrial-400"
                disabled={isFinalizado || cajas.length > 0}
                onChange={(event) => setShowCajaSection(event.target.checked)}
                type="checkbox"
              />
              Hubo cajas retenidas o rechazadas
            </label>
          </div>
          {shouldShowCajaSection ? (
            <button
              className="app-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-industrial-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isFinalizado || !reporte}
              onClick={() => {
                setEditingCaja(null);
                setIsCajaModalOpen(true);
              }}
              type="button"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Agregar linea
            </button>
          ) : null}
        </div>

        {shouldShowCajaSection ? (
          <CajasList
            cajas={cajas}
            onDelete={onDeleteCaja}
            onEdit={(caja) => {
              setEditingCaja(caja);
              setIsCajaModalOpen(true);
            }}
            readOnly={isFinalizado}
          />
        ) : null}
      </article>

      <section className="mt-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-industrial-900">Resumen de minutos</h3>
          <p className="mt-1 text-sm text-industrial-600">Distribucion acumulada del dia por indicador y por turno.</p>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <ResumenBreakdownPanel
            title="Minutos por indicador"
            items={liveSummary.porIndicador}
            renderName={(item) => `${item.codigo} - ${item.nombre}`}
          />
          <ResumenBreakdownPanel
            title="Minutos por turno"
            items={liveSummary.porTurno}
            renderName={(item) => item.nombre}
          />
        </div>
      </section>

      {isModalOpen && reporte ? (
        <DetencionModal
          detencion={editingDetencion}
          horarios={configuration?.horarios ?? []}
          indicadores={(configuration?.indicadores ?? []).filter((indicador) => Boolean(indicador.activo))}
          isSaving={isSaving}
          onClose={() => {
            setIsModalOpen(false);
            setEditingDetencion(null);
          }}
          onSave={async (input, id) => {
            await onSaveDetencion(input, id);
            setIsModalOpen(false);
            setEditingDetencion(null);
          }}
          reporteFecha={reporte.fecha_reporte}
          turnos={(configuration?.turnos ?? []).filter((turno) => Boolean(turno.activo))}
        />
      ) : null}

      {isCajaModalOpen && reporte ? (
        <CajaModal
          caja={editingCaja}
          isSaving={isSaving}
          onClose={() => {
            setIsCajaModalOpen(false);
            setEditingCaja(null);
          }}
          onSave={async (input, id) => {
            await onSaveCaja(input, id);
            setIsCajaModalOpen(false);
            setEditingCaja(null);
          }}
          turnos={(configuration?.turnos ?? []).filter((turno) => Boolean(turno.activo))}
        />
      ) : null}
    </section>
  );
}

function DetencionModal({
  detencion,
  horarios,
  indicadores,
  isSaving,
  onClose,
  onSave,
  reporteFecha,
  turnos
}: {
  detencion: Detencion | null;
  horarios: TurnoHorario[];
  indicadores: Indicador[];
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: DetencionInput, id?: number) => Promise<void>;
  reporteFecha: string;
  turnos: Turno[];
}) {
  const defaultStart = detencion?.hora_inicio ?? currentTimeValue();
  const detectedTurno = getTurnoForReportTime(horarios, reporteFecha, defaultStart);
  const [form, setForm] = useState<DetencionFormState>({
    indicador_id: detencion ? String(detencion.indicador_id) : String(indicadores[0]?.id ?? ""),
    turno_id: detencion ? String(detencion.turno_id) : String(detectedTurno?.turno_id ?? turnos[0]?.id ?? ""),
    hora_inicio: defaultStart,
    hora_fin: detencion?.hora_fin ?? "",
    descripcion: detencion?.descripcion ?? "",
    plan_accion: detencion?.plan_accion ?? ""
  });

  function updateForm(next: Partial<DetencionFormState>) {
    const merged = { ...form, ...next };
    if ("hora_inicio" in next && !detencion) {
      const turno = getTurnoForReportTime(horarios, reporteFecha, next.hora_inicio ?? merged.hora_inicio);
      if (turno) merged.turno_id = String(turno.turno_id);
    }
    setForm(merged);
  }

  const canSave = Boolean(form.indicador_id && form.turno_id && form.hora_inicio && form.descripcion.trim());

  return (
    <div className="app-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-industrial-900/40 px-4 py-6">
      <div className="app-modal-panel max-h-[92dvh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-industrial-900">{detencion ? "Editar detencion" : "Agregar detencion"}</h3>
            <p className="mt-1 text-sm text-industrial-600">El turno se detecta por hora de inicio y puede editarse manualmente.</p>
          </div>
          <button className="app-secondary-button rounded-md p-2 text-industrial-500 hover:bg-industrial-100" onClick={onClose} type="button" aria-label="Cerrar modal">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SelectInput
            label="Indicador"
            onChange={(indicador_id) => updateForm({ indicador_id })}
            options={indicadores.map((indicador) => ({
              label: `${indicador.codigo} - ${indicador.nombre}`,
              value: String(indicador.id)
            }))}
            value={form.indicador_id}
          />
          <TimeInput label="Hora inicio" onChange={(hora_inicio) => updateForm({ hora_inicio })} value={form.hora_inicio} />
          <SelectInput
            label="Turno"
            onChange={(turno_id) => updateForm({ turno_id })}
            options={turnos.map((turno) => ({ label: turno.nombre, value: String(turno.id) }))}
            value={form.turno_id}
          />
          <TimeInput label="Hora fin" onChange={(hora_fin) => updateForm({ hora_fin })} value={form.hora_fin} />
          <label className="block text-sm font-medium text-industrial-700 md:col-span-2">
            Descripcion
            <textarea
              className="mt-1 min-h-24 w-full rounded-md border border-industrial-100 px-3 py-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
              onChange={(event) => updateForm({ descripcion: event.target.value })}
              value={form.descripcion}
            />
          </label>
          <label className="block text-sm font-medium text-industrial-700 md:col-span-2">
            Plan de accion
            <textarea
              className="mt-1 min-h-20 w-full rounded-md border border-industrial-100 px-3 py-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
              onChange={(event) => updateForm({ plan_accion: event.target.value })}
              value={form.plan_accion}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="app-secondary-button min-h-11 rounded-md border border-industrial-100 px-4 text-sm font-semibold text-industrial-700" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="app-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-industrial-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSave || isSaving}
            onClick={() =>
              onSave(
                {
                  indicador_id: Number(form.indicador_id),
                  turno_id: Number(form.turno_id),
                  hora_inicio: form.hora_inicio,
                  hora_fin: form.hora_fin || null,
                  descripcion: form.descripcion,
                  plan_accion: form.plan_accion || null
                },
                detencion?.id
              )
            }
            type="button"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

function CajaModal({
  caja,
  isSaving,
  onClose,
  onSave,
  turnos
}: {
  caja: CajaRetenidaRechazada | null;
  isSaving: boolean;
  onClose: () => void;
  onSave: (input: CajaRetenidaRechazadaInput, id?: number) => Promise<void>;
  turnos: Turno[];
}) {
  const [form, setForm] = useState<CajaFormState>({
    tipo: caja?.tipo ?? "Retenida",
    cantidad: caja ? String(caja.cantidad) : "1",
    producto_id: caja?.producto_id ?? "",
    producto_nombre: caja?.producto_nombre ?? "",
    turno_id: caja ? String(caja.turno_id) : String(turnos[0]?.id ?? "")
  });

  function updateForm(next: Partial<CajaFormState>) {
    setForm({ ...form, ...next });
  }

  const cantidad = Number(form.cantidad);
  const canSave = Boolean(
    form.tipo &&
    form.turno_id &&
    Number.isInteger(cantidad) &&
    cantidad > 0 &&
    form.producto_id.trim() &&
    form.producto_nombre.trim()
  );

  return (
    <div className="app-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-industrial-900/40 px-4 py-6">
      <div className="app-modal-panel max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-panel">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-industrial-900">
              {caja ? "Editar linea de cajas" : "Agregar cajas retenidas/rechazadas"}
            </h3>
            <p className="mt-1 text-sm text-industrial-600">Registra cantidad, producto y turno asociado.</p>
          </div>
          <button className="rounded-md p-2 text-industrial-500 hover:bg-industrial-50" onClick={onClose} type="button">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <SelectInput
            label="Tipo"
            onChange={(tipo) => updateForm({ tipo: tipo as CajaTipo })}
            options={[
              { label: "Retenida", value: "Retenida" },
              { label: "Rechazada", value: "Rechazada" }
            ]}
            value={form.tipo}
          />
          <SelectInput
            label="Turno"
            onChange={(turno_id) => updateForm({ turno_id })}
            options={turnos.map((turno) => ({ label: turno.nombre, value: String(turno.id) }))}
            value={form.turno_id}
          />
          <label className="block text-sm font-medium text-industrial-700">
            Cantidad de cajas
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
              min={1}
              onChange={(event) => updateForm({ cantidad: event.target.value })}
              step={1}
              type="number"
              value={form.cantidad}
            />
          </label>
          <label className="block text-sm font-medium text-industrial-700">
            ID producto
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
              onChange={(event) => updateForm({ producto_id: event.target.value })}
              value={form.producto_id}
            />
          </label>
          <label className="block text-sm font-medium text-industrial-700 sm:col-span-2">
            Nombre producto
            <input
              className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
              onChange={(event) => updateForm({ producto_nombre: event.target.value })}
              value={form.producto_nombre}
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button className="app-secondary-button min-h-11 rounded-md border border-industrial-100 px-4 text-sm font-semibold text-industrial-700" onClick={onClose} type="button">
            Cancelar
          </button>
          <button
            className="app-primary-button min-h-11 rounded-md bg-industrial-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!canSave || isSaving}
            onClick={() =>
              onSave(
                {
                  cantidad,
                  producto_id: form.producto_id.trim(),
                  producto_nombre: form.producto_nombre.trim(),
                  tipo: form.tipo,
                  turno_id: Number(form.turno_id)
                },
                caja?.id
              )
            }
            type="button"
          >
            {isSaving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CajasList({
  cajas,
  onDelete,
  onEdit,
  readOnly
}: {
  cajas: CajaRetenidaRechazada[];
  onDelete: (id: number) => Promise<void>;
  onEdit: (caja: CajaRetenidaRechazada) => void;
  readOnly?: boolean;
}) {
  if (cajas.length === 0) {
    return <p className="mt-5 rounded-md bg-industrial-50 p-4 text-sm text-industrial-600">No hay cajas retenidas o rechazadas registradas.</p>;
  }

  return (
    <div className="mt-5">
      <div className="hidden overflow-hidden rounded-lg border border-industrial-100 md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-industrial-50 text-xs uppercase text-industrial-500">
            <tr>
              {["Tipo", "Cantidad", "ID producto", "Producto", "Turno", ...(readOnly ? [] : ["Acciones"])].map((column) => (
                <th className="px-4 py-3 font-semibold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-industrial-100">
            {cajas.map((caja) => (
              <tr key={caja.id}>
                <td className="px-4 py-3"><CajaTipoPill tipo={caja.tipo} /></td>
                <td className="px-4 py-3 font-semibold text-industrial-900">{caja.cantidad}</td>
                <td className="px-4 py-3 text-industrial-700">{caja.producto_id}</td>
                <td className="px-4 py-3 text-industrial-700">{caja.producto_nombre}</td>
                <td className="px-4 py-3 text-industrial-700">{caja.turno_nombre}</td>
                {!readOnly ? (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <EditButton onClick={() => onEdit(caja)} />
                      <DeleteButton onClick={() => onDelete(caja.id)} />
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {cajas.map((caja) => (
          <article className="rounded-lg border border-industrial-100 bg-white p-4 shadow-sm" key={caja.id}>
            <div className="flex items-start justify-between gap-3">
              <CajaTipoPill tipo={caja.tipo} />
              <p className="text-lg font-semibold text-industrial-900">{caja.cantidad} cajas</p>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <SmallFact label="Turno" value={caja.turno_nombre} />
              <SmallFact label="ID producto" value={caja.producto_id} />
            </div>
            <p className="mt-4 text-sm font-semibold text-industrial-900">Producto</p>
            <p className="mt-1 text-sm text-industrial-700">{caja.producto_nombre}</p>
            {!readOnly ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <EditButton onClick={() => onEdit(caja)} />
                <DeleteButton onClick={() => onDelete(caja.id)} />
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}

function DetencionesList({
  detenciones,
  horarios,
  liveNow,
  onDelete,
  onEdit,
  reporteFecha
}: {
  detenciones: Detencion[];
  horarios: TurnoHorario[];
  liveNow: Date;
  onDelete: (id: number) => Promise<void>;
  onEdit: (detencion: Detencion) => void;
  reporteFecha?: string;
}) {
  if (detenciones.length === 0) {
    return <p className="mt-5 rounded-md bg-industrial-50 p-4 text-sm text-industrial-600">No hay detenciones registradas.</p>;
  }

  return (
    <div className="mt-5">
      <div className="hidden overflow-hidden rounded-lg border border-industrial-100 md:block">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-industrial-50 text-xs uppercase text-industrial-500">
            <tr>
              {["Indicador", "Turno", "Hora inicio", "Hora fin", "Minutos", "Descripcion", "Plan de accion", "Estado", "Acciones"].map((column) => (
                <th className="px-4 py-3 font-semibold" key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-industrial-100">
            {detenciones.map((detencion) => (
              <tr className={isOpenNearShiftEnd(detencion, horarios, liveNow) ? "bg-red-50" : ""} key={detencion.id}>
                <td className="px-4 py-3">
                  <IndicatorPill detencion={detencion} />
                </td>
                <td className="px-4 py-3 text-industrial-700">{detencion.turno_nombre}</td>
                <td className="px-4 py-3 text-industrial-700">{detencion.hora_inicio}</td>
                <td className="px-4 py-3 text-industrial-700">{detencion.hora_fin ?? "-"}</td>
                <td className="px-4 py-3 font-semibold text-industrial-900">{getDetencionLiveMinutes(detencion, reporteFecha, liveNow)}</td>
                <td className="px-4 py-3 text-industrial-700">{detencion.descripcion}</td>
                <td className="px-4 py-3 text-industrial-700">{detencion.plan_accion ?? "-"}</td>
                <td className="px-4 py-3"><DetencionStatus detencion={detencion} nearEnd={isOpenNearShiftEnd(detencion, horarios, liveNow)} /></td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <EditButton onClick={() => onEdit(detencion)} />
                    <DeleteButton onClick={() => onDelete(detencion.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {detenciones.map((detencion) => {
          const nearEnd = isOpenNearShiftEnd(detencion, horarios, liveNow);
          return (
            <article className={`rounded-lg border p-4 shadow-sm ${nearEnd ? "border-red-200 bg-red-50" : "border-industrial-100 bg-white"}`} key={detencion.id}>
              <div className="flex items-start justify-between gap-3">
                <IndicatorPill detencion={detencion} />
                <DetencionStatus detencion={detencion} nearEnd={nearEnd} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <SmallFact label="Turno" value={detencion.turno_nombre} />
                <SmallFact label="Minutos" value={String(getDetencionLiveMinutes(detencion, reporteFecha, liveNow))} />
                <SmallFact label="Inicio" value={detencion.hora_inicio} />
                <SmallFact label="Fin" value={detencion.hora_fin ?? "-"} />
              </div>
              <p className="mt-4 text-sm font-semibold text-industrial-900">Descripcion</p>
              <p className="mt-1 text-sm text-industrial-700">{detencion.descripcion}</p>
              <p className="mt-3 text-sm font-semibold text-industrial-900">Plan de accion</p>
              <p className="mt-1 text-sm text-industrial-700">{detencion.plan_accion ?? "-"}</p>
              <div className="mt-4 flex gap-2">
                <EditButton onClick={() => onEdit(detencion)} />
                <DeleteButton onClick={() => onDelete(detencion.id)} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ConfigurationView({
  configuration,
  isSaving,
  onCreateHorario,
  onCreateIndicador,
  onCreateLinea,
  onCreateTurno,
  onDeactivateHorario,
  onDeactivateIndicador,
  onDeactivateLinea,
  onDeactivateTurno,
  onDownloadBackup,
  onReload,
  onShowInactiveChange,
  onUpdateHorario,
  onUpdateIndicador,
  onUpdateLinea,
  onUpdateTurno,
  showInactive,
  turnosActivos
}: {
  configuration: ConfigurationState | null;
  isSaving: boolean;
  onCreateHorario: (input: TurnoHorarioInput) => Promise<void>;
  onCreateIndicador: (input: IndicadorInput) => Promise<void>;
  onCreateLinea: (input: LineaInput) => Promise<void>;
  onCreateTurno: (input: TurnoInput) => Promise<void>;
  onDeactivateHorario: (id: number) => Promise<void>;
  onDeactivateIndicador: (id: number) => Promise<void>;
  onDeactivateLinea: (id: number) => Promise<void>;
  onDeactivateTurno: (id: number) => Promise<void>;
  onDownloadBackup: () => Promise<void>;
  onReload: () => void;
  onShowInactiveChange: (value: boolean) => void;
  onUpdateHorario: (id: number, input: TurnoHorarioInput) => Promise<void>;
  onUpdateIndicador: (id: number, input: IndicadorInput) => Promise<void>;
  onUpdateLinea: (id: number, input: LineaInput) => Promise<void>;
  onUpdateTurno: (id: number, input: TurnoInput) => Promise<void>;
  showInactive: boolean;
  turnosActivos: Turno[];
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-industrial-100 bg-white p-5 shadow-panel lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-industrial-500">Configuracion</p>
          <h2 className="mt-1 text-xl font-semibold text-industrial-900">Datos maestros operacionales</h2>
          <p className="mt-2 text-sm leading-6 text-industrial-600">
            Los registros se desactivan para conservar historial. Dia de semana usa 1=lunes hasta 7=domingo.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-industrial-100 px-3 text-sm font-medium text-industrial-700">
            <input
              checked={showInactive}
              className="h-4 w-4"
              onChange={(event) => onShowInactiveChange(event.target.checked)}
              type="checkbox"
            />
            Mostrar inactivos
          </label>
          <button className="app-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-industrial-900 px-4 text-sm font-semibold text-white" onClick={onReload} type="button">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Actualizar
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <ConfigPanel title="Respaldo de base de datos">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm leading-6 text-industrial-600">
                Descarga un archivo SQL con la estructura y los datos actuales del sistema. Guardalo en una ubicacion segura antes de cambios importantes o limpieza de pruebas.
              </p>
              <p className="mt-2 text-xs font-semibold uppercase text-industrial-500">
                Incluye lineas, indicadores, turnos, horarios, reportes y detenciones.
              </p>
            </div>
            <button
              className="app-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-industrial-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isSaving}
              onClick={onDownloadBackup}
              type="button"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Descargar respaldo SQL
            </button>
          </div>
        </ConfigPanel>
        <LineasSection
          disabled={isSaving}
          lineas={configuration?.lineas ?? []}
          onCreate={onCreateLinea}
          onDeactivate={onDeactivateLinea}
          onUpdate={onUpdateLinea}
        />
        <IndicadoresSection
          disabled={isSaving}
          indicadores={configuration?.indicadores ?? []}
          onCreate={onCreateIndicador}
          onDeactivate={onDeactivateIndicador}
          onUpdate={onUpdateIndicador}
        />
        <TurnosSection
          disabled={isSaving}
          onCreate={onCreateTurno}
          onDeactivate={onDeactivateTurno}
          onUpdate={onUpdateTurno}
          turnos={configuration?.turnos ?? []}
        />
        <HorariosSection
          disabled={isSaving}
          horarios={configuration?.horarios ?? []}
          onCreate={onCreateHorario}
          onDeactivate={onDeactivateHorario}
          onUpdate={onUpdateHorario}
          turnos={turnosActivos}
        />
      </div>
    </section>
  );
}

function LineasSection({
  disabled,
  lineas,
  onCreate,
  onDeactivate,
  onUpdate
}: {
  disabled: boolean;
  lineas: Linea[];
  onCreate: (input: LineaInput) => Promise<void>;
  onDeactivate: (id: number) => Promise<void>;
  onUpdate: (id: number, input: LineaInput) => Promise<void>;
}) {
  const [form, setForm] = useState<LineaInput>(emptyLinea);
  const [editingId, setEditingId] = useState<number | null>(null);

  const submit = async () => {
    if (!form.nombre.trim()) return;
    if (editingId) {
      await onUpdate(editingId, form);
    } else {
      await onCreate(form);
    }
    setForm(emptyLinea);
    setEditingId(null);
  };

  return (
    <ConfigPanel title="Lineas">
      <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
        <TextInput label="Nombre" onChange={(nombre) => setForm({ ...form, nombre })} value={form.nombre} />
        <ActiveSelect active={form.activa} label="Estado" onChange={(activa) => setForm({ ...form, activa })} />
        <SaveButton disabled={disabled || !form.nombre.trim()} editing={Boolean(editingId)} onClick={submit} />
      </div>
      <RecordsTable columns={["Nombre", "Estado", "Acciones"]}>
        {lineas.map((linea) => (
          <tr className="block border-t border-industrial-100 p-4 md:table-row md:p-0" key={linea.id}>
            <Cell label="Nombre">{linea.nombre}</Cell>
            <Cell label="Estado"><StatusBadge active={Boolean(linea.activa)} /></Cell>
            <ActionCell>
              <EditButton
                onClick={() => {
                  setEditingId(linea.id);
                  setForm({ nombre: linea.nombre, activa: Boolean(linea.activa) });
                }}
              />
              {linea.activa ? (
                <DeactivateButton disabled={disabled} onClick={() => onDeactivate(linea.id)} />
              ) : (
                <ReactivateButton disabled={disabled} onClick={() => onUpdate(linea.id, { nombre: linea.nombre, activa: true })} />
              )}
            </ActionCell>
          </tr>
        ))}
      </RecordsTable>
    </ConfigPanel>
  );
}

function IndicadoresSection({
  disabled,
  indicadores,
  onCreate,
  onDeactivate,
  onUpdate
}: {
  disabled: boolean;
  indicadores: Indicador[];
  onCreate: (input: IndicadorInput) => Promise<void>;
  onDeactivate: (id: number) => Promise<void>;
  onUpdate: (id: number, input: IndicadorInput) => Promise<void>;
}) {
  const [form, setForm] = useState<IndicadorInput>(emptyIndicador);
  const [editingId, setEditingId] = useState<number | null>(null);

  const submit = async () => {
    if (!form.codigo.trim() || !form.nombre.trim() || !form.color.trim() || !Number.isFinite(Number(form.orden))) return;
    if (editingId) {
      await onUpdate(editingId, form);
    } else {
      await onCreate(form);
    }
    setForm(emptyIndicador);
    setEditingId(null);
  };

  return (
    <ConfigPanel title="Indicadores">
      <div className="grid gap-3 md:grid-cols-[0.7fr_1.3fr_0.7fr_0.7fr_auto_auto]">
        <TextInput label="Codigo" onChange={(codigo) => setForm({ ...form, codigo })} value={form.codigo} />
        <TextInput label="Nombre" onChange={(nombre) => setForm({ ...form, nombre })} value={form.nombre} />
        <ColorInput label="Color" onChange={(color) => setForm({ ...form, color })} value={form.color} />
        <NumberInput label="Orden" onChange={(orden) => setForm({ ...form, orden })} value={form.orden} />
        <ActiveSelect active={form.activo} label="Estado" onChange={(activo) => setForm({ ...form, activo })} />
        <SaveButton
          disabled={disabled || !form.codigo.trim() || !form.nombre.trim() || !form.color.trim()}
          editing={Boolean(editingId)}
          onClick={submit}
        />
      </div>
      <RecordsTable columns={["Codigo", "Nombre", "Color", "Orden", "Estado", "Acciones"]}>
        {indicadores.map((indicador) => (
          <tr className="block border-t border-industrial-100 p-4 md:table-row md:p-0" key={indicador.id}>
            <Cell label="Codigo">{indicador.codigo}</Cell>
            <Cell label="Nombre">{indicador.nombre}</Cell>
            <Cell label="Color">
              <span className="inline-flex items-center gap-2">
                <span className="h-4 w-4 rounded-full border border-industrial-100" style={{ backgroundColor: indicador.color }} />
                {indicador.color}
              </span>
            </Cell>
            <Cell label="Orden">{indicador.orden}</Cell>
            <Cell label="Estado"><StatusBadge active={Boolean(indicador.activo)} /></Cell>
            <ActionCell>
              <EditButton
                onClick={() => {
                  setEditingId(indicador.id);
                  setForm({
                    codigo: indicador.codigo,
                    nombre: indicador.nombre,
                    color: indicador.color,
                    orden: indicador.orden,
                    activo: Boolean(indicador.activo)
                  });
                }}
              />
              {indicador.activo ? (
                <DeactivateButton disabled={disabled} onClick={() => onDeactivate(indicador.id)} />
              ) : (
                <ReactivateButton disabled={disabled} onClick={() => onUpdate(indicador.id, { ...indicador, activo: true })} />
              )}
            </ActionCell>
          </tr>
        ))}
      </RecordsTable>
    </ConfigPanel>
  );
}

function TurnosSection({
  disabled,
  onCreate,
  onDeactivate,
  onUpdate,
  turnos
}: {
  disabled: boolean;
  onCreate: (input: TurnoInput) => Promise<void>;
  onDeactivate: (id: number) => Promise<void>;
  onUpdate: (id: number, input: TurnoInput) => Promise<void>;
  turnos: Turno[];
}) {
  const [form, setForm] = useState<TurnoInput>(emptyTurno);
  const [editingId, setEditingId] = useState<number | null>(null);

  const submit = async () => {
    if (!form.codigo.trim() || !form.nombre.trim()) return;
    if (editingId) {
      await onUpdate(editingId, form);
    } else {
      await onCreate(form);
    }
    setForm(emptyTurno);
    setEditingId(null);
  };

  return (
    <ConfigPanel title="Turnos">
      <div className="grid gap-3 md:grid-cols-[0.8fr_1.4fr_auto_auto]">
        <TextInput label="Codigo" onChange={(codigo) => setForm({ ...form, codigo })} value={form.codigo} />
        <TextInput label="Nombre" onChange={(nombre) => setForm({ ...form, nombre })} value={form.nombre} />
        <ActiveSelect active={form.activo} label="Estado" onChange={(activo) => setForm({ ...form, activo })} />
        <SaveButton disabled={disabled || !form.codigo.trim() || !form.nombre.trim()} editing={Boolean(editingId)} onClick={submit} />
      </div>
      <RecordsTable columns={["Codigo", "Nombre", "Estado", "Acciones"]}>
        {turnos.map((turno) => (
          <tr className="block border-t border-industrial-100 p-4 md:table-row md:p-0" key={turno.id}>
            <Cell label="Codigo">{turno.codigo}</Cell>
            <Cell label="Nombre">{turno.nombre}</Cell>
            <Cell label="Estado"><StatusBadge active={Boolean(turno.activo)} /></Cell>
            <ActionCell>
              <EditButton
                onClick={() => {
                  setEditingId(turno.id);
                  setForm({ codigo: turno.codigo, nombre: turno.nombre, activo: Boolean(turno.activo) });
                }}
              />
              {turno.activo ? (
                <DeactivateButton disabled={disabled} onClick={() => onDeactivate(turno.id)} />
              ) : (
                <ReactivateButton disabled={disabled} onClick={() => onUpdate(turno.id, { codigo: turno.codigo, nombre: turno.nombre, activo: true })} />
              )}
            </ActionCell>
          </tr>
        ))}
      </RecordsTable>
    </ConfigPanel>
  );
}

function HorariosSection({
  disabled,
  horarios,
  onCreate,
  onDeactivate,
  onUpdate,
  turnos
}: {
  disabled: boolean;
  horarios: TurnoHorario[];
  onCreate: (input: TurnoHorarioInput) => Promise<void>;
  onDeactivate: (id: number) => Promise<void>;
  onUpdate: (id: number, input: TurnoHorarioInput) => Promise<void>;
  turnos: Turno[];
}) {
  const initialForm = { ...emptyHorario, turno_id: turnos[0]?.id ?? 0 };
  const [form, setForm] = useState<TurnoHorarioInput>(initialForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    if (!form.turno_id && turnos[0]?.id) {
      setForm((current) => ({ ...current, turno_id: turnos[0].id }));
    }
  }, [form.turno_id, turnos]);

  const submit = async () => {
    if (!form.turno_id || !form.dia_semana || !form.hora_inicio || !form.hora_fin) return;
    if (editingId) {
      await onUpdate(editingId, form);
    } else {
      await onCreate(form);
    }
    setForm({ ...emptyHorario, turno_id: turnos[0]?.id ?? 0 });
    setEditingId(null);
  };

  return (
    <ConfigPanel title="Horarios de turnos">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_0.8fr_0.8fr_auto_auto_auto]">
        <SelectInput
          label="Turno"
          onChange={(turno_id) => setForm({ ...form, turno_id: Number(turno_id) })}
          options={turnos.map((turno) => ({ label: turno.nombre, value: String(turno.id) }))}
          value={String(form.turno_id)}
        />
        <SelectInput
          label="Dia"
          onChange={(dia_semana) => setForm({ ...form, dia_semana: Number(dia_semana) })}
          options={[1, 2, 3, 4, 5, 6, 7].map((day) => ({ label: `${day} - ${dayNames.get(day)}`, value: String(day) }))}
          value={String(form.dia_semana)}
        />
        <TimeInput label="Inicio" onChange={(hora_inicio) => setForm({ ...form, hora_inicio })} value={form.hora_inicio} />
        <TimeInput label="Fin" onChange={(hora_fin) => setForm({ ...form, hora_fin })} value={form.hora_fin} />
        <CheckboxInput
          checked={form.cruza_medianoche}
          label="Cruza medianoche"
          onChange={(cruza_medianoche) => setForm({ ...form, cruza_medianoche })}
        />
        <ActiveSelect active={form.activo} label="Estado" onChange={(activo) => setForm({ ...form, activo })} />
        <SaveButton
          disabled={disabled || !form.turno_id || !form.dia_semana || !form.hora_inicio || !form.hora_fin}
          editing={Boolean(editingId)}
          onClick={submit}
        />
      </div>
      <RecordsTable columns={["Turno", "Dia", "Horario", "Cruza", "Estado", "Acciones"]}>
        {horarios.map((horario) => (
          <tr className="block border-t border-industrial-100 p-4 md:table-row md:p-0" key={horario.id}>
            <Cell label="Turno">{horario.turno_nombre}</Cell>
            <Cell label="Dia">{horario.dia_semana} - {dayNames.get(horario.dia_semana)}</Cell>
            <Cell label="Horario">{horario.hora_inicio} a {horario.hora_fin}</Cell>
            <Cell label="Cruza">{horario.cruza_medianoche ? "Si" : "No"}</Cell>
            <Cell label="Estado"><StatusBadge active={Boolean(horario.activo)} /></Cell>
            <ActionCell>
              <EditButton
                onClick={() => {
                  setEditingId(horario.id);
                  setForm({
                    turno_id: horario.turno_id,
                    dia_semana: horario.dia_semana,
                    hora_inicio: horario.hora_inicio,
                    hora_fin: horario.hora_fin,
                    cruza_medianoche: Boolean(horario.cruza_medianoche),
                    activo: Boolean(horario.activo)
                  });
                }}
              />
              {horario.activo ? (
                <DeactivateButton disabled={disabled} onClick={() => onDeactivate(horario.id)} />
              ) : (
                <ReactivateButton
                  disabled={disabled}
                  onClick={() =>
                    onUpdate(horario.id, {
                      turno_id: horario.turno_id,
                      dia_semana: horario.dia_semana,
                      hora_inicio: horario.hora_inicio,
                      hora_fin: horario.hora_fin,
                      cruza_medianoche: Boolean(horario.cruza_medianoche),
                      activo: true
                    })
                  }
                />
              )}
            </ActionCell>
          </tr>
        ))}
      </RecordsTable>
    </ConfigPanel>
  );
}

function StatusBar({
  error,
  isLoading,
  isSaving,
  message
}: {
  error: string | null;
  isLoading: boolean;
  isSaving: boolean;
  message: string | null;
}) {
  if (!error && !message && !isLoading && !isSaving) return null;

  return (
    <div className="border-b border-industrial-100 bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3 text-sm sm:px-6 lg:px-8">
        {error ? (
          <>
            <XCircle className="h-4 w-4 text-red-600" aria-hidden="true" />
            <span className="whitespace-pre-line font-medium text-red-700">{error}</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            <span className="whitespace-pre-line font-medium text-emerald-700">{message ?? (isLoading ? "Cargando datos..." : "Guardando...")}</span>
          </>
        )}
      </div>
    </div>
  );
}

function ConfigPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <article className="rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-semibold text-industrial-900">{title}</h3>
      <div className="mt-5 space-y-5">{children}</div>
    </article>
  );
}

function RecordsTable({ children, columns }: { children: ReactNode; columns: string[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-industrial-100">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="hidden bg-industrial-50 text-xs uppercase text-industrial-500 md:table-header-group">
          <tr>
            {columns.map((column) => (
              <th className="px-4 py-3 font-semibold" key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody className="block divide-y divide-industrial-100 md:table-row-group">{children}</tbody>
      </table>
    </div>
  );
}

function Cell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <td className="flex justify-between gap-4 py-2 text-industrial-700 md:table-cell md:px-4 md:py-3">
      <span className="font-semibold text-industrial-500 md:hidden">{label}</span>
      <span>{children}</span>
    </td>
  );
}

function ActionCell({ children }: { children: ReactNode }) {
  return <td className="flex justify-end gap-2 py-2 md:px-4 md:py-3">{children}</td>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-industrial-100 bg-white p-4 text-center shadow-sm">
      <p className="text-2xl font-bold text-industrial-900">{value}</p>
      <p className="mt-1 text-xs font-semibold uppercase text-industrial-500">{label}</p>
    </div>
  );
}

function DataPanel({ children, title }: { children: ReactNode; title: string }) {
  return (
    <article className="min-h-64 rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-industrial-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function SimpleRow({ label }: { label: string }) {
  return <p className="border-b border-industrial-100 py-3 text-sm font-medium text-industrial-700 last:border-b-0">{label}</p>;
}

function TextInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block text-sm font-medium text-industrial-700">
      {label}
      <input
        className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

function NumberInput({ label, onChange, value }: { label: string; onChange: (value: number) => void; value: number }) {
  return (
    <label className="block text-sm font-medium text-industrial-700">
      {label}
      <input
        className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
        min="0"
        onChange={(event) => onChange(Number(event.target.value))}
        type="number"
        value={value}
      />
    </label>
  );
}

function ColorInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block text-sm font-medium text-industrial-700">
      {label}
      <input
        className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-2 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
        onChange={(event) => onChange(event.target.value)}
        type="color"
        value={value}
      />
    </label>
  );
}

function TimeInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block text-sm font-medium text-industrial-700">
      {label}
      <input
        className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
        onChange={(event) => onChange(event.target.value)}
        type="time"
        value={value}
      />
    </label>
  );
}

function DateInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block text-sm font-medium text-industrial-700">
      {label}
      <input
        className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  );
}

function SelectInput({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange: (value: string) => void;
  options: Array<{ label: string; value: string }>;
  value: string;
}) {
  return (
    <label className="block text-sm font-medium text-industrial-700">
      {label}
      <select
        className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        <option value="0">Seleccionar</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function ActiveSelect({ active, label, onChange }: { active: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="block text-sm font-medium text-industrial-700">
      {label}
      <select
        className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
        onChange={(event) => onChange(event.target.value === "true")}
        value={String(active)}
      >
        <option value="true">Activo</option>
        <option value="false">Inactivo</option>
      </select>
    </label>
  );
}

function CheckboxInput({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2 rounded-md border border-industrial-100 px-3 text-sm font-medium text-industrial-700">
      <input checked={checked} className="h-4 w-4" onChange={(event) => onChange(event.target.checked)} type="checkbox" />
      {label}
    </label>
  );
}

function SaveButton({ disabled, editing, onClick }: { disabled: boolean; editing: boolean; onClick: () => void }) {
  return (
    <button
      className="app-primary-button inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-industrial-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {editing ? <Save className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
      {editing ? "Guardar" : "Agregar"}
    </button>
  );
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="app-secondary-button inline-flex min-h-10 items-center gap-2 rounded-md border border-industrial-100 px-3 text-sm font-semibold text-industrial-700" onClick={onClick} type="button">
      <Edit3 className="h-4 w-4" aria-hidden="true" />
      Editar
    </button>
  );
}

function DeactivateButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-red-100 px-3 text-sm font-semibold text-red-700 disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <X className="h-4 w-4" aria-hidden="true" />
      Desactivar
    </button>
  );
}

function ReactivateButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) {
  return (
    <button
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-emerald-100 px-3 text-sm font-semibold text-emerald-700 disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      Reactivar
    </button>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="app-secondary-button inline-flex min-h-10 items-center gap-2 rounded-md border border-red-100 px-3 text-sm font-semibold text-red-700" onClick={onClick} type="button">
      <Trash2 className="h-4 w-4" aria-hidden="true" />
      Eliminar
    </button>
  );
}

function DownloadPdfButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="app-secondary-button inline-flex min-h-10 items-center gap-2 rounded-md border border-industrial-100 px-3 text-sm font-semibold text-industrial-700"
      onClick={onClick}
      type="button"
    >
      <Download className="h-4 w-4" aria-hidden="true" />
      Descargar PDF
    </button>
  );
}

function ViewInformeButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="app-primary-button inline-flex min-h-10 items-center gap-2 rounded-md bg-industrial-900 px-3 text-sm font-semibold text-white"
      onClick={onClick}
      type="button"
    >
      <ClipboardList className="h-4 w-4" aria-hidden="true" />
      Ver informe
    </button>
  );
}

function IndicatorPill({ detencion }: { detencion: Detencion }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold text-industrial-900" style={{ backgroundColor: detencion.indicador_color }}>
      {detencion.indicador_codigo} - {detencion.indicador_nombre}
    </span>
  );
}

function CajaTipoPill({ tipo }: { tipo: CajaTipo }) {
  const className = tipo === "Rechazada"
    ? "bg-red-50 text-red-700"
    : "bg-amber-50 text-amber-700";

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${className}`}>
      {tipo}
    </span>
  );
}

function DetencionStatus({ detencion, nearEnd }: { detencion: Detencion; nearEnd: boolean }) {
  if (nearEnd) {
    return <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Abierta cerca de fin de turno</span>;
  }

  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${detencion.estado_calculado === "abierta" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
      {detencion.estado_calculado === "abierta" ? "Abierta" : "Cerrada"}
    </span>
  );
}

function SmallFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-industrial-50 p-3">
      <p className="text-xs font-semibold uppercase text-industrial-500">{label}</p>
      <p className="mt-1 font-semibold text-industrial-900">{value}</p>
    </div>
  );
}

function ResumenBreakdownPanel({
  items,
  renderName,
  title
}: {
  items: Array<{ id: number; codigo: string; nombre: string; color?: string; minutos: number }>;
  renderName: (item: { id: number; codigo: string; nombre: string; color?: string; minutos: number }) => string;
  title: string;
}) {
  return (
    <article className="rounded-lg border border-industrial-100 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-industrial-900">{title}</h3>
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <div className="flex items-center justify-between gap-4 rounded-md bg-industrial-50 p-3" key={item.id}>
            <div className="flex items-center gap-3">
              {item.color ? <span className="h-4 w-4 rounded-full border border-industrial-100" style={{ backgroundColor: item.color }} /> : null}
              <p className="text-sm font-semibold text-industrial-900">{renderName(item)}</p>
            </div>
            <p className="text-sm font-bold text-industrial-900">{item.minutos} min</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function NumericTextInput({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block text-sm font-medium text-industrial-700">
      {label}
      <input
        className="mt-1 min-h-11 w-full rounded-md border border-industrial-100 px-3 text-sm outline-none focus:border-industrial-500 focus:ring-2 focus:ring-industrial-100"
        inputMode="decimal"
        min="0"
        onChange={(event) => onChange(normalizeDecimalInput(event.target.value))}
        pattern="[0-9]*[.]?[0-9]*"
        type="text"
        value={value}
      />
    </label>
  );
}

function SummaryCard({ emphasis = false, label, value }: { emphasis?: boolean; label: string; value: string }) {
  return (
    <div className={`rounded-lg border p-4 shadow-sm ${emphasis ? "app-summary-emphasis border-industrial-900 bg-industrial-900 text-white" : "border-industrial-100 bg-white"}`}>
      <p className={`text-xs font-semibold uppercase ${emphasis ? "text-industrial-100" : "text-industrial-500"}`}>{label}</p>
      <p className={`mt-2 text-lg font-bold ${emphasis ? "text-white" : "text-industrial-900"}`}>{value}</p>
    </div>
  );
}

function reporteToForm(reporte: Reporte): ReporteFormState {
  return {
    fecha_reporte: reporte.fecha_reporte,
    linea_id: String(reporte.linea_id),
    opinona_planificada: valueToFormString(reporte.opinona_planificada),
    opinona_real: valueToFormString(reporte.opinona_real),
    producciones_programadas: valueToFormString(reporte.producciones_programadas),
    producciones_realizadas: valueToFormString(reporte.producciones_realizadas),
    tipo_atraso_adelanto: reporte.tipo_atraso_adelanto,
    minutos_atraso_adelanto: valueToFormString(reporte.minutos_atraso_adelanto),
    observacion_general: reporte.observacion_general ?? "",
    imagen_reporte_data: reporte.imagen_reporte_data ?? "",
    imagen_reporte_mime: reporte.imagen_reporte_mime ?? "",
    imagen_reporte_nombre: reporte.imagen_reporte_nombre ?? ""
  };
}

function validateReporteGeneralFields(form: ReporteFormState) {
  const missing: string[] = [];

  if (!form.fecha_reporte) missing.push("Fecha del reporte");
  if (!form.linea_id) missing.push("Linea seleccionada");
  if (!form.opinona_planificada.trim()) missing.push("OPINONA planificada");
  if (!form.opinona_real.trim()) missing.push("OPINONA real");
  if (!form.producciones_programadas.trim()) missing.push("Producciones programadas");
  if (!form.producciones_realizadas.trim()) missing.push("Producciones realizadas");
  if (!form.tipo_atraso_adelanto) missing.push("Tipo atraso/adelanto");
  if (!form.minutos_atraso_adelanto.trim()) missing.push("Minutos atraso/adelanto");
  if (!form.observacion_general.trim()) missing.push("Observacion general");
  if (!form.imagen_reporte_data) missing.push("Captura OPINONA JPG/PNG");

  return missing;
}

function reporteToPayload(form: ReporteFormState): ReporteUpdateInput {
  return {
    fecha_reporte: form.fecha_reporte || undefined,
    linea_id: form.linea_id ? Number(form.linea_id) : undefined,
    opinona_planificada: parseDecimalFormValue(form.opinona_planificada),
    opinona_real: parseDecimalFormValue(form.opinona_real),
    producciones_programadas: parseDecimalFormValue(form.producciones_programadas),
    producciones_realizadas: parseDecimalFormValue(form.producciones_realizadas),
    tipo_atraso_adelanto: form.tipo_atraso_adelanto,
    minutos_atraso_adelanto: parseDecimalFormValue(form.minutos_atraso_adelanto) ?? 0,
    observacion_general: form.observacion_general.trim() ? form.observacion_general : null,
    imagen_reporte_data: form.imagen_reporte_data || null,
    imagen_reporte_mime: form.imagen_reporte_mime || null,
    imagen_reporte_nombre: form.imagen_reporte_nombre || null
  };
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No fue posible leer la imagen seleccionada."));
    reader.readAsDataURL(file);
  });
}

function valueToFormString(value: number | string | null) {
  return value === null || typeof value === "undefined" ? "" : String(value);
}

function normalizeDecimalInput(value: string) {
  const normalized = value.replace(/,/g, ".");
  let result = "";
  let hasDecimalSeparator = false;

  for (const character of normalized) {
    if (character >= "0" && character <= "9") {
      result += character;
      continue;
    }
    if (character === "." && !hasDecimalSeparator) {
      result += result ? "." : "0.";
      hasDecimalSeparator = true;
    }
  }

  return result;
}

function parseDecimalFormValue(value: string) {
  const normalized = normalizeDecimalInput(value);
  if (!normalized || normalized === "0.") return normalized === "0." ? 0 : null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function dateInputValue(date: Date) {
  return `${date.getFullYear()}-${padTimePart(date.getMonth() + 1)}-${padTimePart(date.getDate())}`;
}

function defaultDashboardFilters(): DashboardFilters {
  const today = dateInputValue(new Date());
  return { fecha_inicio: today, fecha_fin: today };
}

function currentWeekFilters(): DashboardFilters {
  const today = new Date();
  const isoDay = getIsoDay(today);
  const start = new Date(today);
  start.setDate(today.getDate() - isoDay + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return {
    fecha_inicio: dateInputValue(start),
    fecha_fin: dateInputValue(end)
  };
}

function emptyDashboard(): DashboardResumen {
  return {
    total_minutos: 0,
    total_detenciones: 0,
    cumplimiento_promedio_o_calculado: null,
    opinona_planificada_promedio: null,
    opinona_real_promedio: null,
    producciones_programadas_total: 0,
    producciones_realizadas_total: 0,
    minutos_por_indicador: [],
    minutos_por_turno: [],
    ranking_detenciones_largas: []
  };
}

function calculateCumplimiento(programadas: string, realizadas: string) {
  const planned = parseDecimalFormValue(programadas);
  const done = parseDecimalFormValue(realizadas);
  if (planned === null || done === null || !Number.isFinite(planned) || planned <= 0 || !Number.isFinite(done)) return "Pendiente";
  return `${((done / planned) * 100).toFixed(1)}%`;
}

function formatPercentValue(value: string) {
  return value ? `${value}%` : "Pendiente";
}

function formatValueWithFallback(value: number | null, suffix = "") {
  return value === null || typeof value === "undefined" ? "Pendiente" : `${value}${suffix}`;
}

function formatNullableNumber(value: number | null) {
  return value === null || typeof value === "undefined" ? "Pendiente" : String(value);
}

function selectedLineaName(lineas: Linea[], lineaId: string) {
  return lineas.find((linea) => String(linea.id) === lineaId)?.nombre ?? "Pendiente";
}

function saveStatusText(status: "idle" | "saving" | "saved" | "error") {
  if (status === "saving") return "Guardando...";
  if (status === "saved") return "Guardado correctamente";
  if (status === "error") return "Error al guardar";
  return "Sin cambios";
}

function buildLiveSummary(
  detenciones: Detencion[],
  reporteFecha: string | undefined,
  liveNow: Date,
  configuration: ConfigurationState | null,
  backendResumen: ReporteResumen | null
) {
  const indicadorBase = backendResumen?.total_por_indicador ??
    (configuration?.indicadores ?? []).map((indicador) => ({
      id: indicador.id,
      codigo: indicador.codigo,
      nombre: indicador.nombre,
      color: indicador.color,
      minutos: 0
    }));
  const turnoBase = backendResumen?.total_por_turno ??
    (configuration?.turnos ?? []).map((turno) => ({
      id: turno.id,
      codigo: turno.codigo,
      nombre: turno.nombre,
      minutos: 0
    }));

  const porIndicador = new Map(indicadorBase.map((item) => [item.id, { ...item, minutos: 0 }]));
  const porTurno = new Map(turnoBase.map((item) => [item.id, { ...item, minutos: 0 }]));
  let totalMinutos = 0;
  let abiertas = 0;

  for (const detencion of detenciones) {
    const minutos = getDetencionLiveMinutes(detencion, reporteFecha, liveNow);
    totalMinutos += minutos;
    if (detencion.estado_calculado === "abierta") abiertas += 1;

    const indicador = porIndicador.get(detencion.indicador_id) ?? {
      id: detencion.indicador_id,
      codigo: detencion.indicador_codigo,
      nombre: detencion.indicador_nombre,
      color: detencion.indicador_color,
      minutos: 0
    };
    indicador.minutos += minutos;
    porIndicador.set(detencion.indicador_id, indicador);

    const minutosPorTurno = splitDetencionMinutesByTurno(detencion, reporteFecha, liveNow, configuration?.horarios ?? []);
    if (minutosPorTurno.size === 0) {
      const turno = porTurno.get(detencion.turno_id) ?? {
        id: detencion.turno_id,
        codigo: detencion.turno_codigo,
        nombre: detencion.turno_nombre,
        minutos: 0
      };
      turno.minutos += minutos;
      porTurno.set(detencion.turno_id, turno);
    } else {
      for (const [turnoId, turnoMinutos] of minutosPorTurno) {
        const turno = porTurno.get(turnoId);
        if (turno) {
          turno.minutos += turnoMinutos;
          porTurno.set(turnoId, turno);
        }
      }
    }
  }

  return {
    totalMinutos,
    totalDetenciones: detenciones.length,
    detencionesAbiertas: abiertas,
    porIndicador: Array.from(porIndicador.values()).sort((a, b) => b.minutos - a.minutos || a.codigo.localeCompare(b.codigo)),
    porTurno: Array.from(porTurno.values())
  };
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function timeToMinutes(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function getIsoDay(date: Date) {
  const day = date.getDay();
  return day === 0 ? 7 : day;
}

function previousIsoDay(day: number) {
  return day === 1 ? 7 : day - 1;
}

function nextDate(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + 1);
  return copy;
}

function previousDate(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - 1);
  return copy;
}

function currentTimeValue() {
  const now = new Date();
  return `${padTimePart(now.getHours())}:${padTimePart(now.getMinutes())}`;
}

function padTimePart(value: number) {
  return String(value).padStart(2, "0");
}

function buildDateTimeFromReport(fechaReporte: string, time: string) {
  const [year, month, day] = fechaReporte.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function getDetencionLiveMinutes(detencion: Detencion, reporteFecha: string | undefined, liveNow: Date) {
  const interval = getDetencionInterval(detencion, reporteFecha, liveNow);
  if (!interval) return detencion.minutos_calculados;
  return minutesBetween(interval.start, interval.end);
}

function getDetencionInterval(detencion: Detencion, reporteFecha: string | undefined, liveNow: Date) {
  if (!reporteFecha) return null;

  let start = buildDateTimeFromReport(reporteFecha, detencion.hora_inicio);
  if (detencion.estado_calculado === "abierta" && start.getTime() > liveNow.getTime()) {
    start = previousDate(start);
  }

  if (!detencion.hora_fin) {
    return { start, end: liveNow };
  }

  let end = buildDateTimeFromReport(reporteFecha, detencion.hora_fin);
  if (end.getTime() < start.getTime()) {
    end = nextDate(end);
  }
  return { start, end };
}

function splitDetencionMinutesByTurno(detencion: Detencion, reporteFecha: string | undefined, liveNow: Date, horarios: TurnoHorario[]) {
  const interval = getDetencionInterval(detencion, reporteFecha, liveNow);
  const result = new Map<number, number>();
  if (!interval || interval.end.getTime() <= interval.start.getTime()) return result;

  const cursor = new Date(interval.start);
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - 1);

  for (let dayOffset = 0; dayOffset < 4; dayOffset += 1) {
    const currentDate = new Date(cursor);
    currentDate.setDate(cursor.getDate() + dayOffset);
    const isoDay = getIsoDay(currentDate);

    for (const horario of horarios) {
      if (!horario.activo || horario.dia_semana !== isoDay) continue;
      const shiftStart = buildDateTimeFromReport(dateInputValue(currentDate), horario.hora_inicio);
      let shiftEnd = buildDateTimeFromReport(dateInputValue(currentDate), horario.hora_fin);
      if (horario.cruza_medianoche || shiftEnd.getTime() <= shiftStart.getTime()) {
        shiftEnd = nextDate(shiftEnd);
      }

      const overlapStart = new Date(Math.max(interval.start.getTime(), shiftStart.getTime()));
      const overlapEnd = new Date(Math.min(interval.end.getTime(), shiftEnd.getTime()));
      const minutes = minutesBetween(overlapStart, overlapEnd);
      if (minutes > 0) {
        result.set(horario.turno_id, (result.get(horario.turno_id) ?? 0) + minutes);
      }
    }
  }

  return result;
}

function getTurnoForReportTime(horarios: TurnoHorario[], fechaReporte: string, horaInicio: string) {
  if (!horaInicio) return undefined;
  const reportDate = buildDateTimeFromReport(fechaReporte, horaInicio);
  const day = getIsoDay(reportDate);
  const currentMinutes = timeToMinutes(horaInicio);

  return horarios.find((horario) => {
    if (!horario.activo) return false;
    const start = timeToMinutes(horario.hora_inicio);
    const end = timeToMinutes(horario.hora_fin);

    if (horario.cruza_medianoche) {
      return (
        (horario.dia_semana === day && currentMinutes >= start) ||
        (horario.dia_semana === previousIsoDay(day) && currentMinutes < end)
      );
    }

    return horario.dia_semana === day && currentMinutes >= start && currentMinutes < end;
  });
}

function getCurrentHorarioForTurno(horarios: TurnoHorario[], turnoId: number, now: Date) {
  const today = getIsoDay(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return horarios.find((horario) => {
    if (!horario.activo || horario.turno_id !== turnoId) return false;
    const start = timeToMinutes(horario.hora_inicio);
    const end = timeToMinutes(horario.hora_fin);

    if (horario.cruza_medianoche) {
      return (
        (horario.dia_semana === today && currentMinutes >= start) ||
        (horario.dia_semana === previousIsoDay(today) && currentMinutes < end)
      );
    }

    return horario.dia_semana === today && currentMinutes >= start && currentMinutes < end;
  });
}

function getShiftEndDate(horario: TurnoHorario, now: Date) {
  const [endHour, endMinute] = horario.hora_fin.split(":").map(Number);
  const endDate = new Date(now);
  endDate.setHours(endHour, endMinute, 0, 0);

  if (horario.cruza_medianoche && now.getHours() * 60 + now.getMinutes() >= timeToMinutes(horario.hora_inicio)) {
    endDate.setDate(endDate.getDate() + 1);
  }

  return endDate;
}

function isOpenNearShiftEnd(detencion: Detencion, horarios: TurnoHorario[], liveNow: Date) {
  if (detencion.estado_calculado !== "abierta") return false;
  const horario = getCurrentHorarioForTurno(horarios, detencion.turno_id, liveNow);
  if (!horario) return false;
  const minutesToEnd = minutesBetween(liveNow, getShiftEndDate(horario, liveNow));
  return minutesToEnd <= 50;
}

function getTurnoActual(horarios: TurnoHorario[]) {
  const now = new Date();
  const today = getIsoDay(now);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return horarios.find((horario) => {
    if (!horario.activo) return false;

    const start = timeToMinutes(horario.hora_inicio);
    const end = timeToMinutes(horario.hora_fin);

    if (horario.cruza_medianoche) {
      return (
        (horario.dia_semana === today && currentMinutes >= start) ||
        (horario.dia_semana === previousIsoDay(today) && currentMinutes < end)
      );
    }

    return horario.dia_semana === today && currentMinutes >= start && currentMinutes < end;
  });
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

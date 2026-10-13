"use client";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import {
  BookOpen,
  LayoutGrid,
  List,
  CalendarDays,
  Plus,
  Trash2,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { Button, buttonVariants } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { EmotionalCalendar } from "./calendar";
import { listEntries, calendarDays, deleteEntries } from "./actions";
import { journalTimezone } from "./evolution-actions";
import {
  moods,
  emotions,
  intensities,
  reasonGroups,
  categoryLabel,
  type Emotion,
  type Category,
} from "./emotions";
import { browserTimezone, localDay, displayDate, monthRange } from "./dates";
import type { JournalPage, JournalDay, JournalQuery } from "./types";
const empty: JournalPage = { entries: [], total: 0, page: 1, page_size: 12 };
const initialFilters = {
  from: "",
  to: "",
  emotion: "",
  intensity: "",
  category: "",
  order: "desc",
};

export function JournalHistory({
  initialFrom = "",
  initialTo = "",
}: {
  initialFrom?: string;
  initialTo?: string;
}) {
  const [view, setView] = useState("cards");
  const [timezone, setTimezone] = useState("");
  const [today, setToday] = useState("");
  const [month, setMonth] = useState("");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [draft, setDraft] = useState({
    ...initialFilters,
    from: initialFrom,
    to: initialTo,
  });
  const [filters, setFilters] = useState({
    ...initialFilters,
    from: initialFrom,
    to: initialTo,
  });
  const [page, setPage] = useState(1);
  const [result, setResult] = useState(empty);
  const [days, setDays] = useState<JournalDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [error, setError] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmation, setConfirmation] = useState<string[] | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const busy = useRef(false);
  useEffect(() => {
    let current = true;
    async function initialize() {
      try {
        const result = await journalTimezone(browserTimezone());
        if (!current) return;
        if (!result.ok) { setError(result.message); setLoading(false); return; }
        const now = localDay(new Date(), result.data);
        setTimezone(result.data); setToday(now); setMonth(previous => previous || now.slice(0, 7));
      } catch { if (current) { setError("No se ha podido consultar tu zona horaria."); setLoading(false); } }
    }
    void initialize();
    return () => { current = false; };
  }, [revision]);
  const calendarQuery = useMemo<JournalQuery>(() => {
    const range = month ? monthRange(month) : { from: "", to: "" };
    return {
      timezone,
      page: 1,
      order: "desc",
      emotion: (filters.emotion || null) as Emotion | null,
      intensity: filters.intensity ? Number(filters.intensity) : null,
      category: (filters.category || null) as Category | null,
      from:
        filters.from && filters.from > range.from ? filters.from : range.from,
      to: filters.to && filters.to < range.to ? filters.to : range.to,
    };
  }, [month, timezone, filters]);
  const query = useMemo<JournalQuery>(
    () => ({
      ...calendarQuery,
      page,
      order: filters.order as "asc" | "desc",
      from:
        view === "calendar"
          ? (selectedDay ?? calendarQuery.from)
          : filters.from || null,
      to:
        view === "calendar"
          ? (selectedDay ?? calendarQuery.to)
          : filters.to || null,
    }),
    [calendarQuery, page, filters, selectedDay, view],
  );
  const outsidePeriod =
    view === "calendar" &&
    (Boolean(query.from && query.to && query.from > query.to) ||
      Boolean(
        selectedDay &&
          ((filters.from && selectedDay < filters.from) ||
            (filters.to && selectedDay > filters.to)),
      ));
  useEffect(() => {
    if (!timezone || !month) return;
    let current = true;
    async function load() {
      setLoading(true);
      setError("");
      setSelected([]);
      try {
        const response = outsidePeriod
          ? { ok: true as const, data: { ...empty, page } }
          : await listEntries(query);
        if (!current) return;
        if (response.ok) {
          const last = Math.max(1, Math.ceil(response.data.total / 12));
          if (page > last) {
            setPage(last);
            return;
          }
          setResult(response.data);
        } else {
          setResult(empty);
          setError(response.message);
        }
      } catch {
        if (current) {
          setResult(empty);
          setError(
            "No se ha podido consultar el historial. Vuelve a intentarlo.",
          );
        }
      } finally {
        if (current) setLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [query, timezone, month, page, revision, outsidePeriod]);
  useEffect(() => {
    if (view !== "calendar" || !timezone || !month) return;
    let current = true;
    async function load() {
      setCalendarLoading(true);
      setCalendarError("");
      setDays([]);
      try {
        const response =
          calendarQuery.from! > calendarQuery.to!
            ? { ok: true as const, data: [] }
            : await calendarDays(calendarQuery);
        if (!current) return;
        if (response.ok) setDays(response.data);
        else setCalendarError(response.message);
      } catch {
        if (current)
          setCalendarError("No se ha podido consultar el calendario.");
      } finally {
        if (current) setCalendarLoading(false);
      }
    }
    void load();
    return () => {
      current = false;
    };
  }, [view, timezone, month, calendarQuery, revision]);
  function apply(event: FormEvent) {
    event.preventDefault();
    setFilters(draft);
    setPage(1);
    setSelectedDay(null);
    setConfirmation(null);
    setNotice("");
  }
  function select(id: string, value: boolean) {
    setSelected((ids) => (value ? [...ids, id] : ids.filter((i) => i !== id)));
  }
  async function remove() {
    if (!confirmation || busy.current) return;
    busy.current = true;
    setDeleting(true);
    setError("");
    try {
      const response = await deleteEntries(confirmation);
      if (response.ok) {
        setConfirmation(null);
        setSelected([]);
        setNotice(
          `${response.data} ${response.data === 1 ? "entrada eliminada" : "entradas eliminadas"}.`,
        );
        setRevision((v) => v + 1);
      } else setError(response.message);
    } catch {
      setError("No se ha podido eliminar. Puedes reintentarlo.");
    } finally {
      busy.current = false;
      setDeleting(false);
    }
  }
  const locked = loading || deleting;
  const pages = Math.max(1, Math.ceil(result.total / 12));
  return (
    <>
      <PageHeading
        title="Mi diario"
        description="Un lugar para escuchar cómo te sientes."
        action={
          <Link href="/journal/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            Registrar emoción
          </Link>
        }
      />
      <form className="surface journal-filters" onSubmit={apply}>
        <FieldGroup className="journal-filter-grid">
          <Field>
            <FieldLabel htmlFor="filter-from">Desde</FieldLabel>
            <Input
              id="filter-from"
              type="date"
              value={draft.from}
              onChange={(e) => setDraft({ ...draft, from: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="filter-to">Hasta</FieldLabel>
            <Input
              id="filter-to"
              type="date"
              value={draft.to}
              onChange={(e) => setDraft({ ...draft, to: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="filter-emotion">Emoción</FieldLabel>
            <NativeSelect
              id="filter-emotion"
              value={draft.emotion}
              onChange={(e) => setDraft({ ...draft, emotion: e.target.value })}
            >
              <NativeSelectOption value="">Todas</NativeSelectOption>
              {emotions.map((e) => (
                <NativeSelectOption key={e.value} value={e.value}>
                  {e.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="filter-intensity">Intensidad</FieldLabel>
            <NativeSelect
              id="filter-intensity"
              value={draft.intensity}
              onChange={(e) =>
                setDraft({ ...draft, intensity: e.target.value })
              }
            >
              <NativeSelectOption value="">Todas</NativeSelectOption>
              {intensities.map((i, n) => (
                <NativeSelectOption key={i} value={n + 1}>
                  {i}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="filter-category">Categoría</FieldLabel>
            <NativeSelect
              id="filter-category"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            >
              <NativeSelectOption value="">Todas</NativeSelectOption>
              {reasonGroups.map((g) => (
                <NativeSelectOption key={g.value} value={g.value}>
                  {g.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="filter-order">Orden</FieldLabel>
            <NativeSelect
              id="filter-order"
              value={draft.order}
              onChange={(e) => setDraft({ ...draft, order: e.target.value })}
            >
              <NativeSelectOption value="desc">
                Más recientes
              </NativeSelectOption>
              <NativeSelectOption value="asc">Más antiguos</NativeSelectOption>
            </NativeSelect>
          </Field>
        </FieldGroup>
        <div className="form-actions">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setDraft(initialFilters);
              setFilters(initialFilters);
              setPage(1);
              setSelectedDay(null);
              setConfirmation(null);
            }}
          >
            Limpiar filtros
          </Button>
          <Button type="submit">Aplicar filtros</Button>
        </div>
      </form>
      <div className="view-toolbar">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {loading ? "Consultando tu diario…" : `${result.total} registros`}{" "}
          {timezone ? `· ${timezone}` : ""}
        </p>
        <ToggleGroup
          value={[view]}
          onValueChange={(v) => {
            if (v[0]) {
              setView(v[0]);
              setPage(1);
              setConfirmation(null);
            }
          }}
          aria-label="Vista del diario"
        >
          <ToggleGroupItem value="cards">
            <LayoutGrid aria-hidden="true" />
            Tarjetas
          </ToggleGroupItem>
          <ToggleGroupItem value="table">
            <List aria-hidden="true" />
            Tabla
          </ToggleGroupItem>
          <ToggleGroupItem value="calendar">
            <CalendarDays aria-hidden="true" />
            Calendario
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      {notice ? (
        <Alert role="status">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      ) : null}
      {error || calendarError ? (
        <Alert variant="destructive" role="alert">
          <AlertDescription>
            {error || calendarError}
            <Button variant="outline" onClick={() => setRevision((v) => v + 1)}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}
      {view === "calendar" && month ? (
        <>
          <EmotionalCalendar
            today={today}
            month={month}
            days={days}
            loading={calendarLoading}
            selectedDay={selectedDay}
            onMonth={(m) => {
              setMonth(m);
              setSelectedDay(null);
              setPage(1);
              setConfirmation(null);
            }}
            onDay={(d) => {
              setSelectedDay(d);
              setPage(1);
              setConfirmation(null);
            }}
          />
          <div className="view-toolbar">
            <h2>
              {selectedDay
                ? `Entradas del ${selectedDay.split("-").reverse().join("/")}`
                : "Entradas de este mes"}
            </h2>
            {selectedDay ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedDay(null);
                  setPage(1);
                }}
              >
                Ver todo el mes
              </Button>
            ) : null}
          </div>
        </>
      ) : null}
      {confirmation ? (
        <Alert
          role="alertdialog"
          aria-labelledby="delete-title"
          aria-describedby="delete-description"
        >
          <AlertDescription>
            <strong id="delete-title">
              Eliminar {confirmation.length}{" "}
              {confirmation.length === 1 ? "entrada" : "entradas"}
            </strong>
            <p id="delete-description">Esta acción no se puede deshacer.</p>
            <div className="form-actions">
              <Button
                variant="outline"
                disabled={deleting}
                onClick={() => setConfirmation(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={remove}
              >
                {deleting ? "Eliminando…" : "Confirmar eliminación"}
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      ) : null}
      <section
        aria-label={
          view === "table" ? "Historial en tabla" : "Historial en tarjetas"
        }
        aria-busy={loading}
      >
        {!loading && !error && result.entries.length === 0 ? (
          <div className="surface">
            <EmptyState
              icon={BookOpen}
              title="Tu historia empieza aquí"
              description="No hay entradas para este período y estos filtros. Solo tú puedes consultar tu diario."
            >
              <Link
                href="/journal/new"
                className={buttonVariants({ variant: "outline" })}
              >
                Registrar emoción
              </Link>
            </EmptyState>
          </div>
        ) : null}
        {result.entries.length > 0 ? (
          <>
            <div className="view-toolbar journal-selection">
              <label>
                <input
                  type="checkbox"
                  disabled={locked}
                  checked={selected.length === result.entries.length}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked ? result.entries.map((i) => i.id) : [],
                    )
                  }
                />{" "}
                Seleccionar esta página
              </label>
              <Button
                variant="outline"
                disabled={!selected.length || locked}
                onClick={() => setConfirmation([...selected])}
              >
                <Trash2 data-icon="inline-start" />
                Eliminar seleccionadas ({selected.length})
              </Button>
            </div>
            {view === "table" ? (
              <div className="table-surface">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Selección</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Ánimo / emoción</TableHead>
                      <TableHead>Intensidad</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.entries.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            aria-label={`Seleccionar entrada del ${displayDate(e.occurred_at, timezone)}`}
                            disabled={locked}
                            checked={selected.includes(e.id)}
                            onChange={(v) => select(e.id, v.target.checked)}
                          />
                        </TableCell>
                        <TableCell>
                          {displayDate(e.occurred_at, timezone)}
                        </TableCell>
                        <TableCell>
                          {moods.find((m) => m.value === e.mood)?.label} ·{" "}
                          {emotions.find((i) => i.value === e.emotion)?.label}
                        </TableCell>
                        <TableCell>{intensities[e.intensity - 1]}</TableCell>
                        <TableCell>{categoryLabel(e.category)}</TableCell>
                        <TableCell>
                          <div className="journal-entry-actions">
                            <Link
                              href={`/journal/${e.id}`}
                              className={buttonVariants({
                                variant: "ghost",
                                size: "sm",
                              })}
                            >
                              Ver
                            </Link>
                            <Link
                              href={`/journal/${e.id}/edit`}
                              className={buttonVariants({
                                variant: "ghost",
                                size: "sm",
                              })}
                            >
                              Editar
                            </Link>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={locked}
                              onClick={() => setConfirmation([e.id])}
                            >
                              Eliminar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="directory-cards">
                {result.entries.map((e) => {
                  const mood = moods.find((m) => m.value === e.mood);
                  const emotion = emotions.find((i) => i.value === e.emotion);
                  return (
                    <article key={e.id} className="surface directory-card">
                      <div className="view-toolbar">
                        <span
                          className="emotion-face"
                          data-emotion={mood?.color}
                          aria-hidden="true"
                        >
                          {mood?.emoji}
                        </span>
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar entrada del ${displayDate(e.occurred_at, timezone)}`}
                          disabled={locked}
                          checked={selected.includes(e.id)}
                          onChange={(v) => select(e.id, v.target.checked)}
                        />
                      </div>
                      <h3>
                        {mood?.label} · {emotion?.label}
                      </h3>
                      <time dateTime={e.occurred_at}>
                        {displayDate(e.occurred_at, timezone)}
                      </time>
                      <dl>
                        <div>
                          <dt>Intensidad</dt>
                          <dd>{intensities[e.intensity - 1]}</dd>
                        </div>
                        <div>
                          <dt>Categoría</dt>
                          <dd>{categoryLabel(e.category)}</dd>
                        </div>
                      </dl>
                      {e.reflection ? (
                        <p className="journal-excerpt">{e.reflection}</p>
                      ) : null}
                      <div className="journal-entry-actions">
                        <Link
                          href={`/journal/${e.id}`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "sm",
                          })}
                        >
                          Ver detalles
                        </Link>
                        <Link
                          href={`/journal/${e.id}/edit`}
                          className={buttonVariants({
                            variant: "ghost",
                            size: "sm",
                          })}
                        >
                          Editar
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={locked}
                          onClick={() => setConfirmation([e.id])}
                        >
                          Eliminar
                        </Button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </section>
      <nav className="pagination" aria-label="Paginación del diario">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1 || locked}
          onClick={() => {
            setPage((p) => p - 1);
            setConfirmation(null);
          }}
        >
          Anterior
        </Button>
        <span>
          Página {page} de {pages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= pages || locked}
          onClick={() => {
            setPage((p) => p + 1);
            setConfirmation(null);
          }}
        >
          Siguiente
        </Button>
      </nav>
    </>
  );
}

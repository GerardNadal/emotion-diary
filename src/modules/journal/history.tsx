"use client";
import { useState } from "react";
import Link from "next/link";
import { BookOpen, LayoutGrid, List, CalendarDays, Plus } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { PageHeading } from "@/components/page-heading";
import { buttonVariants } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import { EmotionalCalendar } from "./calendar";

export function JournalHistory({ today }: { today: string }) {
  const [view, setView] = useState("cards");
  return (
    <>
      <PageHeading
        title="Mi diario"
        description="Un lugar para escuchar cómo te sientes."
        action={
          <Link href="/journal/new" className={buttonVariants()}>
            <Plus data-icon="inline-start" />
            Explorar registro
          </Link>
        }
      />
      <div className="view-toolbar">
        <p className="text-sm text-muted-foreground">
          El historial se conectará en una próxima fase.
        </p>
        <ToggleGroup
          value={[view]}
          onValueChange={(values) => {
            if (values[0]) setView(values[0]);
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
      {view === "calendar" ? (
        <EmotionalCalendar today={today} />
      ) : (
        <section
          className="surface"
          aria-label={
            view === "table" ? "Historial en tabla" : "Historial en tarjetas"
          }
        >
          {view === "table" ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Emoción</TableHead>
                  <TableHead>Intensidad</TableHead>
                  <TableHead>Motivos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState
                      icon={BookOpen}
                      title="Tu historia empieza aquí"
                      description="Cuando el diario esté disponible, encontrarás aquí tus entradas. Solo tú podrás consultarlas."
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <EmptyState
              icon={BookOpen}
              title="Tu historia empieza aquí"
              description="Cuando el diario esté disponible, encontrarás aquí tus entradas. Solo tú podrás consultarlas."
            >
              <Link
                href="/journal/new"
                className={buttonVariants({ variant: "outline" })}
              >
                Probar el registro
              </Link>
            </EmptyState>
          )}
        </section>
      )}
    </>
  );
}

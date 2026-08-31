import React, { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Donut } from "@/components/ui/donut";
import { PageLayout } from "@/components/layout/PageLayout";

const Reports = () => {
  const [vehiculos, setVehiculos] = useState([]);
  const [horas, setHoras] = useState([]);
  const [anormalidades, setAnormalidades] = useState([]);

  useEffect(() => {
    setVehiculos([
      { id: 'FP-BA-01', ubicacion: 'Campo Boscan', tiempo: '08:30', numReportes: 5, tipoReporte: 'Exceso de velocidad' },
      { id: 'FP-GT-02', ubicacion: 'Campo Boscan', tiempo: '12:15', numReportes: 3, tipoReporte: 'Paradas bruscas' },
      { id: 'FP-CC-01', ubicacion: 'Campo Boscan', tiempo: '15:45', numReportes: 8, tipoReporte: 'Aceleraciones bruscas' },
      { id: 'FP-GT-01', ubicacion: 'Campo Boscan', tiempo: '10:20', numReportes: 4, tipoReporte: 'Giros bruscos' },
      { id: 'FP-CF-03', ubicacion: 'Campo Boscan', tiempo: '17:10', numReportes: 6, tipoReporte: 'Ralenti' }
    ]);
    setHoras([
      { label: 'FP-BA-01', value: 120, color: '#3b82f6' },
      { label: 'FP-GT-02', value: 90, color: '#8b5cf6' },
      { label: 'FP-CC-01', value: 70, color: '#06b6d4' },
      { label: 'FP-GT-01', value: 55, color: '#f59e0b' },
      { label: 'FP-CF-03', value: 65, color: '#10b981' },
      { label: 'Otros', value: 40, color: '#9ca3af' }
    ]);
    setAnormalidades([
      { label: 'Anormalidades', value: 42, color: '#ef4444' },
      { label: 'Posibles Anormalidades', value: 36, color: '#f97316' }
    ]);
  }, []);

  return (
    <PageLayout
      icon={FileText}
      title="Reportes"
      maxWidth="max-w-7xl"
      accentColor="orange"
    >
      <div className="flex flex-col gap-8">

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center justify-items-center">

          <div className="w-full max-w-lg flex flex-col items-center gap-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
              Horas de Trabajo
            </h3>
            <Card className="w-full">
              <CardContent className="p-8 flex flex-col items-center gap-6">
                <Donut
                  segments={horas}
                  centerLabel="Horas"
                  centerValue={horas.reduce((s, x) => s + x.value, 0)}
                />
                <ul className="w-full space-y-2">
                  {horas.map((h, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: h.color }} />
                        {h.label}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">{h.value}h</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

          <div className="w-full max-w-lg flex flex-col items-center gap-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 dark:text-white">
              Anormalidades
            </h3>
            <Card className="w-full">
              <CardContent className="p-8 flex flex-col items-center gap-6">
                <Donut
                  segments={anormalidades}
                  centerLabel="Total"
                  centerValue={anormalidades.reduce((s, x) => s + x.value, 0)}
                />
                <ul className="w-full space-y-2">
                  {anormalidades.map((a, i) => (
                    <li key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: a.color }} />
                        {a.label}
                      </span>
                      <span className="font-bold text-slate-900 dark:text-white">{a.value}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>

        </div>

        <Card className="w-full overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Id</TableHead>
                <TableHead>Ubicación</TableHead>
                <TableHead>Tiempo</TableHead>
                <TableHead>Nº de Reportes</TableHead>
                <TableHead>Tipo de Reporte</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vehiculos.map((v, i) => (
                <TableRow key={v.id} className={i % 2 === 0 ? 'bg-transparent' : 'bg-slate-50/60 dark:bg-white/[0.02]'}>
                  <TableCell className="font-mono font-bold text-slate-900 dark:text-white">{v.id}</TableCell>
                  <TableCell>{v.ubicacion}</TableCell>
                  <TableCell>{v.tiempo}</TableCell>
                  <TableCell className="font-bold text-slate-900 dark:text-white">{v.numReportes}</TableCell>
                  <TableCell>
                    <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-500">
                      {v.tipoReporte}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

      </div>
    </PageLayout>
  );
};

export default Reports;

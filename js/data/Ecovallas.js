export const EcovallasData = [
    { 
      id: 'MX_CM_EV_MGP_08_2740', 
      unidad: 'ECOVALLAS', 
      nombre: 'Tecamachalco 5', 
      lat: 19.4326, lng: -99.2132, 
      foto: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&w=600&q=80',
      capex: { 
          costoPantalla: 720000, costoEstructura: 121000, costoModificacion: 0, costoMedidor: 38000, 
          costoInstalacion: 40000, novastar: 3000, ups: 5200, nuc: 12000, pastillaTri: 3577.20, 
          pastilla20A: 5788.88, camara: 6000, teltonika: 12500, poe: 1100 
      },
      operacion: { 
          cfe: 15000, internetFibra: 950, internetSatelital: 2000, licTeltonika: 100, 
          licTeamViewer: 498, licCMS: 500, licHikvision: 137, licUPS: 28, licQTM: 780 
      },
      mantenimiento: { preventivo: 1606.14, correctivo: 0, pauta: 518.47, vandalismo: 0 },
      tickets: [
          { id: 'TK-2026-01-08', tipo: 'Mantenimiento preventivo estético', fecha: '2026-01-06', estado: 'Cerrado', costo: 1606.14, descripcion: 'Insumos: Cepillo, agua y limpiador Nala. Cuadrilla en sitio con 3 técnicos.' },
          { id: 'TK-2026-02-08', tipo: 'Programación Pauta', fecha: '2026-02-28', estado: 'Cerrado', costo: 518.47, descripcion: 'Costo nómina de programación de pauta digital.' }
      ]
    },
    { 
      id: 'MX_CM_EV_MGP_04_3622', 
      unidad: 'ECOVALLAS', 
      nombre: 'Parque Lira', 
      lat: 19.4054, lng: -99.1916,
      foto: 'https://images.unsplash.com/photo-1580130058021-3652e7de1812?auto=format&fit=crop&w=600&q=80',
      capex: { 
          costoPantalla: 720000, costoEstructura: 121000, costoModificacion: 0, costoMedidor: 38000, 
          costoInstalacion: 40000, novastar: 3000, ups: 5200, nuc: 12000, pastillaTri: 3577.20, 
          pastilla20A: 5788.88, camara: 6000, teltonika: 12500, poe: 1100 
      },
      operacion: { 
          cfe: 15000, internetFibra: 950, internetSatelital: 2000, licTeltonika: 100, 
          licTeamViewer: 498, licCMS: 500, licHikvision: 137, licUPS: 28, licQTM: 780 
      }, 
      mantenimiento: { preventivo: 1726.09, correctivo: 0, pauta: 0, vandalismo: 379.55 },
      tickets: [
          { id: 'TK-2026-01-15', tipo: 'Mantenimiento preventivo estético', fecha: '2026-01-15', estado: 'Cerrado', costo: 1726.09, descripcion: 'Insumos: Cepillo, agua y limpiador Nala. 3 técnicos asignados.' },
          { id: 'TK-2026-02-22', tipo: 'Graffiti', fecha: '2026-02-22', estado: 'Cerrado', costo: 379.55, descripcion: 'Limpieza de pintas en estructura. Insumos: Franela y limpiador Nala.' }
      ]
    },
    { 
      id: 'MX_CM_EV_MGP_01_3323', 
      unidad: 'ECOVALLAS', 
      nombre: 'Amsterdam 107', 
      lat: 19.4125, lng: -99.1712,
      foto: 'https://images.unsplash.com/photo-1616832880699-8541b04005ea?auto=format&fit=crop&w=600&q=80',
      capex: { 
          costoPantalla: 720000, costoEstructura: 121000, costoModificacion: 0, costoMedidor: 38000, 
          costoInstalacion: 40000, novastar: 3000, ups: 5200, nuc: 12000, pastillaTri: 3577.20, 
          pastilla20A: 5788.88, camara: 6000, teltonika: 12500, poe: 1100 
      },
      operacion: { 
          cfe: 15000, internetFibra: 950, internetSatelital: 2000, licTeltonika: 100, 
          licTeamViewer: 498, licCMS: 500, licHikvision: 137, licUPS: 28, licQTM: 780 
      }, 
      mantenimiento: { preventivo: 0, correctivo: 946.16, pauta: 0, vandalismo: 0 },
      tickets: [
          { id: 'TK-2026-04-24', tipo: 'Fuera de línea (internet)', fecha: '2026-04-24', estado: 'Abierto', costo: 946.16, descripcion: 'Falla de conexión reportada por soporte remoto. Desplazamiento de 3 técnicos y consumo de gasolina.' }
      ]
    }
];
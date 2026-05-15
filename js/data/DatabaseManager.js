import { CapexDiccionario } from '../config/Capex.js';
import { OperacionDiccionario } from '../config/Operacion.js';
import { MantenimientoDiccionario } from '../config/Mantenimiento.js';
import Papa from 'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/+esm';

// Lógica de limpieza mejorada con detección de caracteres Unicode corruptos (\uFFFD)
const corregirTexto = (texto) => {
    if (!texto) return '';
    let txt = String(texto);
    const mapaMojibake = {
        'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú',
        'Ã±': 'ñ', 'Ã‘': 'Ñ',
        'Ã ': 'Á', 'Ã‰': 'É', 'Ã ': 'Í', 'Ã“': 'Ó', 'Ãš': 'Ú',
        'Ã¼': 'ü', 'Â°': '°', 'Ã ': 'à', 'Ã¨': 'è', 'Â': '',
        
        // EL PARCHE PARA EL ROMBO NEGRO (Unicode Replacement Character)
        'est\uFFFDtico': 'estético',
        'm\uFFFDdem': 'módem',
        'm\uFFFDdulo': 'módulo',
        'da\uFFFDado': 'dañado',
        'da\uFFFDo': 'daño',
        'termomagn\uFFFDtico': 'termomagnético',
        'l\uFFFDnea': 'línea',
        'obstrucci\uFFFDn': 'obstrucción',
        'f\uFFFDsica': 'física',
        'c\uFFFDmara': 'cámara',
        'actualizaci\uFFFDn': 'actualización',
        
        // Correcciones ortográficas detectadas en el diagnóstico
        'puata': 'pauta',
        'Garffiti': 'Graffiti'
    };
    for (let mal in mapaMojibake) {
        txt = txt.split(mal).join(mapaMojibake[mal]);
    }
    return txt.trim();
};

const normalizarFiltro = (texto) => {
    return (texto || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
};

const getVal = (obj, posiblesNombres) => {
    if (!obj) return null;
    const keys = Object.keys(obj);
    for (let nombre of posiblesNombres) {
        if (keys.includes(nombre) && obj[nombre] !== null && obj[nombre] !== undefined && obj[nombre] !== '') return obj[nombre];
    }
    for (let nombre of posiblesNombres) {
        const searchKey = nombre.toLowerCase().trim();
        const found = keys.find(k => k.toLowerCase().trim() === searchKey);
        if (found && obj[found] !== null && obj[found] !== undefined && obj[found] !== '') return obj[found];
    }
    return null;
};

// Fórmula traductora de Fechas de Excel (ej. 46046 -> 24/01/2026)
const formatearFecha = (fechaRaw) => {
    if (!fechaRaw) return 'Sin fecha';
    const num = Number(fechaRaw);
    if (!isNaN(num) && num > 20000) {
        const date = new Date(Math.round((num - 25569) * 86400 * 1000));
        const dia = String(date.getUTCDate()).padStart(2, '0');
        const mes = String(date.getUTCMonth() + 1).padStart(2, '0');
        const anio = date.getUTCFullYear();
        return `${dia}/${mes}/${anio}`;
    }
    return String(fechaRaw).split(' ')[0];
};

export default class DatabaseManager {
    constructor() {
        this.diccionarios = {
            capex: CapexDiccionario,
            operacion: OperacionDiccionario,
            mantenimiento: MantenimientoDiccionario
        };
        this.rawData = [];
    }

    async consultarTablaCSV(urlArchivo) {
        return new Promise((resolve) => {
            Papa.parse(urlArchivo, {
                download: true,
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (err) => {
                    console.warn(`Aviso: No se pudo cargar la tabla ${urlArchivo}.`, err);
                    resolve([]); 
                }
            });
        });
    }

    async cargarDatosJSON() {
        try {
            const limpiarDinero = (val) => Number(String(val || 0).replace(/[^0-9.-]+/g, "")) || 0;

            const [
                capexEco, opEco, tkEco,
                capexVV, opVV, tkVV
            ] = await Promise.all([
                this.consultarTablaCSV('data_files/capex_ecovallas.csv'),
                this.consultarTablaCSV('data_files/operacion.csv'), 
                this.consultarTablaCSV('data_files/tickets.csv'),
                this.consultarTablaCSV('data_files/capex_viaverde.csv'),
                this.consultarTablaCSV('data_files/operacion_viaverde.csv'),
                this.consultarTablaCSV('data_files/tickets_viaverde.csv') 
            ]);

            const mesesDelAnio = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

            // 1. CARGAMOS INVENTARIO CAPEX COMPLETO (Unificado)
            const procesarFilaCapex = (fila, unidadDefecto) => {
                const idPantalla = String(getVal(fila, ['id_de_pantalla', 'ID de pantalla', 'id', 'sitio']) || 'SIN_ID').trim();
                const nombreSitio = corregirTexto(getVal(fila, ['pantalla', 'Nombre', 'Ubicacion', 'Ubicación', 'Sitio']) || idPantalla);

                const orientacion = String(getVal(fila, ['Orientacion', 'Orientación']) || 'unica').toLowerCase().trim();
                const costoRenovacion = limpiarDinero(getVal(fila, ['Renovación tecnólogica pantalla', 'Renovación tecnologica pantalla']));
                const costoPantallaBase = limpiarDinero(getVal(fila, ['Pantalla']));
                
                let cPantalla = costoPantallaBase;
                let cAnterior = 0;

                // VÍA VERDE: Lógica de costo de renovación vs costo anterior
                if (unidadDefecto === 'VIA VERDE' && costoRenovacion > 0) {
                    cPantalla = costoRenovacion;
                    cAnterior = costoPantallaBase;
                }

                const cObra = limpiarDinero(getVal(fila, ['Obra civil']));
                const cEst = limpiarDinero(getVal(fila, ['Estructura'])) + limpiarDinero(getVal(fila, ['Modificación estructura']));
                const cMed = limpiarDinero(getVal(fila, ['Medidor CFE']));
                const cInst = limpiarDinero(getVal(fila, ['Instalación eléctrica', 'InstalaciÃ³n elÃ©ctrica', 'Instalacion electrica']));
                const cNova = limpiarDinero(getVal(fila, ['Sending SD 300', 'Sending / Novastar', 'Sending card']));
                const cUps = limpiarDinero(getVal(fila, ['UPS CyberPower de 1000VA', 'UPS']));
                const cNuc = limpiarDinero(getVal(fila, ['Nuc', 'NUC', 'Nuc ASUS BOXNUC1513I, Intel Core i5']));
                const cPTri = limpiarDinero(getVal(fila, ['Interruptor termomagnético trifásica 3X100Amp', 'Interruptor_termomagnetico_trifasica_3x100 amp']));
                const cP20A = limpiarDinero(getVal(fila, ['Interrruptor termomagnética 2X20Amp', 'Interruptor termomagnético 2X20Amp', 'Interruptor 2x20 amp']));
                const cCam = limpiarDinero(getVal(fila, ['Cámara', 'Camara', 'Cámara HIKVISION Modelo : DS-2CD2347G2P-LSU/SL']));
                const cTel = limpiarDinero(getVal(fila, ['Teltonika Rut 955', 'teltonika_rut_955']));
                const cPoe = limpiarDinero(getVal(fila, ['Poe Utepo', 'Poe_utepo']));

                let p = this.rawData.find(x => x.id === idPantalla);

                if (p) {
                    // Si ya existe la pantalla, le sumamos los costos de esta cara a la bolsa global
                    p.capex.costoPantalla += cPantalla;
                    p.capex.obraCivil += cObra;
                    p.capex.costoEstructura += cEst;
                    p.capex.costoMedidor += cMed;
                    p.capex.costoInstalacion += cInst;
                    p.capex.novastar += cNova;
                    p.capex.ups += cUps;
                    p.capex.nuc += cNuc;
                    p.capex.pastillaTri += cPTri;
                    p.capex.pastilla20A += cP20A;
                    p.capex.camara += cCam;
                    p.capex.teltonika += cTel;
                    p.capex.poe += cPoe;
                } else {
                    p = {
                        id: idPantalla,
                        unidad: unidadDefecto, 
                        nombre: nombreSitio, 
                        lat: 19.4326, lng: -99.1332,
                        foto: 'https://images.unsplash.com/photo-1542204165-65bf26472b9b?auto=format&fit=crop&w=600&q=80',
                        capex: {
                            costoPantalla: cPantalla,
                            obraCivil: cObra,
                            costoEstructura: cEst,
                            costoMedidor: cMed,
                            costoInstalacion: cInst,
                            novastar: cNova,
                            ups: cUps,
                            nuc: cNuc,
                            pastillaTri: cPTri,
                            pastilla20A: cP20A,
                            camara: cCam,
                            teltonika: cTel,
                            poe: cPoe
                        },
                        gastosOperacion: [], 
                        operacion: { cfe: 0, internetFibra: 0, internetSatelital: 0, licTeltonika: 0, licTeamViewer: 0, licCMS: 0, licHikvision: 0, licUPS: 0, licQTM: 0, pauta: 0 },
                        mantenimiento: { estetico: 0, profundo: 0, software: 0, tickets: 0 },
                        tickets: []
                    };
                    this.rawData.push(p);
                }

                // NUEVO: Guardamos el detalle separado por cara SOLO para VÍA VERDE
                if (unidadDefecto === 'VIA VERDE') {
                    if (!p.carasVV) p.carasVV = {};
                    p.carasVV[orientacion] = {
                        costoPantalla: cPantalla,
                        costoAnterior: cAnterior, // Lo usaremos en la UI
                        obraCivil: cObra,
                        costoEstructura: cEst,
                        costoMedidor: cMed,
                        costoInstalacion: cInst,
                        novastar: cNova,
                        ups: cUps,
                        nuc: cNuc,
                        pastillaTri: cPTri,
                        pastilla20A: cP20A,
                        camara: cCam,
                        teltonika: cTel,
                        poe: cPoe
                    };
                }
            };

            if (capexEco) capexEco.forEach(f => procesarFilaCapex(f, 'ECOVALLAS'));
            if (capexVV) capexVV.forEach(f => procesarFilaCapex(f, 'VIA VERDE'));

            // 2. GASTOS DE OPERACIÓN MENSUAL
            const todasOperaciones = [...(opEco || []), ...(opVV || [])];
            if (todasOperaciones.length > 0) {
                todasOperaciones.forEach(op => {
                    const id = String(getVal(op, ['sitio', 'id', 'ID de pantalla']) || '').trim();
                    const pantalla = this.rawData.find(p => p.id === id);
                    if (pantalla) {
                        pantalla.gastosOperacion.push({
                            mes: String(getVal(op, ['Mes']) || 'all').toLowerCase().trim(),
                            cfe: limpiarDinero(getVal(op, ['CFE'])),
                            internetFibra: limpiarDinero(getVal(op, ['Internet fibra'])),
                            internetSatelital: limpiarDinero(getVal(op, ['Internet redundancia (satelital)', 'Internet redundancia'])),
                            licTeltonika: limpiarDinero(getVal(op, ['Licencia Teltonika'])),
                            licTeamViewer: limpiarDinero(getVal(op, ['Licencia TeamViewer'])),
                            licCMS: limpiarDinero(getVal(op, ['Licencia CMS'])),
                            licHikvision: limpiarDinero(getVal(op, ['Licencia Hikvision'])),
                            licUPS: limpiarDinero(getVal(op, ['Licencia de portal de UPS'])),
                            licQTM: limpiarDinero(getVal(op, ['Licencia QTM'])),
                            pauta: 0 
                        });
                    }
                });
            }

            // 3. INCIDENCIAS (TICKETS) CON PARCHE UNICODE
            const todosTickets = [...(tkEco || []), ...(tkVV || [])];
            if (todosTickets.length > 0) {
                todosTickets.forEach(ticket => {
                    const id = String(getVal(ticket, ['ID de pantalla', 'sitio']) || '').trim();
                    const pantallaObj = this.rawData.find(p => p.id === id);
                    if (!pantallaObj) return;

                    const actividadOriginal = getVal(ticket, ['Actividad', 'incidencia']) || 'Incidencia General';
                    const actividad = corregirTexto(actividadOriginal);
                    const costo = limpiarDinero(getVal(ticket, ['Total', 'costo_acumulado']));
                    const mes = String(getVal(ticket, ['Mes']) || 'all').toLowerCase().trim();

                    const fechaCruda = getVal(ticket, ['Fecha', 'fecha_creacion', 'fecha']);
                    const fechaCorta = formatearFecha(fechaCruda);

                    const insumo = corregirTexto(getVal(ticket, ['Tipo de insumo', 'Insumo', 'Tipo de insumo\uFFFD']) || '');
                    const refaccion = corregirTexto(getVal(ticket, ['Tipo de refacción', 'Refaccion', 'Tipo de refaccion', 'Tipo de refacci\uFFFDn']) || '');

                    // Si es Pauta, la sumamos a Operación
                    if (normalizarFiltro(actividad).includes('pauta')) {
                        let opMes = pantallaObj.gastosOperacion.find(o => o.mes === mes);
                        if (!opMes) {
                            opMes = { mes: mes, cfe: 0, internetFibra: 0, internetSatelital: 0, licTeltonika: 0, licTeamViewer: 0, licCMS: 0, licHikvision: 0, licUPS: 0, licQTM: 0, pauta: 0 };
                            pantallaObj.gastosOperacion.push(opMes);
                        }
                        opMes.pauta += costo;
                    } else {
                        // Es mantenimiento
                        pantallaObj.tickets.push({
                            actividad,
                            causa: corregirTexto(getVal(ticket, ['causa_raiz', 'motivo']) || 'Mantenimiento'),
                            fechaCorta: fechaCorta, 
                            mes: mes,
                            insumo: insumo,
                            refaccion: refaccion,
                            costoMantto: costo
                        });
                    }
                });
            }

            console.log("¡Base de datos cargada con éxito!", this.rawData);

        } catch (error) {
            console.error("Error al cargar datos:", error);
        }
    }

    getPantallasPorUnidad(unidad) {
        // Normalizamos unidad para que 'VIA VERDE' y 'VIAVERDE' crucen sin problemas
        const target = normalizarFiltro(unidad).replace(/\s/g, '');
        return this.rawData.filter(p => normalizarFiltro(p.unidad).replace(/\s/g, '') === target);
    }

    getSumasConsolidadas(unidad, modulo, mes = 'all') {
        const pantallas = this.getPantallasPorUnidad(unidad);
        const etiquetas = this.diccionarios[modulo];
        const mesBuscado = mes.toLowerCase().trim(); 
        let sumas = {};

        if (modulo === 'mantenimiento') {
            sumas = { estetico: 0, profundo: 0, software: 0, tickets: 0 };
        } else {
            Object.keys(etiquetas).forEach(k => sumas[k] = 0);
        }
        
        pantallas.forEach(p => {
            Object.keys(sumas).forEach(k => { 
                if (modulo === 'operacion') {
                    const registrosMes = p.gastosOperacion.filter(o => mesBuscado === 'all' || o.mes === mesBuscado);
                    sumas[k] += registrosMes.reduce((acc, o) => acc + (o[k] || 0), 0);
                    
                } else if (modulo === 'mantenimiento') {
                    const ticketsMes = p.tickets.filter(tk => mesBuscado === 'all' || tk.mes === mesBuscado);
                    const filtrarPorKeyword = (key) => ticketsMes.filter(tk => normalizarFiltro(tk.actividad).includes(key)).reduce((acc, tk) => acc + tk.costoMantto, 0);

                    if (k === 'estetico') sumas[k] += filtrarPorKeyword('estetico');
                    else if (k === 'software') sumas[k] += filtrarPorKeyword('software');
                    else if (k === 'profundo') sumas[k] += filtrarPorKeyword('profundo');
                    else if (k === 'tickets') {
                        sumas[k] += ticketsMes.filter(tk => {
                            const n = normalizarFiltro(tk.actividad);
                            return !n.includes('estetico') && !n.includes('software') && !n.includes('profundo');
                        }).reduce((acc, tk) => acc + tk.costoMantto, 0);
                    }
                } else {
                    sumas[k] += (p[modulo][k] || 0); 
                }
            });
        });
        return sumas;
    }

    getGranTotal(sumasObj) {
        return Object.values(sumasObj).reduce((a, b) => a + b, 0);
    }
}
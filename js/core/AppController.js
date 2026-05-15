import DatabaseManager from '../data/DatabaseManager.js';
import ModalController from '../ui/ModalController.js';
import DiagramRenderer from '../ui/DiagramRenderer.js';

// Helper a prueba de fallos para AppController
const normalizarFiltro = (texto) => (texto || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export default class AppController {
    constructor() {
        this.formatMoney = (num) => new Intl.NumberFormat('es-MX', { 
            style: 'currency', 
            currency: 'MXN', 
            maximumFractionDigits: 0 
        }).format(num);

        this.dbManager = new DatabaseManager();
        this.modalCtrl = new ModalController(this.formatMoney);
        this.renderer = new DiagramRenderer();
        
        this.state = { 
            unidad: '', 
            modulo: '', 
            subModulo: '', 
            mes: 'all' 
        };

        window.addEventListener('resize', () => this.renderer.drawLines());
    }

    async arrancarAplicacion() {
        await this.dbManager.cargarDatosJSON();
        this.initBuscador();
    }

    iniciar(unidad, theme) {
        this.state.unidad = unidad;
        const root = document.documentElement;
        
        const colors = { eco: '--eco-main', vv: '--vv-main', bb: '--bb-main' };
        const lights = { eco: '--eco-light', vv: '--vv-light', bb: '--bb-light' };
        
        const logos = { 
            eco: 'assets/logos/ecovallas.png', 
            vv: 'assets/logos/viaverde.png', 
            bb: 'assets/logos/biobox.png' 
        };
        
        root.style.setProperty('--theme-color', `var(${colors[theme]})`);
        root.style.setProperty('--theme-light', `var(${lights[theme]})`);

        const lblUnidad = document.getElementById('lbl-unidad');
        if (lblUnidad) {
            lblUnidad.innerHTML = `<img src="${logos[theme]}" alt="${unidad}" style="max-height: 45px; width: auto; object-fit: contain; vertical-align: middle;">`;
        }

        document.getElementById('intro-view').classList.add('fade-out');
        document.getElementById('canvas-view').classList.add('active');
        
        this.renderMonthSelector();
        this.construirNivel1();
    }

    volver() {
        document.getElementById('intro-view').classList.remove('fade-out');
        document.getElementById('canvas-view').classList.remove('active');
        const selector = document.getElementById('month-selector-container');
        if (selector) selector.style.display = 'none';
        this.renderer.clearAll();
    }

    renderMonthSelector() {
        let container = document.getElementById('month-selector-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'month-selector-container';
            container.style.cssText = 'background: white; padding: 4px 15px; border-radius: 8px; border: 1px solid var(--theme-light); font-family: sans-serif; display: flex; align-items: center; gap: 10px; margin-left: 20px;';
            
            container.innerHTML = `
                <label style="font-weight: 800; color: var(--theme-color); font-size: 0.9rem; margin:0;">MES:</label>
                <select id="month-select" style="padding: 4px 8px; border-radius: 6px; border: 1px solid #ddd; outline: none; font-weight: 600; cursor: pointer; color: #333; background: #fafafa;">
                    <option value="all">Consolidado</option>
                    <option value="enero">Enero 2026</option>
                    <option value="febrero">Febrero 2026</option>
                    <option value="marzo">Marzo 2026</option>
                    <option value="abril">Abril 2026</option>
                    <option value="mayo">Mayo 2026</option>
                </select>
            `;
            
            const searchInput = document.getElementById('global-search');
            if (searchInput && searchInput.parentElement) {
                searchInput.parentElement.insertAdjacentElement('afterend', container);
            } else {
                document.getElementById('canvas-view').appendChild(container);
            }

            document.getElementById('month-select').addEventListener('change', (e) => {
                this.cambiarMes(e.target.value);
            });
        }
        container.style.display = 'flex';
        document.getElementById('month-select').value = this.state.mes;
    }

    cambiarMes(val) {
        this.state.mes = val;
        if (this.state.unidad) {
            this.state.modulo = '';
            this.state.subModulo = '';
            this.construirNivel1();
        }
    }

    construirNivel1() {
        this.renderer.clearAll();
        const html = `
            <div class="node" onclick="app.seleccionarModulo('capex', this)">
                <div class="node-title">CAPEX</div>
            </div>
            <div class="node" onclick="app.seleccionarModulo('operacion', this)">
                <div class="node-title">OPERACIÓN</div>
            </div>
            <div class="node" onclick="app.seleccionarModulo('mantenimiento', this)">
                <div class="node-title">MANTENIMIENTO</div>
            </div>
        `;
        this.renderer.createColumn(1, "MÓDULOS", html);
    }

    seleccionarModulo(modulo, nodeEl) {
        this.state.modulo = modulo;
        this.renderer.deselectNodes(1); nodeEl.classList.add('selected'); this.renderer.removeColumnsAfter(1);
        
        if (modulo === 'mantenimiento') {
            const sumasMantto = this.dbManager.getSumasConsolidadas(this.state.unidad, 'mantenimiento', this.state.mes);
            
            const preventivoTotal = (sumasMantto.estetico || 0) + (sumasMantto.profundo || 0) + (sumasMantto.software || 0);
            const correctivoTotal = (sumasMantto.tickets || 0);

            const html = `
                <div class="node" onclick="app.renderSubMantenimiento('preventivo', this)">
                    <div class="node-title">Preventivo</div>
                    <div class="node-sub">Rutina y Software</div>
                    <div class="node-val">${this.formatMoney(preventivoTotal)}</div>
                </div>
                <div class="node" onclick="app.renderSubMantenimiento('correctivo', this)">
                    <div class="node-title">Correctivo</div>
                    <div class="node-sub">Tickets de Incidencia</div>
                    <div class="node-val">${this.formatMoney(correctivoTotal)}</div>
                </div>
            `;
            this.renderer.createColumn(2, "TIPO MANTTO.", html);
        } else {
            const sumas = this.dbManager.getSumasConsolidadas(this.state.unidad, modulo, this.state.mes);
            const dicc = this.dbManager.diccionarios[modulo];
            const html = Object.keys(dicc).map(k => `
                <div class="node" onclick="app.seleccionarComponente('${k}', this)">
                    <div class="node-title">${dicc[k]}</div>
                    <div class="node-val">${this.formatMoney(sumas[k] || 0)}</div>
                </div>
            `).join('');
            this.renderer.createColumn(2, "CONSOLIDADO RED", html);
        }
    }

    renderSubMantenimiento(tipo, nodeEl) {
        this.renderer.deselectNodes(2); nodeEl.classList.add('selected'); this.renderer.removeColumnsAfter(2);
        this.state.subModulo = tipo;

        const subDicc = this.dbManager.diccionarios.mantenimiento[tipo].sub;
        const sumasDinamicas = this.dbManager.getSumasConsolidadas(this.state.unidad, 'mantenimiento', this.state.mes);

        const html = Object.keys(subDicc).map(k => `
            <div class="node" onclick="app.seleccionarComponente('${k}', this)">
                <div class="node-title">${subDicc[k]}</div>
                <div class="node-val">${this.formatMoney(sumasDinamicas[k] || 0)}</div>
            </div>
        `).join('');
        this.renderer.createColumn(3, "SUB-RUBRO", html);
    }

    seleccionarComponente(key, nodeEl) {
        const lvl = parseInt(nodeEl.closest('.column').dataset.lvl);
        this.renderer.deselectNodes(lvl); nodeEl.classList.add('selected'); this.renderer.removeColumnsAfter(lvl);

        const pantallas = this.dbManager.getPantallasPorUnidad(this.state.unidad);
        const html = pantallas.map(p => {
            let valor = 0;
            
            if (this.state.modulo === 'operacion') {
                valor = (p.gastosOperacion || [])
                    .filter(op => this.state.mes === 'all' || op.mes === this.state.mes)
                    .reduce((acc, op) => acc + (op[key] || 0), 0);
            } 
            else if (this.state.modulo === 'mantenimiento') {
                const ticketsMes = (p.tickets || []).filter(tk => this.state.mes === 'all' || tk.mes === this.state.mes);
                
                if (key === 'estetico') {
                    valor = ticketsMes.filter(tk => normalizarFiltro(tk.actividad).includes('estetico')).reduce((acc, tk) => acc + tk.costoMantto, 0);
                } else if (key === 'software') {
                    valor = ticketsMes.filter(tk => normalizarFiltro(tk.actividad).includes('software')).reduce((acc, tk) => acc + tk.costoMantto, 0);
                } else if (key === 'profundo') {
                    valor = ticketsMes.filter(tk => normalizarFiltro(tk.actividad).includes('profundo')).reduce((acc, tk) => acc + tk.costoMantto, 0);
                } else if (key === 'tickets') {
                    valor = ticketsMes.filter(tk => {
                        const a = normalizarFiltro(tk.actividad);
                        return !a.includes('estetico') && !a.includes('software') && !a.includes('profundo');
                    }).reduce((acc, tk) => acc + tk.costoMantto, 0);
                } else {
                    valor = p.mantenimiento[key] || 0;
                }
            } else {
                valor = p[this.state.modulo][key] || 0;
            }

            return `
                <div class="node" onclick="app.seleccionarPantalla('${p.id}', this)">
                    <div class="node-title">${p.id}</div>
                    <div class="node-sub">${p.nombre}</div>
                    <div class="node-val" style="font-size: 0.95rem;">${this.formatMoney(valor)}</div>
                </div>
            `;
        }).join('');
        this.renderer.createColumn(lvl + 1, "INVENTARIO", html);
    }

    seleccionarPantalla(id, nodeEl) {
        try {
            const lvl = parseInt(nodeEl.closest('.column').dataset.lvl);
            this.renderer.deselectNodes(lvl); nodeEl.classList.add('selected'); this.renderer.removeColumnsAfter(lvl);

            const pantalla = this.dbManager.rawData.find(x => x.id === id);
            const rubroActual = this.state.modulo; 
            const dicc = this.dbManager.diccionarios[rubroActual];

            let subtotal = 0;
            let filas = '';

            // --- LÓGICA 1: SI ES MANTENIMIENTO ---
            if (rubroActual === 'mantenimiento' && this.state.subModulo) {
                const subDicc = (dicc[this.state.subModulo] && dicc[this.state.subModulo].sub) ? dicc[this.state.subModulo].sub : {};
                
                filas = Object.keys(subDicc).map(k => {
                    const ticketsMes = (pantalla.tickets || []).filter(tk => this.state.mes === 'all' || tk.mes === this.state.mes);
                    let ticketsFiltrados = [];
                    
                    if (k === 'estetico') {
                        ticketsFiltrados = ticketsMes.filter(tk => normalizarFiltro(tk.actividad).includes('estetico'));
                    } else if (k === 'software') {
                        ticketsFiltrados = ticketsMes.filter(tk => normalizarFiltro(tk.actividad).includes('software'));
                    } else if (k === 'profundo') {
                        ticketsFiltrados = ticketsMes.filter(tk => normalizarFiltro(tk.actividad).includes('profundo'));
                    } else if (k === 'tickets') {
                        ticketsFiltrados = ticketsMes.filter(tk => {
                            const a = normalizarFiltro(tk.actividad);
                            return !a.includes('estetico') && !a.includes('software') && !a.includes('profundo');
                        });
                    }

                    const costoCategoria = ticketsFiltrados.reduce((acc, tk) => acc + tk.costoMantto, 0);
                    subtotal += costoCategoria;

                    let ticketsHTML = ticketsFiltrados.map(tk => {
                        let extrasDiv = '';
                        const tieneInsumo = tk.insumo && tk.insumo !== '0' && tk.insumo.trim() !== '';
                        const tieneRefaccion = tk.refaccion && tk.refaccion !== '0' && tk.refaccion.trim() !== '';

                        if (tieneInsumo || tieneRefaccion) {
                            extrasDiv = `<div style="margin-top: 6px; padding: 6px; background-color: #f7f9fc; border-radius: 4px; border-left: 3px solid #607d8b;">`;
                            if (tieneInsumo) {
                                extrasDiv += `<div style="font-size: 0.75rem; color: #455a64; margin-bottom: 2px;">
                                                <span style="font-weight: 700;">Insumos:</span> ${tk.insumo}
                                              </div>`;
                            }
                            if (tieneRefaccion) {
                                extrasDiv += `<div style="font-size: 0.75rem; color: #455a64;">
                                                <span style="font-weight: 700;">Refacción:</span> ${tk.refaccion}
                                              </div>`;
                            }
                            extrasDiv += `</div>`;
                        }

                        return `
                        <div style="background: #fff; padding: 12px; border-radius: 6px; border-left: 4px solid var(--theme-color); margin-bottom: 12px; box-shadow: 0 2px 5px rgba(0,0,0,0.06); border: 1px solid #eaeaea;">
                            <div style="font-size: 0.85rem; color: #222; font-weight: 800; margin-bottom: 5px; text-transform: capitalize;">${tk.actividad}</div>
                            <div style="font-size: 0.75rem; color: #555; margin-bottom: 6px; line-height: 1.4;">
                                <b>Causa / Motivo:</b> ${tk.causa}
                            </div>
                            ${extrasDiv}
                            <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #eee; padding-top: 8px; margin-top: 10px;">
                                <span style="font-size: 0.75rem; color: #888; font-weight: 600;">
                                    ${tk.fechaCorta} <span style="color: var(--theme-color); text-transform: capitalize;">(${tk.mes})</span>
                                </span>
                                <span style="font-size: 0.95rem; color: var(--theme-color); font-weight: 900;">${this.formatMoney(tk.costoMantto)}</span>
                            </div>
                        </div>
                        `;
                    }).join('');

                    if (ticketsFiltrados.length === 0) {
                        ticketsHTML = `<div style="font-size: 0.8rem; color: #aaa; padding: 15px; text-align: center; font-style: italic;">No hubo gastos de este rubro en este periodo</div>`;
                    }

                    return `
                        <div class="nf-row" style="flex-direction: column; align-items: flex-start; border-bottom: none; padding-bottom: 0;">
                            <div style="width: 100%; display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--theme-light);">
                                <span class="nf-label" style="font-weight: 900; color: #333; font-size: 0.9rem;">${subDicc[k] || k}</span>
                                <span class="nf-val" style="font-size: 1.1rem;">${this.formatMoney(costoCategoria)}</span>
                            </div>
                            <div style="width: 100%; max-height: 350px; overflow-y: auto; padding-right: 5px;">
                                ${ticketsHTML}
                            </div>
                        </div>
                    `;
                }).join('');

            // --- LÓGICA 2: SI ES CAPEX Y ES VÍA VERDE ---
            } else if (rubroActual === 'capex' && (pantalla.unidad === 'VIA VERDE' || pantalla.unidad === 'VIAVERDE') && pantalla.carasVV) {
                let htmlCaras = '';
                
                Object.keys(pantalla.carasVV).forEach(cara => {
                    const datosCara = pantalla.carasVV[cara];
                    let subtotalCara = 0;
                    
                    let filasCara = Object.keys(dicc).map(k => {
                        const label = typeof dicc[k] === 'object' ? dicc[k].label : dicc[k];
                        let valor = datosCara[k] || 0;
                        
                        subtotalCara += valor;
                        subtotal += valor; // Sumamos todo al gran total del panel

                        let extrasDiv = '';
                        if (k === 'costoPantalla' && datosCara.costoAnterior > 0) {
                            extrasDiv = `<div style="margin-top: 4px; padding: 6px; background-color: #f7f9fc; border-radius: 4px; border-left: 3px solid #9e9e9e; font-size: 0.7rem; color: #555;">
                                            <span style="font-weight: 700;">Costo anterior a renovación:</span> ${this.formatMoney(datosCara.costoAnterior)}
                                         </div>`;
                        }

                        return `
                            <div class="nf-row" style="flex-direction: column; align-items: flex-start; padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                                <div style="width: 100%; display: flex; justify-content: space-between;">
                                    <span class="nf-label" style="font-size: 0.75rem; color: #444;">${label}</span>
                                    <span class="nf-val" style="font-size: 0.85rem; color: #111;">${this.formatMoney(valor)}</span>
                                </div>
                                ${extrasDiv}
                            </div>
                        `;
                    }).join('');

                    htmlCaras += `
                        <div style="flex: 1; min-width: 250px; background: #fff; padding: 15px; border-radius: 6px; border-top: 4px solid var(--theme-color); box-shadow: 0 1px 4px rgba(0,0,0,0.08);">
                            <h4 style="margin: 0 0 10px 0; text-transform: uppercase; color: var(--theme-color); text-align: center; font-size: 0.85rem; letter-spacing: 0.5px;">CARA ${cara}</h4>
                            ${filasCara}
                            <div style="margin-top: 10px; padding-top: 8px; border-top: 2px solid var(--theme-light); text-align: right; font-weight: 900; color: var(--theme-color); font-size: 1.1rem;">
                                Subtotal Cara: ${this.formatMoney(subtotalCara)}
                            </div>
                        </div>
                    `;
                });

                filas = `<div style="display: flex; gap: 15px; flex-wrap: wrap; align-items: flex-start;">${htmlCaras}</div>`;

            // --- LÓGICA 3: OPERACIÓN O CAPEX NORMAL (ECOVALLAS) ---
            } else {
                filas = Object.keys(dicc).map(k => {
                    const label = typeof dicc[k] === 'object' ? dicc[k].label : dicc[k];
                    let valor = 0;
                    
                    if (rubroActual === 'operacion') {
                        valor = (pantalla.gastosOperacion || [])
                            .filter(op => this.state.mes === 'all' || op.mes === this.state.mes)
                            .reduce((acc, op) => acc + (op[k] || 0), 0);
                    } else {
                        valor = pantalla[rubroActual][k] || 0;
                    }

                    subtotal += valor;
                    return `
                        <div class="nf-row">
                            <span class="nf-label">${label}</span>
                            <span class="nf-val">${this.formatMoney(valor)}</span>
                        </div>
                    `;
                }).join('');
            }

            // DIBUJADO FINAL DEL PANEL
            const html = `
                <div class="node-final" style="${pantalla.carasVV && rubroActual === 'capex' ? 'width: 650px;' : ''}">
                    <div class="nf-header">
                        <div class="nf-title" style="font-size: 1.2rem;">${pantalla.id}</div>
                        <div class="nf-id" style="margin-top: 4px; font-size: 0.85rem;">${pantalla.nombre}</div>
                    </div>
                    <div class="nf-body">
                        <div style="font-size: 0.8rem; font-weight: 800; color: var(--theme-color); margin-bottom: 15px; text-transform: uppercase; border-bottom: 1px solid var(--theme-light); padding-bottom: 6px;">
                            Detalle de ${rubroActual} ${this.state.subModulo ? '(' + this.state.subModulo + ')' : ''}
                        </div>
                        ${filas}
                    </div>
                    <div class="nf-total" style="margin-top: 15px; border-top: 2px solid #ddd; padding-top: 12px;">
                        <div class="nf-total-label" style="font-size: 0.95rem;">Subtotal Global de Rubro</div>
                        <div class="nf-total-val" style="font-size: 1.5rem;">${this.formatMoney(subtotal)}</div>
                    </div>
                </div>
            `;
            this.renderer.createColumn(lvl + 1, "EXPEDIENTE", html);
            
        } catch (error) {
            console.error("🚨 Error al abrir el panel final:", error);
        }
    }

    abrirModalGeneral() {
        this.modalCtrl.renderResumenGeneral(this.state.unidad, this.state.modulo || 'capex', this.dbManager, this.state.mes);
    }

    abrirModalPantallas() {
        const pantallas = this.dbManager.getPantallasPorUnidad(this.state.unidad);
        this.modalCtrl.renderGridPantallas(pantallas, (id) => {
            const p = pantallas.find(x => x.id === id);
            this.modalCtrl.renderExpedienteCompleto(p, this.dbManager.diccionarios, this.state.mes);
        });
    }

    initBuscador() {
        const input = document.getElementById('global-search');
        const dropdown = document.getElementById('search-dropdown');
        if(!input) return;
        input.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            if (q.length < 2) return dropdown.classList.remove('active');
            const res = this.dbManager.rawData.filter(p => p.nombre.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
            dropdown.innerHTML = res.map(p => `<div class="search-item" onclick="app.verExpedienteBusqueda('${p.id}')"><b>${p.id}</b><br><small>${p.nombre}</small></div>`).join('');
            dropdown.classList.add('active');
        });
    }

    verExpedienteBusqueda(id) {
        const p = this.dbManager.rawData.find(x => x.id === id);
        this.modalCtrl.renderExpedienteCompleto(p, this.dbManager.diccionarios, this.state.mes);
        document.getElementById('search-dropdown').classList.remove('active');
        document.getElementById('global-search').value = '';
    }
}
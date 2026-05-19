import DatabaseManager from '../data/DatabaseManager.js';
import ModalController from '../ui/ModalController.js';
import DiagramRenderer from '../ui/DiagramRenderer.js';

const normalizarFiltro = (texto) => (texto || '').toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, "");

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
            componente: '',
            pantalla: '',
            meses: ['all'] 
        };

        window.addEventListener('resize', () => this.renderer.drawLines());
        window.app = this;

        setTimeout(() => {
            document.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const target = e.target.dataset.target;
                    if (target) this.cerrarModal(target);
                });
            });
        }, 100);
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
        const logos = { eco: 'assets/logos/ecovallas.png', vv: 'assets/logos/viaverde.png', bb: 'assets/logos/biobox.png' };
        
        root.style.setProperty('--theme-color', `var(${colors[theme]})`);
        root.style.setProperty('--theme-light', `var(${lights[theme]})`);

        const lblUnidad = document.getElementById('lbl-unidad');
        if (lblUnidad) {
            const numPantallas = this.dbManager.getPantallasPorUnidad(unidad).length;
            lblUnidad.innerHTML = `<img src="${logos[theme]}" alt="${unidad}" style="max-height: 45px; width: auto; object-fit: contain; vertical-align: middle; margin-right: 10px;"> 
            <span style="font-size:1rem; font-weight:800; color:var(--theme-color);">(${numPantallas} Equipos)</span>`;
        }

        document.getElementById('intro-view').classList.add('fade-out');
        document.getElementById('canvas-view').classList.add('active');
        
        this.renderMultiMonthSelector();
        this.construirNivel1();
    }

    volver() {
        document.getElementById('intro-view').classList.remove('fade-out');
        document.getElementById('canvas-view').classList.remove('active');
        const selector = document.getElementById('month-selector-container');
        if (selector) selector.style.display = 'none';
        this.renderer.clearAll();
    }

    cerrarPanel(nivel) {
        if (nivel === 5) this.state.pantalla = '';
        if (nivel === 4) { this.state.componente = ''; this.state.pantalla = ''; }
        this.renderer.removeColumnsAfter(nivel - 1);
        this.renderer.deselectNodes(nivel - 1);
    }

    cerrarModal(idModal) {
        const modal = document.getElementById(idModal);
        if (modal) modal.classList.remove('active');
    }

    renderMultiMonthSelector() {
        let container = document.getElementById('month-selector-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'month-selector-container';
            container.style.cssText = 'background: white; padding: 8px 15px; border-radius: 8px; border: 1px solid var(--theme-light); font-family: sans-serif; display: flex; align-items: center; gap: 15px; margin-left: 20px;';
            
            container.innerHTML = `
                <label style="font-weight: 900; color: var(--theme-color); font-size: 0.85rem; margin:0; text-transform:uppercase;">Filtrar Meses:</label>
                <div style="display:flex; gap: 12px; font-size: 0.85rem; font-weight: 600; color: #475569;" id="multi-month-checks">
                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px;"><input type="checkbox" value="all" checked> Consolidado</label>
                    <div style="width: 1px; background: #cbd5e1; height: 15px;"></div>
                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px;"><input type="checkbox" value="enero"> Ene</label>
                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px;"><input type="checkbox" value="febrero"> Feb</label>
                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px;"><input type="checkbox" value="marzo"> Mar</label>
                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px;"><input type="checkbox" value="abril"> Abr</label>
                    <label style="cursor:pointer; display:flex; align-items:center; gap:4px;"><input type="checkbox" value="mayo"> May</label>
                </div>
            `;
            
            const searchInput = document.getElementById('global-search');
            if (searchInput && searchInput.parentElement) searchInput.parentElement.insertAdjacentElement('afterend', container);
            else document.getElementById('canvas-view').appendChild(container);

            container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.addEventListener('change', (e) => this.cambiarMultiMes(e.target));
            });
        }
        container.style.display = 'flex';
    }

    cambiarMultiMes(clickedCheckbox) {
        const checkboxes = document.querySelectorAll('#multi-month-checks input[type="checkbox"]');
        
        if (clickedCheckbox.value === 'all' && clickedCheckbox.checked) {
            checkboxes.forEach(cb => { if(cb.value !== 'all') cb.checked = false; });
            this.state.meses = ['all'];
        } else {
            document.querySelector('#multi-month-checks input[value="all"]').checked = false;
            let seleccionados = [];
            checkboxes.forEach(cb => { if (cb.checked) seleccionados.push(cb.value); });
            
            if (seleccionados.length === 0) {
                document.querySelector('#multi-month-checks input[value="all"]').checked = true;
                this.state.meses = ['all'];
            } else {
                this.state.meses = seleccionados;
            }
        }

        const ruta = {
            modulo: this.state.modulo,
            subModulo: this.state.subModulo,
            componente: this.state.componente,
            pantalla: this.state.pantalla
        };

        this.construirNivel1();

        if (ruta.modulo) {
            setTimeout(() => {
                const nodoMod = document.querySelector(`.column[data-lvl="1"] .node[onclick*="'${ruta.modulo}'"]`);
                if (nodoMod) {
                    this.seleccionarModulo(ruta.modulo, nodoMod);
                    if (ruta.subModulo) {
                        setTimeout(() => {
                            const nodoSub = document.querySelector(`.column[data-lvl="2"] .node[onclick*="'${ruta.subModulo}'"]`);
                            if (nodoSub) {
                                this.renderSubMantenimiento(ruta.subModulo, nodoSub);
                                if (ruta.componente) {
                                    setTimeout(() => {
                                        const nodoComp = document.querySelector(`.column[data-lvl="3"] .node[onclick*="'${ruta.componente}'"]`);
                                        if (nodoComp) {
                                            this.seleccionarComponente(ruta.componente, nodoComp);
                                            if (ruta.pantalla) {
                                                setTimeout(() => {
                                                    const nodoPant = document.querySelector(`.column[data-lvl="4"] .node[onclick*="'${ruta.pantalla}'"]`);
                                                    if (nodoPant) this.seleccionarPantalla(ruta.pantalla, nodoPant);
                                                }, 80);
                                            }
                                        }
                                    }, 80);
                                }
                            }
                        }, 80);
                    } else if (ruta.componente) {
                        setTimeout(() => {
                            const nodoComp = document.querySelector(`.column[data-lvl="2"] .node[onclick*="'${ruta.componente}'"]`);
                            if (nodoComp) {
                                this.seleccionarComponente(ruta.componente, nodoComp);
                                if (ruta.pantalla) {
                                    setTimeout(() => {
                                        const nodoPant = document.querySelector(`.column[data-lvl="3"] .node[onclick*="'${ruta.pantalla}'"]`);
                                        if (nodoPant) this.seleccionarPantalla(ruta.pantalla, nodoPant);
                                    }, 80);
                                }
                            }
                        }, 80);
                    }
                }
            }, 80);
        }

        if (document.getElementById('modal-data') && document.getElementById('modal-data').classList.contains('active')) {
            this.abrirModalGeneral();
        }
    }

    construirNivel1() {
        this.renderer.clearAll();
        const html = `
            <div class="node" onclick="app.seleccionarModulo('capex', this)">
                <div class="node-title">CAPEX</div>
                <div class="node-sub">Inversión Fija</div>
            </div>
            <div class="node" onclick="app.seleccionarModulo('operacion', this)">
                <div class="node-title">OPERACIÓN</div>
                <div class="node-sub">Flujo de Gastos</div>
            </div>
            <div class="node" onclick="app.seleccionarModulo('mantenimiento', this)">
                <div class="node-title">MANTENIMIENTO</div>
                <div class="node-sub">Previsión e Incidencias</div>
            </div>
        `;
        this.renderer.createColumn(1, "MÓDULOS", html);
    }

    seleccionarModulo(modulo, nodeEl) {
        this.state.modulo = modulo;
        this.state.subModulo = '';
        this.state.componente = '';
        this.state.pantalla = '';
        this.renderer.deselectNodes(1); 
        nodeEl.classList.add('selected'); 
        this.renderer.removeColumnsAfter(1);
        
        const suffix = modulo === 'mantenimiento' ? ' Tickets' : '';
        
        if (modulo === 'mantenimiento') {
            const conteosMantto = this.dbManager.getConteosConsolidados(this.state.unidad, 'mantenimiento', this.state.meses);
            const preventivoTotal = (conteosMantto.estetico || 0) + (conteosMantto.profundo || 0) + (conteosMantto.software || 0);
            const correctivoTotal = (conteosMantto.tickets || 0) + (conteosMantto.modificacionEstructura || 0);

            const html = `
                <div class="node" onclick="app.renderSubMantenimiento('preventivo', this)">
                    <div class="node-title">Preventivo</div>
                    <div class="node-sub">Rutina y Software</div>
                    <div class="node-val">${preventivoTotal}${suffix}</div>
                </div>
                <div class="node" onclick="app.renderSubMantenimiento('correctivo', this)">
                    <div class="node-title">Correctivo</div>
                    <div class="node-sub">Incidencias y Adecuaciones</div>
                    <div class="node-val">${correctivoTotal}${suffix}</div>
                </div>
            `;
            this.renderer.createColumn(2, "TIPO MANTTO.", html);
        } else {
            const conteos = this.dbManager.getConteosConsolidados(this.state.unidad, modulo, this.state.meses);
            const dicc = this.dbManager.diccionarios[modulo];
            const html = Object.keys(dicc).map(k => `
                <div class="node" onclick="app.seleccionarComponente('${k}', this)">
                    <div class="node-title">${typeof dicc[k] === 'object' ? dicc[k].label : dicc[k]}</div>
                    <div class="node-val">${conteos[k] || 0}${suffix}</div>
                </div>
            `).join('');
            this.renderer.createColumn(2, "ANÁLISIS DE " + modulo.toUpperCase(), html);
        }
    }

    renderSubMantenimiento(tipo, nodeEl) {
        this.state.subModulo = tipo;
        this.state.componente = '';
        this.state.pantalla = '';
        this.renderer.deselectNodes(2); 
        nodeEl.classList.add('selected'); 
        this.renderer.removeColumnsAfter(2);

        const subDicc = this.dbManager.diccionarios.mantenimiento[tipo].sub;
        const conteosDinamicos = this.dbManager.getConteosConsolidados(this.state.unidad, 'mantenimiento', this.state.meses);

        const html = Object.keys(subDicc).map(k => {
            if (k === 'modificacionEstructura' && !this.state.meses.includes('all') && (conteosDinamicos[k] || 0) === 0) return '';
            return `
            <div class="node" onclick="app.seleccionarComponente('${k}', this)">
                <div class="node-title">${subDicc[k]}</div>
                <div class="node-val">${conteosDinamicos[k] || 0} Registros</div>
            </div>
            `;
        }).join('');
        this.renderer.createColumn(3, "SUB-RUBRO", html);
    }

    dibujarGraficaPastel(canvasId, datos, colores) {
        setTimeout(() => {
            const canvas = document.getElementById(canvasId);
            if (!canvas) return;
            const ctx = canvas.getContext('2d');
            const total = datos.reduce((a, b) => a + b, 0);
            if (total === 0) return;
            
            const centroX = canvas.width / 2;
            const centroY = canvas.height / 2;
            const radio = Math.min(centroX, centroY) - 10;
            const radioInterno = radio * 0.6;
            
            let anguloInicio = -Math.PI / 2;
            
            datos.forEach((valor, i) => {
                const angulo = (valor / total) * 2 * Math.PI;
                
                ctx.beginPath();
                ctx.arc(centroX, centroY, radio, anguloInicio, anguloInicio + angulo);
                ctx.arc(centroX, centroY, radioInterno, anguloInicio + angulo, anguloInicio, true);
                ctx.closePath();
                ctx.fillStyle = colores[i];
                ctx.fill();
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.stroke();
                
                const pct = ((valor / total) * 100).toFixed(0);
                if (parseInt(pct) > 5) {
                    const textoAngulo = anguloInicio + angulo / 2;
                    const textoX = centroX + Math.cos(textoAngulo) * (radio * 0.8);
                    const textoY = centroY + Math.sin(textoAngulo) * (radio * 0.8);
                    
                    ctx.fillStyle = '#fff';
                    ctx.font = 'bold 10px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(pct + '%', textoX, textoY);
                }
                
                anguloInicio += angulo;
            });
            
            ctx.beginPath();
            ctx.arc(centroX, centroY, radioInterno - 2, 0, 2 * Math.PI);
            ctx.fillStyle = '#fff';
            ctx.fill();
            
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(total, centroX, centroY);
            ctx.font = '8px Inter, sans-serif';
            ctx.fillText('Total', centroX, centroY + 14);
        }, 100);
    }

seleccionarComponente(key, nodeEl) {
    this.state.componente = key;
    this.state.pantalla = '';
    const lvl = parseInt(nodeEl.closest('.column').dataset.lvl);
    this.renderer.deselectNodes(lvl); 
    nodeEl.classList.add('selected'); 
    this.renderer.removeColumnsAfter(lvl); 

    let dicc = this.dbManager.diccionarios[this.state.modulo];
    if (this.state.modulo === 'mantenimiento') dicc = this.dbManager.diccionarios.mantenimiento[this.state.subModulo].sub;
    
    const tituloBruto = dicc[key];
    const tituloComp = typeof tituloBruto === 'object' ? tituloBruto.label : (tituloBruto || key);

    const stats = this.dbManager.getStatsComponente(this.state.unidad, this.state.modulo, key, this.state.meses);
    const pantallas = this.dbManager.getPantallasPorUnidad(this.state.unidad);
    const mesBuscado = this.state.meses;
    const totalPantallasUnidad = pantallas.length;

    // 📊 CALCULAR TOTALES REALES DESDE DATOS TÉCNICOS (inventario_tecnico.csv)
    let totalesReales = {
        pantallas: 0,
        nucs: 0,
        redundancias: 0,
        sd300: 0,
        ups: 0,
        fibraOptica: 0,
        camaras: 0,
        poe: 0,
        interruptoresTri: 0,
        interruptores20A: 0,
        marcas: {},
        medidasM2: {},
        pitchs: {},
        renovaciones: 0,
        nucOptimo: 0,
        nucVulnerable: 0,
        sd300Optimo: 0,
        sd300Vulnerable: 0,
        upsOptimo: 0,
        upsVulnerable: 0,
        camaraOptimo: 0,
        camaraVulnerable: 0,
        poeOptimo: 0,
        poeVulnerable: 0,
        redundanciaOptimo: 0,
        redundanciaVulnerable: 0
    };

    pantallas.forEach(p => {
        const dt = p.datosTecnicos || {};
        Object.values(dt).forEach(cara => {
            // Contar pantallas
            totalesReales.pantallas += parseInt(cara.pantallas) || 0;
            
            // Contar NUCs
            if (cara.nucMarca && cara.nucMarca.trim()) {
                totalesReales.nucs++;
                if (cara.nucEstado && cara.nucEstado.toLowerCase().includes('optimo')) totalesReales.nucOptimo++;
                if (cara.nucEstado && cara.nucEstado.toLowerCase().includes('vulnerable')) totalesReales.nucVulnerable++;
            }
            
            // Contar Redundancias
            if (cara.redundancia && cara.redundancia.trim()) {
                totalesReales.redundancias++;
                if (cara.redundanciaEstado && cara.redundanciaEstado.toLowerCase().includes('optimo')) totalesReales.redundanciaOptimo++;
                if (cara.redundanciaEstado && cara.redundanciaEstado.toLowerCase().includes('vulnerable')) totalesReales.redundanciaVulnerable++;
            }
            
            // Contar SD300
            if (cara.sd300 && cara.sd300.trim()) {
                totalesReales.sd300++;
                if (cara.sd300Estado && cara.sd300Estado.toLowerCase().includes('optimo')) totalesReales.sd300Optimo++;
                if (cara.sd300Estado && cara.sd300Estado.toLowerCase().includes('vulnerable')) totalesReales.sd300Vulnerable++;
            }
            
            // Contar UPS
            if (cara.ups && cara.ups.trim()) {
                totalesReales.ups++;
                if (cara.upsEstado && cara.upsEstado.toLowerCase().includes('optimo')) totalesReales.upsOptimo++;
                if (cara.upsEstado && cara.upsEstado.toLowerCase().includes('vulnerable')) totalesReales.upsVulnerable++;
            }
            
            // Contar Fibra Óptica
            if (cara.internetFibra && cara.internetFibra.trim() && cara.internetFibra.toLowerCase() !== 'n/a') {
                totalesReales.fibraOptica++;
            }
            
            // Contar Cámaras
            if (cara.camara && cara.camara.trim()) {
                totalesReales.camaras++;
                if (cara.camaraEstado && cara.camaraEstado.toLowerCase().includes('optimo')) totalesReales.camaraOptimo++;
                if (cara.camaraEstado && cara.camaraEstado.toLowerCase().includes('vulnerable')) totalesReales.camaraVulnerable++;
            }
            
            // Contar POE
            if (cara.poe && cara.poe.trim()) {
                totalesReales.poe++;
                if (cara.poeEstado && cara.poeEstado.toLowerCase().includes('optimo')) totalesReales.poeOptimo++;
                if (cara.poeEstado && cara.poeEstado.toLowerCase().includes('vulnerable')) totalesReales.poeVulnerable++;
            }
            
            // Contar Interruptores
            if (cara.interruptorTri) totalesReales.interruptoresTri += parseInt(cara.interruptorTri) || 0;
            if (cara.interruptor20A) totalesReales.interruptores20A += parseInt(cara.interruptor20A) || 0;
            
            // Marcas
            if (cara.marca && cara.marca.trim()) {
                totalesReales.marcas[cara.marca] = (totalesReales.marcas[cara.marca] || 0) + 1;
            }
            
            // Medidas m²
            if (cara.medidaM2) {
                const m2 = parseFloat(cara.medidaM2) || 0;
                if (m2 > 0) totalesReales.medidasM2[m2] = (totalesReales.medidasM2[m2] || 0) + 1;
            }
            
            // Pitch
            if (cara.pitch && cara.pitch.trim()) {
                totalesReales.pitchs[cara.pitch.trim()] = (totalesReales.pitchs[cara.pitch.trim()] || 0) + 1;
            }
            
            // Renovaciones
            if (cara.fechaRenovacion && cara.fechaRenovacion.trim()) {
                totalesReales.renovaciones++;
            }
        });
    });

    const suffix = this.state.modulo === 'mantenimiento' ? 'Tickets' : 'Equipos';
    
    // Generar lista de marcas para mostrar
    const marcasUnicas = Object.keys(totalesReales.marcas).sort((a, b) => totalesReales.marcas[b] - totalesReales.marcas[a]);
    const marcasHTML = marcasUnicas.length > 0 
        ? marcasUnicas.map(m => `<span style="background:#d1fae5; color:#065f46; padding:2px 8px; border-radius:10px; font-size:0.65rem; font-weight:600; margin:2px; display:inline-block;">${m}: ${totalesReales.marcas[m]}</span>`).join(' ')
        : '<span style="color:#94a3b8; font-size:0.7rem;">N/D</span>';

    // Generar lista de pitchs
    const pitchsUnicos = Object.keys(totalesReales.pitchs).sort();
    const pitchsHTML = pitchsUnicos.length > 0
        ? pitchsUnicos.map(p => `<span style="background:#e0e7ff; color:#3730a3; padding:2px 8px; border-radius:10px; font-size:0.65rem; font-weight:600; margin:2px; display:inline-block;">${p}: ${totalesReales.pitchs[p]}</span>`).join(' ')
        : '<span style="color:#94a3b8; font-size:0.7rem;">N/D</span>';

    // Generar lista de medidas m²
    const medidasUnicas = Object.keys(totalesReales.medidasM2).sort((a, b) => parseFloat(a) - parseFloat(b));
    const medidasHTML = medidasUnicas.length > 0
        ? medidasUnicas.map(m => `<span style="background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:10px; font-size:0.65rem; font-weight:600; margin:2px; display:inline-block;">${m}m²: ${totalesReales.medidasM2[m]}</span>`).join(' ')
        : '<span style="color:#94a3b8; font-size:0.7rem;">N/D</span>';

    const ubicacionesConValor = pantallas.map(p => {
        let valor = 0;
        if (this.state.modulo === 'operacion') {
            valor = (p.gastosOperacion || []).filter(op => mesBuscado.includes('all') || mesBuscado.includes(op.mes)).reduce((acc, op) => acc + (Number(op[key]) || 0), 0);
        } else if (this.state.modulo === 'mantenimiento') {
            const tkM = (p.tickets || []).filter(tk => mesBuscado.includes('all') || mesBuscado.includes(tk.mes));
            if (key === 'estetico') valor = tkM.filter(tk => normalizarFiltro(tk.actividad).includes('estetico')).reduce((acc, tk) => acc + (Number(tk.costoManttoOriginal) || 0), 0);
            else if (key === 'software') valor = tkM.filter(tk => normalizarFiltro(tk.actividad).includes('software')).reduce((acc, tk) => acc + (Number(tk.costoManttoOriginal) || 0), 0);
            else if (key === 'profundo') valor = tkM.filter(tk => normalizarFiltro(tk.actividad).includes('profundo')).reduce((acc, tk) => acc + (Number(tk.costoManttoOriginal) || 0), 0);
            else if (key === 'tickets') valor = tkM.filter(tk => {
                const n = normalizarFiltro(tk.actividad);
                return !n.includes('estetico') && !n.includes('software') && !n.includes('profundo') && !n.includes('modificaciondeestructura');
            }).reduce((acc, tk) => acc + (Number(tk.costoManttoOriginal) || 0), 0);
            else if (key === 'modificacionEstructura') {
                const tksFilt = tkM.filter(tk => normalizarFiltro(tk.actividad).includes('modificaciondeestructura'));
                valor = tksFilt.reduce((acc, tk) => acc + (Number(tk.costoManttoOriginal) || 0), 0);
            }
        } else {
            if (p.carasVV) {
                Object.values(p.carasVV).forEach(cara => { valor += (Number(cara[key]) || 0); });
            } else {
                valor = Number(p.capex[key]) || 0;
            }
        }
        return { ...p, valor };
    });

    const conValor = ubicacionesConValor.filter(p => p.valor > 0).sort((a, b) => b.valor - a.valor);
    const sinValor = ubicacionesConValor.filter(p => p.valor === 0).sort((a, b) => a.id.localeCompare(b.id));
    const ubicacionesOrdenadas = [...conValor, ...sinValor];

    const listaHTML = ubicacionesOrdenadas.map((p) => {
        const tieneValor = p.valor > 0;
        return `
        <div class="node ubicacion-item" data-id="${p.id}" data-key="${key}" 
            style="padding: 10px 15px; cursor: pointer; border-bottom: 1px solid #f1f5f9; transition: 0.15s; ${!tieneValor ? 'opacity: 0.5;' : ''}"
            onclick="app.mostrarDetalleUbicacion('${key}', '${p.id}')"
            onmouseover="this.style.background='#f8fafc'" 
            onmouseout="this.style.background='#fff'">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div class="node-title" style="font-size: 0.85rem; font-weight: 700; color: #1e293b;">${p.id}</div>
                    <div class="node-sub" style="font-size: 0.7rem; color: #64748b;">${p.nombre}</div>
                </div>
                <div class="node-val" style="font-size: 0.85rem; font-weight: 700; color: ${tieneValor ? 'var(--theme-color)' : '#94a3b8'};">
                    ${tieneValor ? this.formatMoney(p.valor) : 'Sin datos'}
                </div>
            </div>
        </div>`;
    }).join('');

    const html = `
        <div style="padding: 12px 15px; background: var(--theme-color); color: #fff; text-align: center; font-weight: 800; cursor: pointer; border-radius: 6px 6px 0 0; min-width: 750px;" onclick="app.cerrarPanel(${lvl+1})">
            ⬅ REGRESAR
        </div>
        <div style="display: flex; min-width: 750px; max-height: 70vh;">
            <!-- PANEL IZQUIERDO: FICHA + LISTA -->
            <div style="flex: 1; display: flex; flex-direction: column; border-right: 1px solid #e2e8f0;">
                <div style="padding: 20px; background: #f8fafc; border-bottom: 2px solid var(--theme-color);">
                    <div style="font-size: 0.75rem; color: var(--theme-color); font-weight: 900; text-transform: uppercase;">FICHA ANALÍTICA</div>
                    <div style="font-size: 1.2rem; font-weight: 900; color: #1e293b; margin-bottom: 15px;">${tituloComp}</div>
                    
                    <!-- KPI PRINCIPALES -->
                    <div style="display: flex; gap: 12px; margin-bottom: 15px;">
                        <div style="flex: 1; background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                            <div style="font-size: 0.6rem; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">📺 Total Pantallas</div>
                            <div style="font-size: 1.4rem; font-weight: 900; color: #1e293b;">${totalesReales.pantallas || totalPantallasUnidad}</div>
                        </div>
                        <div style="flex: 1; background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                            <div style="font-size: 0.6rem; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">💰 Costo Total</div>
                            <div style="font-size: 1.2rem; font-weight: 900; color: var(--theme-color);">${this.formatMoney(stats.totalCost)}</div>
                        </div>
                        <div style="flex: 1; background: #fff; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; text-align: center;">
                            <div style="font-size: 0.6rem; color: #64748b; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">📊 Promedio</div>
                            <div style="font-size: 1.1rem; font-weight: 900; color: #334155;">${stats.totalCount > 0 ? this.formatMoney(stats.totalCost/stats.totalCount) : '$0'}</div>
                        </div>
                    </div>
                    
                    <!-- COMPONENTES DEL INVENTARIO TÉCNICO -->
                    <div style="background:#fff; padding:15px; border-radius:8px; border:1px solid #e2e8f0; margin-bottom:15px;">
                        <div style="font-size:0.7rem; font-weight:800; color:#334155; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
                            🔧 INVENTARIO TÉCNICO
                        </div>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.7rem;">
                            <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#f8fafc; border-radius:4px;">
                                <span style="color:#64748b;">🔌 NUCs:</span>
                                <span style="font-weight:700;">${totalesReales.nucs} <span style="font-size:0.6rem; color:#10b981;">(${totalesReales.nucOptimo} OK)</span></span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#f8fafc; border-radius:4px;">
                                <span style="color:#64748b;">📡 SD300:</span>
                                <span style="font-weight:700;">${totalesReales.sd300} <span style="font-size:0.6rem; color:#10b981;">(${totalesReales.sd300Optimo} OK)</span></span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#f8fafc; border-radius:4px;">
                                <span style="color:#64748b;">🔋 UPS:</span>
                                <span style="font-weight:700;">${totalesReales.ups} <span style="font-size:0.6rem; color:#10b981;">(${totalesReales.upsOptimo} OK)</span></span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#f8fafc; border-radius:4px;">
                                <span style="color:#64748b;">🌐 Redundancia:</span>
                                <span style="font-weight:700;">${totalesReales.redundancias} <span style="font-size:0.6rem; color:#10b981;">(${totalesReales.redundanciaOptimo} OK)</span></span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#f8fafc; border-radius:4px;">
                                <span style="color:#64748b;">📷 Cámaras:</span>
                                <span style="font-weight:700;">${totalesReales.camaras} <span style="font-size:0.6rem; color:#10b981;">(${totalesReales.camaraOptimo} OK)</span></span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#f8fafc; border-radius:4px;">
                                <span style="color:#64748b;">🔌 POE:</span>
                                <span style="font-weight:700;">${totalesReales.poe} <span style="font-size:0.6rem; color:#10b981;">(${totalesReales.poeOptimo} OK)</span></span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#f8fafc; border-radius:4px;">
                                <span style="color:#64748b;">📡 Fibra Óptica:</span>
                                <span style="font-weight:700;">${totalesReales.fibraOptica}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#f8fafc; border-radius:4px;">
                                <span style="color:#64748b;">⚡ Int. 3x100A:</span>
                                <span style="font-weight:700;">${totalesReales.interruptoresTri}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#f8fafc; border-radius:4px;">
                                <span style="color:#64748b;">⚡ Int. 2x20A:</span>
                                <span style="font-weight:700;">${totalesReales.interruptores20A}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; padding:4px 6px; background:#f8fafc; border-radius:4px;">
                                <span style="color:#64748b;">🔄 Renovaciones:</span>
                                <span style="font-weight:700;">${totalesReales.renovaciones}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- MARCAS -->
                    <div style="background:#fff; padding:10px 12px; border-radius:6px; border:1px solid #e2e8f0; margin-bottom:8px;">
                        <div style="font-size:0.65rem; color:#64748b; font-weight:700; margin-bottom:5px;">🏷️ MARCAS</div>
                        <div style="display:flex; flex-wrap:wrap; gap:3px;">${marcasHTML}</div>
                    </div>
                    
                    <!-- PITCH -->
                    <div style="background:#fff; padding:10px 12px; border-radius:6px; border:1px solid #e2e8f0; margin-bottom:8px;">
                        <div style="font-size:0.65rem; color:#64748b; font-weight:700; margin-bottom:5px;">📏 PITCH</div>
                        <div style="display:flex; flex-wrap:wrap; gap:3px;">${pitchsHTML}</div>
                    </div>
                    
                    <!-- MEDIDAS M² -->
                    <div style="background:#fff; padding:10px 12px; border-radius:6px; border:1px solid #e2e8f0; margin-bottom:8px;">
                        <div style="font-size:0.65rem; color:#64748b; font-weight:700; margin-bottom:5px;">📐 MEDIDAS m²</div>
                        <div style="display:flex; flex-wrap:wrap; gap:3px;">${medidasHTML}</div>
                    </div>
                    
                    ${stats.maxSpender.id ? `
                    <div style="margin-top: 10px; background: #fff; padding: 12px; border-left: 4px solid #f59e0b; border-radius: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                        <div style="color: #227304; font-weight: 900; font-size: 0.7rem; margin-bottom: 4px;">Inversión</div>
                        <div style="font-weight: 800; font-size: 0.9rem; color: #1e293b;">${stats.maxSpender.id}</div>
                        <div style="font-size: 0.7rem; color: #64748b;">Gasto: <b>${this.formatMoney(stats.maxSpender.costo)}</b></div>
                    </div>` : ''}
                </div>
                
                <!-- BUSCADOR -->
                <div style="padding: 10px 15px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0;">
                    <input type="text" id="buscador-ubicaciones-${key}" placeholder="🔍 Buscar ubicación por ID o nombre..." 
                        style="width: 100%; padding: 8px 12px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 0.8rem; font-family: Inter, sans-serif;"
                        oninput="app.filtrarUbicaciones('${key}', this.value)">
                </div>
                
                <!-- LISTA DE UBICACIONES -->
                <div style="flex: 1; overflow-y: auto; max-height: 30vh;" id="lista-ubicaciones-${key}">
                    ${listaHTML}
                </div>
            </div>
            
            <!-- PANEL DERECHO: DETALLE -->
            <div style="flex: 1; padding: 20px; overflow-y: auto; background: #fff;" id="detalle-ubicacion-${key}">
                <div style="text-align: center; color: #94a3b8; padding: 40px 20px;">
                    <div style="font-size: 3rem; margin-bottom: 10px;">📍</div>
                    <div style="font-size: 0.9rem; font-weight: 600;">Seleccione una ubicación</div>
                    <div style="font-size: 0.75rem; margin-top: 5px;">Haga clic en una ubicación de la lista para ver su detalle completo</div>
                </div>
            </div>
        </div>
    `;

    this.renderer.createColumn(lvl + 1, "INVENTARIO Y ANÁLISIS", html);
}

    filtrarUbicaciones(key, query) {
        const lista = document.getElementById(`lista-ubicaciones-${key}`);
        if (!lista) return;
        const items = lista.querySelectorAll('.ubicacion-item');
        const q = query.toLowerCase().trim();
        
        items.forEach(item => {
            const id = (item.dataset.id || '').toLowerCase();
            const nombre = (item.querySelector('.node-sub')?.textContent || '').toLowerCase();
            if (q === '' || id.includes(q) || nombre.includes(q)) {
                item.style.display = '';
            } else {
                item.style.display = 'none';
            }
        });
    }

    mostrarDetalleUbicacion(key, idPantalla) {
        const p = this.dbManager.rawData.find(x => x.id === idPantalla);
        if (!p) return;
        
        const detalleDiv = document.getElementById(`detalle-ubicacion-${key}`);
        if (!detalleDiv) return;
        
        const lista = document.getElementById(`lista-ubicaciones-${key}`);
        if (lista) {
            lista.querySelectorAll('.ubicacion-item').forEach(item => {
                item.style.background = '#fff';
                item.style.borderLeft = 'none';
            });
            const selected = lista.querySelector(`[data-id="${idPantalla}"]`);
            if (selected) {
                selected.style.background = '#f0fdf4';
                selected.style.borderLeft = '3px solid var(--theme-color)';
            }
        }
        
        let valorComponente = 0;
        const mesBuscado = this.state.meses;
        const keyComp = this.state.componente;
        if (this.state.modulo === 'operacion') {
            valorComponente = (p.gastosOperacion || []).filter(op => mesBuscado.includes('all') || mesBuscado.includes(op.mes)).reduce((acc, op) => acc + (Number(op[keyComp]) || 0), 0);
        } else if (this.state.modulo === 'mantenimiento') {
            const tkM = (p.tickets || []).filter(tk => mesBuscado.includes('all') || mesBuscado.includes(tk.mes));
            if (keyComp === 'estetico') valorComponente = tkM.filter(tk => normalizarFiltro(tk.actividad).includes('estetico')).reduce((acc, tk) => acc + (Number(tk.costoManttoOriginal) || 0), 0);
            else if (keyComp === 'software') valorComponente = tkM.filter(tk => normalizarFiltro(tk.actividad).includes('software')).reduce((acc, tk) => acc + (Number(tk.costoManttoOriginal) || 0), 0);
            else if (keyComp === 'profundo') valorComponente = tkM.filter(tk => normalizarFiltro(tk.actividad).includes('profundo')).reduce((acc, tk) => acc + (Number(tk.costoManttoOriginal) || 0), 0);
            else if (keyComp === 'tickets') valorComponente = tkM.filter(tk => {
                const n = normalizarFiltro(tk.actividad);
                return !n.includes('estetico') && !n.includes('software') && !n.includes('profundo') && !n.includes('modificaciondeestructura');
            }).reduce((acc, tk) => acc + (Number(tk.costoManttoOriginal) || 0), 0);
            else if (keyComp === 'modificacionEstructura') {
                const tksFilt = tkM.filter(tk => normalizarFiltro(tk.actividad).includes('modificaciondeestructura'));
                valorComponente = tksFilt.reduce((acc, tk) => acc + (Number(tk.costoManttoOriginal) || 0), 0);
            }
        } else {
            if (p.carasVV) Object.values(p.carasVV).forEach(cara => { valorComponente += (Number(cara[keyComp]) || 0); });
            else valorComponente = Number(p.capex[keyComp]) || 0;
        }
        
        const datosTec = p.datosTecnicos || {};
        const caras = Object.keys(datosTec);
        
        let htmlDatosTecnicos = '';
        if (caras.length > 0) {
            htmlDatosTecnicos = caras.map(cara => {
                const dt = datosTec[cara];
                const estadoBadge = (estado) => {
                    if (!estado) return '<span style="color:#94a3b8;">N/D</span>';
                    const e = estado.toLowerCase().trim();
                    const color = e === 'optimo' ? '#10b981' : e === 'vulnerable' ? '#ef4444' : '#f59e0b';
                    return `<span style="background:${color}; color:#fff; padding:2px 8px; border-radius:10px; font-size:0.65rem; font-weight:700;">${estado.toUpperCase()}</span>`;
                };
                
                return `
                <div style="background:#f8fafc; padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid #e2e8f0;">
                    <div style="font-weight:800; color:var(--theme-color); font-size:0.8rem; margin-bottom:10px; border-bottom:1px solid #e2e8f0; padding-bottom:6px;">
                        📐 CARA ${cara.toUpperCase()}
                    </div>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; font-size:0.7rem;">
                        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f1f5f9;">
                            <span style="color:#64748b;">Pantallas:</span>
                            <span style="font-weight:700;">${dt.pantallas || '1'}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f1f5f9;">
                            <span style="color:#64748b;">Marca:</span>
                            <span style="font-weight:700;">${dt.marca || 'N/D'}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f1f5f9;">
                            <span style="color:#64748b;">Pitch:</span>
                            <span style="font-weight:700;">${dt.pitch || 'N/D'}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f1f5f9;">
                            <span style="color:#64748b;">Medida m²:</span>
                            <span style="font-weight:700;">${dt.medidaM2 || 'N/D'}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f1f5f9;">
                            <span style="color:#64748b;">Gabinetes:</span>
                            <span style="font-weight:700;">${dt.numGabinetes || 'N/D'}</span>
                        </div>
                        <div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid #f1f5f9;">
                            <span style="color:#64748b;">Renovación:</span>
                            <span style="font-weight:700; font-size:0.65rem;">${dt.fechaRenovacion || 'Sin fecha'}</span>
                        </div>
                    </div>
                    
                    <div style="margin-top:10px; border-top:1px solid #e2e8f0; padding-top:8px;">
                        <div style="font-size:0.7rem; font-weight:700; color:#334155; margin-bottom:6px;">🔌 ESTADO DE COMPONENTES</div>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; font-size:0.65rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>NUC:</span>${estadoBadge(dt.nucEstado)}
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>NUC Marca:</span><span style="font-weight:600;">${dt.nucMarca || 'N/D'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>Redundancia:</span>${estadoBadge(dt.redundanciaEstado)}
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>Red:</span><span style="font-weight:600;">${dt.redundancia || 'N/D'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>SD 300:</span>${estadoBadge(dt.sd300Estado)}
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>UPS:</span>${estadoBadge(dt.upsEstado)}
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>Fibra:</span><span style="font-weight:600;">${dt.internetFibra || 'N/D'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>Cámara:</span>${estadoBadge(dt.camaraEstado)}
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>Cámara Mod:</span><span style="font-weight:600; font-size:0.6rem;">${dt.camara || 'N/D'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>POE:</span>${estadoBadge(dt.poeEstado)}
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>Interruptor 3x100:</span><span style="font-weight:600;">${dt.interruptorTri || '1'}</span>
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; padding:3px 0;">
                                <span>Interruptor 2x20:</span><span style="font-weight:600;">${dt.interruptor20A || '8'}</span>
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        } else {
            htmlDatosTecnicos = `
            <div style="text-align:center; padding:15px; color:#94a3b8; font-size:0.75rem;">
                ⚠️ Sin datos técnicos disponibles para esta ubicación
            </div>`;
        }
        
        detalleDiv.innerHTML = `
            <div style="margin-bottom: 15px;">
                <div style="font-size: 0.7rem; color: var(--theme-color); font-weight: 900; text-transform: uppercase; margin-bottom: 4px;">📍 Ubicación Seleccionada</div>
                <div style="font-size: 1.1rem; font-weight: 900; color: #1e293b;">${p.id}</div>
                <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 8px;">${p.nombre}</div>
                <div style="display: flex; gap: 10px; font-size: 0.7rem; color: #94a3b8;">
                    <span>📍 Lat: ${p.lat.toFixed(4)}</span>
                    <span>Lng: ${p.lng.toFixed(4)}</span>
                </div>
            </div>
            
            <div id="mapa-detalle-${p.id}" style="width: 100%; height: 150px; border-radius: 8px; margin-bottom: 15px; background: #e2e8f0;"></div>
            
            <div style="background: #f0fdf4; padding: 12px; border-radius: 8px; border: 1px solid #bbf7d0; margin-bottom: 15px;">
                <div style="font-size: 0.7rem; color: #166534; font-weight: 700; text-transform: uppercase;">${this.state.componente.toUpperCase()}</div>
                <div style="font-size: 1.3rem; font-weight: 900; color: #15803d;">${this.formatMoney(valorComponente)}</div>
            </div>
            
            <div style="margin-bottom: 15px;">
                <div style="font-size: 0.75rem; font-weight: 800; color: #334155; margin-bottom: 8px; border-bottom: 2px solid var(--theme-light); padding-bottom: 6px;">
                    🔧 DATOS TÉCNICOS
                </div>
                ${htmlDatosTecnicos}
            </div>
            
            <button onclick="app.seleccionarPantalla('${p.id}', document.querySelector('[data-id=&quot;${p.id}&quot;]'))" 
                style="width: 100%; padding: 10px; background: var(--theme-color); color: #fff; border: none; border-radius: 8px; font-weight: 700; font-size: 0.85rem; cursor: pointer;">
                📄 Ver Expediente Completo
            </button>
        `;
        
        setTimeout(() => {
            const mapDiv = document.getElementById(`mapa-detalle-${p.id}`);
            if (mapDiv && !mapDiv._leaflet_id) {
                const map = L.map(mapDiv).setView([p.lat, p.lng], 16);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);
                L.marker([p.lat, p.lng]).addTo(map)
                  .bindPopup(`<b>${p.id}</b><br>${p.nombre}`)
                  .openPopup();
            }
        }, 200);
    }

    seleccionarPantalla(id, nodeEl) {
        this.state.pantalla = id;
        const lvl = nodeEl ? parseInt(nodeEl.closest('.column').dataset.lvl) : 4;
        this.renderer.deselectNodes(lvl); 
        if (nodeEl) nodeEl.classList.add('selected'); 
        this.renderer.removeColumnsAfter(lvl);

        const p = this.dbManager.rawData.find(x => x.id === id);
        if (!p) return;
        
        const rubroActual = this.state.modulo; 
        const dicc = this.dbManager.diccionarios[rubroActual];
        const mesBuscado = this.state.meses;

        let subtotal = 0;
        let filas = '';

        if (rubroActual === 'mantenimiento') {
            const subDicc = (dicc[this.state.subModulo] && dicc[this.state.subModulo].sub) ? dicc[this.state.subModulo].sub : {};
            filas = Object.keys(subDicc).map(k => {
                if (k === 'modificacionEstructura') {
                    const ticketsMes = (p.tickets || []).filter(tk => mesBuscado.includes('all') || mesBuscado.includes(tk.mes));
                    const tkMod = ticketsMes.filter(tk => normalizarFiltro(tk.actividad).includes('modificaciondeestructura'));
                    const costoMod = tkMod.reduce((acc, tk) => acc + tk.costoManttoOriginal, 0);
                    if (costoMod === 0) return '';
                    subtotal += costoMod;
                    return `
                    <div class="nf-row" style="flex-direction: column; align-items: flex-start; border-bottom: none; padding-bottom: 0;">
                        <div style="width: 100%; display: flex; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid var(--theme-light);">
                            <span class="nf-label" style="font-weight: 900; color: #333;">${subDicc[k]}</span><span class="nf-val">${this.formatMoney(costoMod)}</span>
                        </div>
                        <div style="width: 100%; padding-right: 5px;">
                            ${tkMod.map(tk => `
                            <div style="background: #fff; padding: 12px; border-radius: 6px; border-left: 4px solid var(--theme-color); margin-bottom: 12px; border: 1px solid #eaeaea;">
                                <div style="font-size: 0.85rem; color: #222; font-weight: 800;">${tk.actividad}</div>
                                <div style="font-size: 0.75rem; color: #555; margin-bottom: 6px;"><b>Motivo:</b> ${tk.causa}</div>
                                <div style="padding: 8px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #64748b;">
                                    <div style="font-size: 0.75rem; color: #334155;"><b>Insumos:</b> ${tk.insumo || 'Ninguno'} ${tk.costoInsumo > 0 ? `<span style="color:var(--theme-color); font-weight:900;">(${this.formatMoney(tk.costoInsumo)})</span>` : ''}</div>
                                    <div style="font-size: 0.75rem; color: #334155;"><b>Refacción:</b> ${tk.refaccion || 'Ninguna'} ${tk.costoRefaccion > 0 ? `<span style="color:var(--theme-color); font-weight:900;">(${this.formatMoney(tk.costoRefaccion)})</span>` : ''}</div>
                                    <div style="font-size: 0.75rem; color: #334155;"><b>Transporte:</b> <b>${this.formatMoney(tk.transporte || 0)}</b> ${tk.gasolina > 0 ? `<span style="color:var(--theme-color); font-weight:900;">(+ Gasolina: ${this.formatMoney(tk.gasolina)})</span>` : ''}</div>
                                </div>
                                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #eee; padding-top: 8px; margin-top: 10px;">
                                    <span style="font-size: 0.75rem; color: #888;">${tk.fechaCorta} <span style="color: var(--theme-color); text-transform: capitalize;">(${tk.mes})</span></span>
                                    <span style="font-size: 0.95rem; color: var(--theme-color); font-weight: 900;">${this.formatMoney(tk.costoManttoOriginal)}</span>
                                </div>
                            </div>`).join('')}
                        </div>
                    </div>`;
                }

                const ticketsMes = (p.tickets || []).filter(tk => mesBuscado.includes('all') || mesBuscado.includes(tk.mes));
                let tkFiltrados = [];
                if (k === 'estetico') tkFiltrados = ticketsMes.filter(tk => normalizarFiltro(tk.actividad).includes('estetico'));
                else if (k === 'software') tkFiltrados = ticketsMes.filter(tk => normalizarFiltro(tk.actividad).includes('software'));
                else if (k === 'profundo') tkFiltrados = ticketsMes.filter(tk => normalizarFiltro(tk.actividad).includes('profundo'));
                else if (k === 'tickets') tkFiltrados = ticketsMes.filter(tk => !normalizarFiltro(tk.actividad).includes('estetico') && !normalizarFiltro(tk.actividad).includes('software') && !normalizarFiltro(tk.actividad).includes('profundo') && !normalizarFiltro(tk.actividad).includes('modificaciondeestructura'));

                const costoCat = tkFiltrados.reduce((acc, tk) => acc + tk.costoManttoOriginal, 0);
                subtotal += costoCat;

                if (tkFiltrados.length === 0) return '';

                let tkHTML = tkFiltrados.map(tk => {
                    const iVal = (tk.insumo && !/^n\/?a$/i.test(String(tk.insumo).trim())) ? String(tk.insumo).trim() : 'Ninguno';
                    const rVal = (tk.refaccion && !/^n\/?a$/i.test(String(tk.refaccion).trim())) ? String(tk.refaccion).trim() : 'Ninguna';
                    const iCost = tk.costoInsumo > 0 ? ` <span style="color:var(--theme-color); font-weight:900;">(${this.formatMoney(tk.costoInsumo)})</span>` : '';
                    const rCost = tk.costoRefaccion > 0 ? ` <span style="color:var(--theme-color); font-weight:900;">(${this.formatMoney(tk.costoRefaccion)})</span>` : '';
                    const tCost = tk.transporte > 0 ? this.formatMoney(tk.transporte) : '$0';
                    const gCost = tk.gasolina > 0 ? ` <span style="color:var(--theme-color); font-weight:900;">(+ Gasolina: ${this.formatMoney(tk.gasolina)})</span>` : '';

                    return `
                    <div style="background: #fff; padding: 12px; border-radius: 6px; border-left: 4px solid var(--theme-color); margin-bottom: 12px; border: 1px solid #eaeaea;">
                        <div style="font-size: 0.85rem; color: #222; font-weight: 800;">${tk.actividad}</div>
                        <div style="font-size: 0.75rem; color: #555; margin-bottom: 6px;"><b>Motivo:</b> ${tk.causa}</div>
                        <div style="padding: 8px; background-color: #f1f5f9; border-radius: 6px; border-left: 4px solid #64748b;">
                            <div style="font-size: 0.75rem; color: #334155;"><b>Insumos:</b> ${iVal}${iCost}</div>
                            <div style="font-size: 0.75rem; color: #334155;"><b>Refacción:</b> ${rVal}${rCost}</div>
                            <div style="font-size: 0.75rem; color: #334155;"><b>Transporte:</b> <b>${tCost}</b>${gCost}</div>
                        </div>
                        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed #eee; padding-top: 8px; margin-top: 10px;">
                            <span style="font-size: 0.75rem; color: #888;">${tk.fechaCorta} <span style="color: var(--theme-color); text-transform: capitalize;">(${tk.mes})</span></span>
                            <span style="font-size: 0.95rem; color: var(--theme-color); font-weight: 900;">${this.formatMoney(tk.costoManttoOriginal)}</span>
                        </div>
                    </div>`;
                }).join('');

                return `<div class="nf-row" style="flex-direction: column; align-items: flex-start; border-bottom: none; padding-bottom: 0;">
                            <div style="width: 100%; display: flex; justify-content: space-between; margin-bottom: 12px; border-bottom: 2px solid var(--theme-light); padding-bottom: 8px;">
                                <span class="nf-label" style="font-weight: 900;">${subDicc[k]}</span><span class="nf-val">${this.formatMoney(costoCat)}</span>
                            </div>
                            <div style="width: 100%;">${tkHTML}</div>
                        </div>`;
            }).join('');

        } else if (rubroActual === 'capex' && p.carasVV) {
            let htmlCaras = '';
            Object.keys(p.carasVV).forEach(cara => {
                let subCara = 0;
                let filasCara = Object.keys(dicc).map(k => {
                    let val = p.carasVV[cara][k] || 0;
                    if(val === 0) return '';
                    subCara += val; 
                    subtotal += val;
                    return `<div class="nf-row" style="padding: 8px 0; border-bottom: 1px solid #f0f0f0;">
                                <span class="nf-label" style="font-size: 0.8rem;">${typeof dicc[k] === 'object' ? dicc[k].label : dicc[k]}</span>
                                <span class="nf-val" style="font-size: 0.9rem;">${this.formatMoney(val)}</span>
                            </div>`;
                }).join('');
                if(subCara > 0) {
                    htmlCaras += `<div style="background: #fff; padding: 15px; border-radius: 6px; border-top: 4px solid var(--theme-color); margin-bottom: 12px;">
                        <h4 style="margin: 0 0 12px 0; color: var(--theme-color); text-align: center; font-size: 0.9rem;">CARA ${cara.toUpperCase()}</h4>
                        ${filasCara}
                        <div style="margin-top: 12px; border-top: 2px solid var(--theme-light); text-align: right; font-weight: 900; color: var(--theme-color); font-size: 0.9rem;">Subtotal: ${this.formatMoney(subCara)}</div>
                    </div>`;
                }
            });
            filas = htmlCaras;
        } else {
            filas = Object.keys(dicc).map(k => {
                let valor = 0;
                if (rubroActual === 'operacion') valor = (p.gastosOperacion || []).filter(op => mesBuscado.includes('all') || mesBuscado.includes(op.mes)).reduce((acc, op) => acc + (op[k] || 0), 0);
                else valor = p[rubroActual][k] || 0;
                if(valor === 0) return '';
                subtotal += valor;
                return `<div class="nf-row" style="padding: 8px 0;"><span class="nf-label" style="font-size: 0.8rem;">${typeof dicc[k] === 'object' ? dicc[k].label : dicc[k]}</span><span class="nf-val" style="font-size: 0.9rem;">${this.formatMoney(valor)}</span></div>`;
            }).join('');
        }

        const html = `
            <div style="padding: 12px 15px; background: var(--theme-color); color: #fff; text-align: center; font-weight: 800; cursor: pointer; border-radius: 6px 6px 0 0;" onclick="app.cerrarPanel(${lvl+1})">
                ⬅ REGRESAR
            </div>
            <div class="node-final" style="min-width: 400px;">
                <div class="nf-header" style="padding: 15px 20px;">
                    <div class="nf-title" style="font-size: 1.2rem;">${p.id}</div>
                    <div class="nf-id" style="font-size: 0.85rem;">${p.nombre}</div>
                </div>
                
                <div style="display: flex; gap: 12px; margin: 15px;">
                    <div id="map-${p.id}" style="flex: 1; height: 150px; background: #e2e8f0; border-radius: 8px; overflow: hidden; position: relative;"></div>
                    <div style="flex: 1; height: 150px; background: #e2e8f0; border-radius: 8px; overflow: hidden; display: flex; align-items: center; justify-content: center; position: relative;">
                        <span style="position: absolute; font-size: 0.7rem; color: #64748b; font-weight: 800;">SIN FOTO</span>
                        <img src="assets/fotos/${p.id}.jpg" onerror="this.style.display='none'" style="width: 100%; height: 100%; object-fit: cover; position: relative; z-index: 2;">
                    </div>
                </div>

                <div class="nf-body" style="padding: 15px 20px;">
                    <div style="font-size: 0.85rem; font-weight: 800; color: var(--theme-color); margin-bottom: 20px; text-transform: uppercase; border-bottom: 1px solid var(--theme-light); padding-bottom: 8px;">
                        📋 Expediente de ${rubroActual} ${this.state.subModulo ? '(' + this.state.subModulo + ')' : ''}
                    </div>
                    ${filas || '<div style="text-align:center; color:#aaa; font-style:italic; font-size: 0.85rem;">Sin gastos en este rubro</div>'}
                </div>
                <div class="nf-total" style="margin: 20px; border-top: 2px solid #ddd; padding-top: 15px;">
                    <div class="nf-total-label" style="font-size: 0.9rem;">💰 Total Documentado en Pantalla</div>
                    <div class="nf-total-val" style="font-size: 1.6rem;">${this.formatMoney(subtotal)}</div>
                </div>
            </div>
        `;
        this.renderer.createColumn(lvl + 1, "EXPEDIENTE TÉCNICO", html);

        setTimeout(() => {
            const mapDiv = document.getElementById(`map-${p.id}`);
            if (mapDiv && !mapDiv._leaflet_id) {
                const map = L.map(mapDiv).setView([p.lat, p.lng], 16);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                    attribution: '&copy; OpenStreetMap contributors'
                }).addTo(map);
                L.marker([p.lat, p.lng]).addTo(map)
                  .bindPopup(`<b>${p.id}</b><br>${p.nombre}`)
                  .openPopup();
            }
        }, 200);
    }

    abrirModalGeneral() {
        if (!this.state.modulo) {
            this.state.modulo = 'capex';
        }
        const sumas = this.dbManager.getSumasConsolidadas(this.state.unidad, this.state.modulo, this.state.meses);
        const total = this.dbManager.getGranTotal(sumas);
        const conteos = this.dbManager.getConteosConsolidados(this.state.unidad, this.state.modulo, this.state.meses);
        const dicc = this.dbManager.diccionarios[this.state.modulo];
        
        const modal = document.getElementById('modal-data');
        const modalBox = modal.querySelector('.modal-box');
        modalBox.style.width = '900px';
        modalBox.style.maxWidth = '95vw';
        
        document.getElementById('md-title').innerText = `📊 RESUMEN ${this.state.modulo.toUpperCase()}`;
        document.getElementById('md-sub').innerText = `${this.state.unidad} – Periodo: ${this.state.meses.join(', ')}`;
        document.getElementById('md-total').innerText = this.formatMoney(total);
        document.getElementById('md-lbl-total').innerText = `Costo Total (${this.state.unidad})`;

        const breakdown = document.getElementById('md-breakdown');
        breakdown.innerHTML = Object.keys(dicc).map(k => {
            const monto = sumas[k] || 0;
            const cant = conteos[k] || 0;
            const pct = total > 0 ? ((monto / total) * 100).toFixed(1) : 0;
            const barWidth = total > 0 ? ((monto / total) * 100) : 0;
            return `
            <div style="display:flex; flex-direction:column; padding:12px; background:#f8fafc; border-radius:8px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <div>
                        <div style="font-weight:700; color:#1e293b; font-size:0.9rem;">${typeof dicc[k] === 'object' ? dicc[k].label : dicc[k]}</div>
                        <div style="font-size:0.7rem; color:#64748b;">${cant} equipos</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:900; color:var(--theme-color); font-size:1rem;">${this.formatMoney(monto)}</div>
                        <div style="font-size:0.7rem; color:#64748b;">${pct}%</div>
                    </div>
                </div>
                <div style="background:#e2e8f0; border-radius:4px; height:6px; overflow:hidden;">
                    <div style="background:var(--theme-color); width:${barWidth}%; height:100%; border-radius:4px;"></div>
                </div>
            </div>`;
        }).join('');

        modal.classList.add('active');
    }

    abrirModalPantallas() {
        const pantallas = this.dbManager.getPantallasPorUnidad(this.state.unidad);
        const modal = document.getElementById('modal-pantallas');
        const modalBox = modal.querySelector('.modal-box');
        modalBox.style.width = '1000px';
        modalBox.style.maxWidth = '95vw';
        const grid = document.getElementById('md-grid');
        
        grid.innerHTML = pantallas.map(p => {
            return `
            <div class="pantalla-card" style="border:1px solid #e2e8f0; padding:18px; border-radius:10px; margin-bottom:12px; background:#fff; transition:0.2s; display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
                <div>
                    <div style="font-weight:900; color:var(--theme-color); font-size:0.95rem;">${p.id}</div>
                    <div style="font-size:0.8rem; color:#64748b;">${p.nombre}</div>
                    <div style="font-size:0.7rem; color:#94a3b8; margin-top:4px;">📍 Lat: ${p.lat.toFixed(4)} | Lng: ${p.lng.toFixed(4)}</div>
                </div>
                <button class="btn-ir" data-id="${p.id}" style="background:var(--theme-color); color:#fff; border:none; border-radius:8px; padding:10px 20px; font-weight:600; cursor:pointer; font-size:0.85rem;">
                    🔍 Ver Expediente
                </button>
            </div>`;
        }).join('');

        grid.querySelectorAll('.btn-ir').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                this.cerrarModal('modal-pantallas');
                this.irAPantalla(id);
            });
        });

        modal.classList.add('active');
    }

    irAPantalla(id) {
        const p = this.dbManager.rawData.find(x => x.id === id);
        if (!p) return alert("Pantalla no encontrada");
        
        if (!this.state.modulo) {
            this.construirNivel1();
            setTimeout(() => {
                const nodoCap = document.querySelector(`.column[data-lvl="1"] .node[onclick*="'capex'"]`);
                if (nodoCap) this.seleccionarModulo('capex', nodoCap);
                setTimeout(() => {
                    this.irAPantalla(id);
                }, 300);
            }, 100);
            return;
        }
        
        setTimeout(() => {
            const nodosPant = document.querySelectorAll(`.node[onclick*="'${id}'"]`);
            if (nodosPant.length > 0) {
                nodosPant[nodosPant.length - 1].click();
            } else {
                alert("Navegue manualmente al módulo correspondiente para ver el detalle.");
            }
        }, 200);
    }

    initBuscador() {
        const input = document.getElementById('global-search');
        const dropdown = document.getElementById('search-dropdown');
        if(!input) return;
        input.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase();
            if (q.length < 2) return dropdown.classList.remove('active');
            const res = this.dbManager.rawData.filter(p => p.nombre.toLowerCase().includes(q) || p.id.toLowerCase().includes(q));
            dropdown.innerHTML = res.map(p => `<div class="search-item" onclick="app.irAPantalla('${p.id}'); document.getElementById('search-dropdown').classList.remove('active');"><b>${p.id}</b><br><small>${p.nombre}</small></div>`).join('');
            dropdown.classList.add('active');
        });
    }
}

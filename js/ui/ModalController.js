export default class ModalController {
    constructor(formatMoneyUtils) {
        this.formatMoney = formatMoneyUtils;
        this.bindCloseEvents();
    }

    bindCloseEvents() {
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.getAttribute('data-target') || e.target.closest('.modal-close').dataset.target;
                this.close(targetId);
            });
        });
    }

    open(id) { document.getElementById(id).classList.add('active'); }
    close(id) { document.getElementById(id).classList.remove('active'); }

    renderResumenGeneral(unidad, modulo, dbManager, mesActivo) {
        const sumas = dbManager.getSumasConsolidadas(unidad, modulo, mesActivo);
        const granTotal = Object.values(sumas).reduce((a, b) => a + b, 0);
        const dicc = dbManager.diccionarios[modulo];

        document.getElementById('md-title').textContent = "RESUMEN EJECUTIVO";
        document.getElementById('md-sub').textContent = `Filtro: ${mesActivo === 'all' ? 'Histórico' : 'Mes ' + mesActivo} | ${unidad}`;
        document.getElementById('md-total').textContent = this.formatMoney(granTotal);
        
        document.getElementById('md-breakdown').innerHTML = Object.keys(dicc).map(k => {
            // Manejar si el diccionario es jerárquico (como mantenimiento) o plano
            const label = typeof dicc[k] === 'object' ? dicc[k].label : dicc[k];
            return `
                <div class="data-row">
                    <span>${label}</span>
                    <span class="val">${this.formatMoney(sumas[k] || 0)}</span>
                </div>
            `;
        }).join('');
        this.open('modal-data');
    }

    renderGridPantallas(pantallas, clickCallback) {
        const grid = document.getElementById('md-grid');
        grid.innerHTML = pantallas.map(p => `
            <div class="pantalla-card" data-id="${p.id}">
                <div class="p-id">${p.id}</div>
                <div class="p-name">${p.nombre}</div>
            </div>
        `).join('');

        grid.querySelectorAll('.pantalla-card').forEach(card => {
            card.addEventListener('click', () => {
                this.close('modal-pantallas');
                clickCallback(card.dataset.id);
            });
        });
        this.open('modal-pantallas');
    }

    renderExpedienteCompleto(pantalla, diccionarios, mesActivo) {
        let totalGeneral = 0;
        let htmlBloques = '';

        const mapUrl = `https://www.google.com/maps/embed/v1/view?key=YOUR_API_KEY&center=${pantalla.lat},${pantalla.lng}&zoom=15`; 
        // Nota: mapUrl simplificado para demo.
        
        const mediaHtml = `
            <div class="media-grid">
                <div class="media-box"><img src="${pantalla.foto}" alt="Foto"></div>
                <div class="media-box"><div class="map-placeholder">📍 Lat: ${pantalla.lat}<br>Lng: ${pantalla.lng}</div></div>
            </div>
        `;

        ['capex', 'operacion', 'mantenimiento'].forEach(mod => {
            const data = pantalla[mod];
            const dicc = diccionarios[mod];
            let subtotal = 0;

            const filas = Object.keys(dicc).map(k => {
                const label = typeof dicc[k] === 'object' ? dicc[k].label : dicc[k];
                const valor = data[k] || 0;
                subtotal += valor;
                return `<div class="exp-row"><span>${label}</span><b>${this.formatMoney(valor)}</b></div>`;
            }).join('');

            totalGeneral += subtotal;
            htmlBloques += `
                <div class="mod-section">
                    <div class="mod-title">${mod.toUpperCase()}</div>
                    ${filas}
                    <div class="mod-subtotal">Subtotal: ${this.formatMoney(subtotal)}</div>
                </div>
            `;
        });

        document.getElementById('md-title').textContent = pantalla.nombre;
        document.getElementById('md-sub').textContent = `ID: ${pantalla.id} | Vista Global`;
        document.getElementById('md-total').textContent = this.formatMoney(totalGeneral);
        document.getElementById('md-breakdown').innerHTML = mediaHtml + htmlBloques;
        this.open('modal-data');
    }
}
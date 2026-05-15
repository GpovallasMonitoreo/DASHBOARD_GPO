export default class DiagramRenderer {
    constructor() {
        this.canvas = document.getElementById('diagram-canvas');
        this.svg = document.getElementById('svg-layer');
    }

    clearAll() {
        this.canvas.querySelectorAll('.column').forEach(c => c.remove());
        while (this.svg.firstChild) { this.svg.removeChild(this.svg.firstChild); }
    }

    removeColumnsAfter(level) {
        this.canvas.querySelectorAll('.column').forEach(col => {
            if (parseInt(col.dataset.lvl) > level) col.remove();
        });
    }

    deselectNodes(colLvl) {
        const col = document.querySelector(`.column[data-lvl="${colLvl}"]`);
        if(col) col.querySelectorAll('.node').forEach(n => n.classList.remove('selected'));
    }

    createColumn(level, title, htmlContent) {
        const col = document.createElement('div');
        col.className = 'column'; col.dataset.lvl = level;
        col.innerHTML = `
            <div class="col-header">${level}. ${title}</div>
            <div class="col-scroll" onscroll="app.renderer.drawLines()">${htmlContent}</div>
        `;
        this.canvas.appendChild(col);
        setTimeout(() => {
            this.drawLines();
            col.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
        }, 50);
    }

    drawLines() {
        try {
            while (this.svg.firstChild) { this.svg.removeChild(this.svg.firstChild); }
            const colorLinea = getComputedStyle(document.documentElement).getPropertyValue('--theme-color').trim();
            const svgRect = this.svg.getBoundingClientRect();
            
            document.querySelectorAll('.node.selected').forEach(node => {
                const col = node.closest('.column');
                const nextCol = document.querySelector(`.column[data-lvl="${parseInt(col.dataset.lvl) + 1}"]`);
                if (!nextCol) return;

                const rectStart = node.getBoundingClientRect();
                const startX = rectStart.right - svgRect.left;
                const startY = rectStart.top - svgRect.top + (rectStart.height / 2);

                nextCol.querySelectorAll('.node').forEach(n2 => {
                    const rectEnd = n2.getBoundingClientRect();
                    const endX = rectEnd.left - svgRect.left;
                    const endY = rectEnd.top - svgRect.top + (rectEnd.height / 2);

                    n2.classList.add('has-incoming');
                    const midX = startX + (endX - startX) / 2;
                    const pathD = `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
                    
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', pathD); path.setAttribute('stroke', colorLinea);
                    path.setAttribute('stroke-width', '2.5'); path.setAttribute('fill', 'none');
                    path.setAttribute('opacity', '0.4'); path.setAttribute('stroke-linejoin', 'round');
                    this.svg.appendChild(path);
                });
            });
        } catch (e) {}
    }
}
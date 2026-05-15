import AppController from './core/AppController.js';

// Instanciamos globalmente
window.app = new AppController();

// Arrancamos la carga asíncrona de los datos
window.app.arrancarAplicacion().then(() => {
    console.log("App lista para usarse y conectada al JSON maestro.");
});
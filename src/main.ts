import {App} from './App';

/**
 * Point d'entrée de l'application
 * Crée et démarre l'instance principale de l'application
 */
const app = new App();
app.start().catch(error => {
    console.error("Erreur lors du démarrage de l'application:", error);
});

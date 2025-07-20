// ========================================================================
//                    MAIN.JS - VERSIONE PULITA E COMPLETA
//              Ripartenza da zero con tutto funzionante
// ========================================================================

// --- CONFIGURAZIONE SUPABASE ---
const SUPABASE_URL = "https://lycrgzptkdkksukcwrld.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5Y3JnenB0a2Rra3N1a2N3cmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODQyMzAsImV4cCI6MjA2ODM2MDIzMH0.ZJGOXAMC3hKKrnwXHKEa2_Eh7ZpOKeLYvYlYneBiEfk";

let supabase;

// Inizializzazione Supabase con controllo errori
function initSupabase() {
    try {
        if (typeof window.supabase === 'undefined') {
            console.error('❌ Libreria Supabase non caricata');
            return false;
        }
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase inizializzato');
        return true;
    } catch (error) {
        console.error('❌ Errore inizializzazione Supabase:', error);
        return false;
    }
}

// --- REGISTRAZIONE SERVICE WORKER ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(() => console.log('✅ Service Worker registrato'))
            .catch(error => console.error('❌ Service Worker fallito:', error));
    });
}

// --- UTILITIES ---
const getCurrentPath = () => window.location.pathname;
const isAppPage = () => getCurrentPath().startsWith('/app/');
const isDebugMode = () => window.location.search.includes('debug=true');

// --- FUNZIONI DI DEBUG ---
function log(message, type = 'info') {
    if (!isDebugMode()) return;
    const emoji = type === 'error' ? '❌' : type === 'success' ? '✅' : '🔍';
    console.log(`${emoji} ${message}`);
}

async function testConnection() {
    if (!isDebugMode()) return;
    log('Test connessione Supabase...');
    try {
        const { data, error } = await supabase.from('profiles').select('count').limit(1);
        if (error) throw error;
        log('Connessione Supabase OK', 'success');
        return true;
    } catch (error) {
        log(`Errore connessione: ${error.message}`, 'error');
        return false;
    }
}

// --- GESTIONE FEEDBACK ---
function showFeedback(message, type = 'error', containerId = 'feedback') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const bgColor = type === 'success' ? 'bg-green-100 border-green-400 text-green-700' : 'bg-red-100 border-red-400 text-red-700';
    container.innerHTML = `<div class="p-4 mb-4 text-sm rounded-lg ${bgColor}" role="alert">${message}</div>`;
    container.classList.remove('hidden');
    setTimeout(() => container.classList.add('hidden'), 5000);
}

// --- AUTENTICAZIONE ---
async function getSession() {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        log(session ? 'Sessione attiva' : 'Nessuna sessione');
        return session;
    } catch (error) {
        log(`Errore sessione: ${error.message}`, 'error');
        return null;
    }
}

async function getUserRoles(session) {
    if (!session) return [];
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('ruoli')
            .eq('id', session.user.id)
            .single();
        if (error) throw error;
        return data?.ruoli || [];
    } catch (error) {
        log(`Errore ruoli: ${error.message}`, 'error');
        return [];
    }
}

async function protectPage() {
    const session = await getSession();
    const currentPath = getCurrentPath();
    
    if (!session && isAppPage()) {
        window.location.replace('/public/login.html');
        return false;
    }
    
    if (session) {
        const roles = await getUserRoles(session);
        if (currentPath.includes('admin.html') && !roles.includes('ADMIN')) {
            window.location.replace('/app/home.html');
            return false;
        }
        if (currentPath.includes('dirigente-dashboard.html') && !roles.includes('DIRIGENTE') && !roles.includes('ADMIN')) {
            window.location.replace('/app/home.html');
            return false;
        }
    }
    
    return true;
}

// --- PAGINA LOGIN ---
function initLoginPage() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        const email = form.email.value;
        const password = form.password.value;
        
        submitButton.disabled = true;
        submitButton.textContent = 'Accesso in corso...';
        
        try {
            const { data: { session }, error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (error) throw error;
            if (!session) throw new Error('Sessione non creata');
            
            const roles = await getUserRoles(session);
            if (roles.includes('ADMIN')) {
                window.location.replace('/app/admin.html');
            } else if (roles.includes('DIRIGENTE')) {
                window.location.replace('/app/dirigente-dashboard.html');
            } else {
                window.location.replace('/app/home.html');
            }
            
        } catch (error) {
            showFeedback(`Errore: ${error.message}`, 'error', 'loginFeedback');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Accedi';
        }
    });
}

// --- PAGINA REGISTER ---
function initRegisterPage() {
    const form = document.getElementById('registerForm');
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        
        if (!form.terms.checked) {
            showFeedback('Devi accettare i termini e condizioni', 'error', 'registerFeedback');
            return;
        }
        
        submitButton.disabled = true;
        submitButton.textContent = 'Registrazione in corso...';
        
        try {
            const { error } = await supabase.auth.signUp({
                email: form.email.value,
                password: form.password.value,
                options: {
                    data: {
                        nome: form.nome.value,
                        cognome: form.cognome.value,
                        telefono: form.telefono.value
                    }
                }
            });
            
            if (error) throw error;
            
            showFeedback('Registrazione completata! Controlla la tua email.', 'success', 'registerFeedback');
            setTimeout(() => window.location.replace('/public/login.html'), 3000);
            
        } catch (error) {
            showFeedback(`Errore: ${error.message}`, 'error', 'registerFeedback');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Registrati';
        }
    });
}

// --- PAGINA HOME ---
async function initHomePage() {
    log('Inizializzazione homepage...');
    const session = await getSession();
    if (!session) return;
    
    // Carica nome utente
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('nome')
            .eq('id', session.user.id)
            .single();
            
        if (!error && data?.nome) {
            const welcomeElement = document.getElementById('welcome-user');
            if (welcomeElement) {
                welcomeElement.textContent = `Benvenuto, ${data.nome}!`;
            }
        }
    } catch (error) {
        log(`Errore caricamento nome: ${error.message}`, 'error');
    }
    
    // Gestisci ruoli per menu
    const roles = await getUserRoles(session);
    const managementTools = document.getElementById('management-tools');
    const adminLink = document.getElementById('admin-link');
    const dirigenteLink = document.getElementById('dirigente-link');
    
    if (roles.includes('ADMIN')) {
        managementTools?.classList.remove('hidden');
        adminLink?.classList.remove('hidden');
        dirigenteLink?.classList.remove('hidden');
    } else if (roles.includes('DIRIGENTE')) {
        managementTools?.classList.remove('hidden');
        dirigenteLink?.classList.remove('hidden');
    }
    
    // Carica notizie
    await loadNews();
    
    // Carica convenzioni
    await loadConvenzioni();
}

async function loadNews() {
    const container = document.getElementById('news-container');
    if (!container) return;
    
    try {
        log('Caricamento notizie...');
        const { data, error } = await supabase
            .from('notizie')
            .select('*')
            .order('data_pubblicazione', { ascending: false })
            .limit(3);
            
        if (error) throw error;
        
        if (data && data.length > 0) {
            container.innerHTML = data.map(item => `
                <div class="bg-white p-4 rounded-xl shadow-md border-l-4 border-blue-500">
                    <h4 class="font-bold text-blue-900">${item.titolo}</h4>
                    <p class="text-gray-700 text-sm mt-1">${item.contenuto || ''}</p>
                    <p class="text-gray-500 text-xs mt-2">${new Date(item.data_pubblicazione).toLocaleDateString('it-IT')}</p>
                </div>
            `).join('');
            log(`Caricate ${data.length} notizie`, 'success');
        } else {
            container.innerHTML = '<p class="text-gray-500">Nessuna notizia disponibile.</p>';
            log('Nessuna notizia trovata');
        }
    } catch (error) {
        log(`Errore caricamento notizie: ${error.message}`, 'error');
        container.innerHTML = `<p class="text-red-500">Errore caricamento notizie: ${error.message}</p>`;
    }
}

async function loadConvenzioni() {
    const container = document.getElementById('convenzioni-container');
    if (!container) return;
    
    try {
        log('Caricamento convenzioni...');
        const { data, error } = await supabase
            .from('convenzioni')
            .select('*')
            .limit(4);
            
        if (error) throw error;
        
        if (data && data.length > 0) {
            container.innerHTML = data.map(item => `
                <div class="bg-gray-50 p-3 rounded-xl text-center shadow-sm">
                    ${item.logo_url ? 
                        `<img src="${item.logo_url}" alt="${item.nome_partner}" class="h-10 w-10 mx-auto mb-2 object-contain">` :
                        `<div class="h-10 w-10 mx-auto mb-2 bg-gray-200 rounded-lg flex items-center justify-center text-xl">${item.icona || '🤝'}</div>`
                    }
                    <span class="font-semibold text-gray-800 text-sm block">${item.nome_partner}</span>
                    ${item.sconto_percentuale ? `<span class="text-xs text-green-600 font-medium">${item.sconto_percentuale}% OFF</span>` : ''}
                </div>
            `).join('');
            log(`Caricate ${data.length} convenzioni`, 'success');
        } else {
            container.innerHTML = '<p class="text-gray-500">Nessuna convenzione disponibile.</p>';
            log('Nessuna convenzione trovata');
        }
    } catch (error) {
        log(`Errore caricamento convenzioni: ${error.message}`, 'error');
        container.innerHTML = `<p class="text-red-500">Errore caricamento convenzioni: ${error.message}</p>`;
    }
}

// --- PAGINA TESSERA ---
async function initTesseraPage() {
    log('Inizializzazione pagina tessera...');
    const session = await getSession();
    if (!session) return;
    
    try {
        // Carica dati profilo
        log('Caricamento dati profilo...');
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('nome, cognome')
            .eq('id', session.user.id)
            .single();
            
        if (profileError) {
            log(`Errore profilo: ${profileError.message}`, 'error');
        }
        
        // Carica dati tessera
        log('Caricamento dati tessera...');
        const { data: tessera, error: tesseraError } = await supabase
            .from('tessere')
            .select('numero_tessera, data_scadenza')
            .eq('user_id', session.user.id)
            .single();
            
        if (tesseraError) {
            log(`Errore tessera: ${tesseraError.message}`, 'error');
        }
        
        // Aggiorna interfaccia
        updateTesseraUI(profile, tessera);
        
    } catch (error) {
        log(`Errore generale tessera: ${error.message}`, 'error');
        updateTesseraUI(null, null);
    }
}

function updateTesseraUI(profile, tessera) {
    // Nome completo
    const nomeElement = document.getElementById('tessera-nome');
    if (nomeElement) {
        const nomeCompleto = profile ? `${profile.nome || ''} ${profile.cognome || ''}`.trim() : 'Nome non disponibile';
        nomeElement.textContent = nomeCompleto || 'Nome non disponibile';
    }
    
    // Numero tessera
    const numeroElement = document.getElementById('tessera-numero');
    if (numeroElement) {
        numeroElement.textContent = tessera?.numero_tessera || 'N/A';
    }
    
    // Data scadenza
    const scadenzaElement = document.getElementById('tessera-scadenza');
    if (scadenzaElement) {
        scadenzaElement.textContent = tessera?.data_scadenza 
            ? new Date(tessera.data_scadenza).toLocaleDateString('it-IT')
            : 'N/A';
    }
    
    // QR Code con fallback robusto
    const qrcodeElement = document.getElementById('tessera-qrcode');
    if (qrcodeElement) {
        if (tessera?.numero_tessera) {
            createQRCode(qrcodeElement, tessera.numero_tessera);
        } else {
            createFallbackQR(qrcodeElement, 'N/A');
        }
    }
}

function createQRCode(element, data) {
    // Lista di servizi QR da provare
    const qrServices = [
        `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(data)}`,
        `https://chart.googleapis.com/chart?chs=100x100&cht=qr&chl=${encodeURIComponent(data)}`
    ];
    
    let currentService = 0;
    
    function tryNextService() {
        if (currentService < qrServices.length) {
            element.src = qrServices[currentService];
            element.alt = `QR Code tessera ${data}`;
            currentService++;
        } else {
            // Tutti i servizi falliti, usa fallback
            createFallbackQR(element, data);
        }
    }
    
    element.onerror = tryNextService;
    element.onload = () => log('QR code caricato', 'success');
    
    // Inizia con il primo servizio
    tryNextService();
}

function createFallbackQR(element, data) {
    log('Usando fallback QR code');
    element.style.display = 'none';
    
    const fallback = document.createElement('div');
    fallback.className = 'w-24 h-24 bg-gray-200 border-2 border-gray-400 flex items-center justify-center text-xs text-center rounded';
    fallback.innerHTML = `
        <div>
            <div class="font-bold">TESSERA</div>
            <div class="text-xs">${data}</div>
        </div>
    `;
    
    element.parentNode.insertBefore(fallback, element);
}

// --- PAGINA DIRIGENTI ---
async function initDirigentiPage() {
    log('Inizializzazione pagina dirigenti...');
    const list = document.getElementById('dirigenti-list');
    if (!list) return;
    
    try {
        const { data, error } = await supabase
            .from('organico_dirigentisindacali')
            .select('*')
            .order('id');
            
        if (error) throw error;
        
        if (data && data.length > 0) {
            list.innerHTML = data.map(item => {
                const avatarUrl = item.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.nome_cognome)}&background=random&color=fff`;
                return `
                    <div class="bg-white rounded-lg shadow p-4 flex items-center space-x-4">
                        <img src="${avatarUrl}" alt="${item.nome_cognome}" class="w-16 h-16 rounded-full object-cover">
                        <div>
                            <h3 class="font-bold text-lg">${item.nome_cognome}</h3>
                            <p class="text-sm text-blue-600 font-semibold">${item.ruolo || ''}</p>
                            <a href="tel:${item.telefono}" class="text-sm text-gray-600 hover:underline">${item.telefono || ''}</a>
                        </div>
                    </div>
                `;
            }).join('');
            log(`Caricati ${data.length} dirigenti`, 'success');
        } else {
            list.innerHTML = '<p class="text-gray-500">Nessun dirigente trovato.</p>';
        }
    } catch (error) {
        log(`Errore caricamento dirigenti: ${error.message}`, 'error');
        list.innerHTML = `<p class="text-red-500">Errore caricamento dirigenti: ${error.message}</p>`;
    }
}

// --- PAGINA PROFILO ---
async function initProfiloPage() {
    log('Inizializzazione pagina profilo...');
    const session = await getSession();
    if (!session) return;
    
    const form = document.getElementById('profileForm');
    if (!form) return;
    
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
            
        if (error) throw error;
        
        // Popola form
        form.email.value = session.user.email;
        form.nome.value = data?.nome || '';
        form.cognome.value = data?.cognome || '';
        form.telefono.value = data?.telefono || '';
        
        log('Dati profilo caricati', 'success');
    } catch (error) {
        log(`Errore caricamento profilo: ${error.message}`, 'error');
        showFeedback('Errore caricamento profilo', 'error', 'profileFeedback');
    }
    
    // Gestisci submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        
        submitButton.disabled = true;
        submitButton.textContent = 'Salvataggio...';
        
        try {
            const { error } = await supabase
                .from('profiles')
                .upsert({
                    id: session.user.id,
                    nome: form.nome.value,
                    cognome: form.cognome.value,
                    telefono: form.telefono.value,
                    updated_at: new Date()
                });
                
            if (error) throw error;
            
            showFeedback('Profilo aggiornato con successo!', 'success', 'profileFeedback');
            log('Profilo aggiornato', 'success');
        } catch (error) {
            log(`Errore aggiornamento: ${error.message}`, 'error');
            showFeedback(`Errore: ${error.message}`, 'error', 'profileFeedback');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Salva Modifiche';
        }
    });
}

// --- LOGOUT ---
async function initLogoutPage() {
    try {
        await supabase.auth.signOut();
        log('Logout completato', 'success');
    } catch (error) {
        log(`Errore logout: ${error.message}`, 'error');
    }
    setTimeout(() => window.location.replace('/public/login.html'), 1000);
}

// --- ROUTER PRINCIPALE ---
async function initApp() {
    log('Avvio applicazione...');
    
    // Inizializza Supabase
    if (!initSupabase()) {
        console.error('❌ Impossibile inizializzare Supabase');
        return;
    }
    
    // Test connessione in debug mode
    if (isDebugMode()) {
        await testConnection();
    }
    
    // Proteggi pagina
    if (!(await protectPage())) {
        return;
    }
    
    // Router delle pagine
    const path = getCurrentPath();
    log(`Caricamento pagina: ${path}`);
    
    if (path.endsWith('login.html')) {
        initLoginPage();
    } else if (path.endsWith('register.html')) {
        initRegisterPage();
    } else if (path.endsWith('logout.html')) {
        initLogoutPage();
    } else if (path.endsWith('home.html') || path === '/app/' || path === '/') {
        await initHomePage();
    } else if (path.endsWith('tessera.html')) {
        await initTesseraPage();
    } else if (path.endsWith('dirigenti.html')) {
        await initDirigentiPage();
    } else if (path.endsWith('profilo.html')) {
        await initProfiloPage();
    } else if (path.endsWith('dirigente-dashboard.html')) {
        // Aggiungi qui la logica per la dashboard dirigente se necessaria
        log('Dashboard dirigente - da implementare');
    }
    
    log('Applicazione inizializzata', 'success');
}

// --- INIZIALIZZAZIONE ---
document.addEventListener('DOMContentLoaded', initApp);

// --- ESPORTA FUNZIONI GLOBALI PER DEBUG ---
window.testConnection = testConnection;
window.getSession = getSession;
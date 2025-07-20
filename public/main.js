// ========================================================================
//              MAIN.JS - VERSIONE CORRETTA CON DEBUG E FIX
//                  Include tutte le funzionalità + correzioni
// ========================================================================

// --- 1. CONFIGURAZIONE SUPABASE ---
const SUPABASE_URL = "https://lycrgzptkdkksukcwrld.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5Y3JnenB0a2Rra3N1a2N3cmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODQyMzAsImV4cCI6MjA2ODM2MDIzMH0.ZJGOXAMC3hKKrnwXHKEa2_Eh7ZpOKeLYvYlYneBiEfk";

let supabase;
try {
    // Verifica che la libreria Supabase sia caricata
    if (typeof window.supabase === 'undefined') {
        console.error("❌ Libreria Supabase non caricata. Verifica che lo script sia incluso nell'HTML.");
        alert("Errore: Libreria Supabase non trovata. Controlla la connessione internet.");
    } else {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log("✅ Supabase inizializzato correttamente");
    }
} catch (error) {
    console.error("❌ Errore durante l'inizializzazione di Supabase:", error);
    alert("Impossibile connettersi al backend. Controlla la configurazione.");
}

// --- 2. GESTIONE PWA (SERVICE WORKER) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => console.log('✅ Service Worker registrato con successo.'))
      .catch(error => console.log('❌ Registrazione Service Worker fallita:', error));
  });
}

// --- 3. UTILITIES ---
const getCurrentPath = () => window.location.pathname;
const isAppPage = () => getCurrentPath().startsWith('/app/');

// --- 4. GESTIONE AUTENTICAZIONE ---
const checkUserSession = async () => {
    try {
        console.log("🔍 Controllo sessione utente...");
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            console.error("❌ Errore nel controllo sessione:", error);
            return null;
        }
        console.log("✅ Sessione:", session ? "Attiva" : "Non trovata");
        return session;
    } catch (error) {
        console.error('❌ Errore controllo sessione:', error);
        return null;
    }
};

const getUserRoles = async (session) => {
    if (!session) return [];
    try {
        console.log("🔍 Recupero ruoli utente...");
        const { data: profile, error } = await supabase.from('profiles').select('ruoli').eq('id', session.user.id).single();
        if (error) {
            console.error("❌ Errore nel recuperare i ruoli:", error);
            return [];
        }
        console.log("✅ Ruoli utente:", profile?.ruoli || []);
        return profile?.ruoli || [];
    } catch (error) {
        console.error('❌ Errore nel recuperare i ruoli del profilo:', error);
        return [];
    }
};

const protectPage = async () => {
    const session = await checkUserSession();
    const currentPath = getCurrentPath();

    if (!session && isAppPage()) {
        console.log("🔒 Utente non autenticato, reindirizzamento al login");
        window.location.replace('/public/login.html');
        return;
    }

    if (session) {
        const roles = await getUserRoles(session);
        if (currentPath.endsWith('/admin.html') && !roles.includes('ADMIN')) {
            window.location.replace('/app/home.html');
        }
        if (currentPath.endsWith('/dirigente-dashboard.html') && !roles.includes('DIRIGENTE') && !roles.includes('ADMIN')) {
            window.location.replace('/app/home.html');
        }
    }
};

// --- 5. GESTIONE FEEDBACK UTENTE ---
const showFeedback = (message, type = 'error', containerId = 'feedback') => {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`⚠️ Container feedback '${containerId}' non trovato`);
        return;
    }
    const colors = {
        error: 'bg-red-100 border-red-400 text-red-700',
        success: 'bg-green-100 border-green-400 text-green-700'
    };
    container.innerHTML = `<div class="p-4 mb-4 text-sm rounded-lg ${colors[type]}" role="alert">${message}</div>`;
    container.classList.remove('hidden');
    setTimeout(() => container.classList.add('hidden'), 5000);
};

// --- 6. LOGICHE SPECIFICHE PER PAGINA ---

/** PAGINA LOGIN **/
const initLoginPage = () => {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { email, password } = e.target.elements;
        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Accesso in corso...';

        try {
            const { data: { session }, error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value });
            if (error) throw error;
            if (!session) throw new Error('Sessione non trovata dopo il login.');

            const roles = await getUserRoles(session);
            if (roles.includes('ADMIN')) window.location.replace('/app/admin.html');
            else if (roles.includes('DIRIGENTE')) window.location.replace('/app/dirigente-dashboard.html');
            else window.location.replace('/app/home.html');

        } catch (error) {
            showFeedback(`Errore: ${error.message}`, 'error', 'loginFeedback');
            submitButton.disabled = false;
            submitButton.textContent = 'Accedi';
        }
    });
};

/** PAGINA REGISTER **/
const initRegisterPage = () => {
    const registerForm = document.getElementById('registerForm');

    if (!registerForm) return;

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const { nome, cognome, telefono, email, password, terms } = e.target.elements;
        const submitButton = registerForm.querySelector('button[type="submit"]');

        if (!terms.checked) {
            showFeedback('Devi accettare i termini e le condizioni sulla privacy.', 'error', 'registerFeedback');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Registrazione in corso...';

        try {
            const { data: userAuth, error: authError } = await supabase.auth.signUp({
                email: email.value,
                password: password.value,
                options: {
                    data: {
                        nome: nome.value,
                        cognome: cognome.value,
                        telefono: telefono.value
                    }
                }
            });

            if (authError) throw authError;

            showFeedback('Registrazione avvenuta con successo! Controlla la tua email per la conferma.', 'success', 'registerFeedback');
            setTimeout(() => {
                window.location.replace('/public/login.html');
            }, 3000);

        } catch (error) {
            console.error('Errore durante la registrazione:', error);
            let errorMessage = 'Si è verificato un errore durante la registrazione.';
            if (error.message.includes('User already registered')) {
                errorMessage = 'Questa email è già registrata. Prova ad accedere o recuperare la password.';
            } else {
                errorMessage = `Errore: ${error.message}`;
            }
            showFeedback(errorMessage, 'error', 'registerFeedback');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Registrati';
        }
    });
};

/** PAGINA HOME **/
const initHomePage = async () => {
    console.log("🏠 Inizializzazione pagina Home...");
    const session = await checkUserSession();
    if (!session) return;

    try {
        console.log("🔍 Caricamento dati profilo utente...");
        const { data: profile, error } = await supabase.from('profiles').select('nome').eq('id', session.user.id).single();
        if (error) {
            console.error("❌ Errore caricamento profilo:", error);
        } else if (profile && profile.nome) {
            const welcomeUser = document.getElementById('welcome-user');
            if (welcomeUser) welcomeUser.textContent = `Benvenuto, ${profile.nome}!`;
            console.log("✅ Nome utente caricato:", profile.nome);
        }
    } catch (error) { 
        console.error('❌ Errore nel caricare il nome:', error); 
    }

    const roles = await getUserRoles(session);
    const managementTools = document.getElementById('management-tools');
    const adminLink = document.getElementById('admin-link');
    const dirigenteLink = document.getElementById('dirigente-link');

    if (roles.includes('ADMIN')) {
        if(managementTools) managementTools.classList.remove('hidden');
        if(adminLink) adminLink.classList.remove('hidden');
        if(dirigenteLink) dirigenteLink.classList.remove('hidden');
    } else if (roles.includes('DIRIGENTE')) {
        if(managementTools) managementTools.classList.remove('hidden');
        if(dirigenteLink) dirigenteLink.classList.remove('hidden');
    }

    // Caricamento notizie con debug migliorato
    const newsContainer = document.getElementById('news-container');
    if (newsContainer) {
        try {
            console.log("🔍 Caricamento notizie...");
            const { data: news, error } = await supabase.from('notizie').select('*').order('data_pubblicazione', { ascending: false }).limit(3);
            if (error) {
                console.error("❌ Errore caricamento notizie:", error);
                throw error;
            }
            console.log("✅ Notizie caricate:", news?.length || 0);
            if (news && news.length > 0) {
                newsContainer.innerHTML = news.map(item => `
                    <div class="bg-white p-4 rounded-xl shadow-md border-l-4 border-primary transition-transform hover:translate-x-1 hover:shadow-lg">
                        <h4 class="font-bold text-blue-900">${item.titolo}</h4>
                        <p class="text-gray-700 text-sm mt-1">${item.contenuto || ''}</p>
                        <p class="text-gray-500 text-xs mt-2">${new Date(item.data_pubblicazione).toLocaleDateString('it-IT')}</p>
                    </div>
                `).join('');
            } else { 
                newsContainer.innerHTML = '<p class="text-gray-500">Nessuna notizia recente.</p>'; 
            }
        } catch (error) { 
            console.error("❌ Errore caricamento notizie:", error);
            newsContainer.innerHTML = `<p class="text-red-500">Impossibile caricare le notizie: ${error.message}</p>`; 
        }
    }

    // Caricamento convenzioni con debug migliorato
    const convenzioniContainer = document.getElementById('convenzioni-container');
    if (convenzioniContainer) {
        try {
            console.log("🔍 Caricamento convenzioni...");
            const { data: convenzioni, error } = await supabase.from('convenzioni').select('*').limit(4);
            if (error) {
                console.error("❌ Errore caricamento convenzioni:", error);
                throw error;
            }
            console.log("✅ Convenzioni caricate:", convenzioni?.length || 0);
            if (convenzioni && convenzioni.length > 0) {
                convenzioniContainer.innerHTML = convenzioni.map(item => `
                    <div class="bg-gray-50 p-3 rounded-xl text-center shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md">
                        ${item.logo_url ?
                            `<img src="${item.logo_url}" alt="${item.nome_partner}" class="h-10 w-10 mx-auto mb-2 object-contain">` :
                            `<div class="h-10 w-10 mx-auto mb-2 bg-gray-200 rounded-lg flex items-center justify-center text-xl">${item.icona || '🤝'}</div>`
                        }
                        <span class="font-semibold text-gray-800 text-sm block">${item.nome_partner}</span>
                        ${item.sconto_percentuale ? `<span class="text-xs text-green-600 font-medium">${item.sconto_percentuale}% OFF</span>` : ''}
                    </div>
                `).join('');
            } else { 
                convenzioniContainer.innerHTML = '<p class="text-gray-500 col-span-2">Nessuna convenzione.</p>'; 
            }
        } catch (error) { 
            console.error("❌ Errore caricamento convenzioni:", error);
            convenzioniContainer.innerHTML = `<p class="text-red-500 col-span-full">Impossibile caricare: ${error.message}</p>`; 
        }
    }
};

/** PAGINA DIRIGENTI **/
const initDirigentiPage = async () => {
    console.log("👥 Inizializzazione pagina Dirigenti...");
    const list = document.getElementById('dirigenti-list');
    if (!list) return;
    
    try {
        console.log("🔍 Caricamento dirigenti...");
        const { data: dirigenti, error } = await supabase
            .from('organico_dirigentisindacali')
            .select('*')
            .order('id');

        if (error) {
            console.error("❌ Errore caricamento dirigenti:", error);
            throw error;
        }

        console.log("✅ Dirigenti caricati:", dirigenti?.length || 0);

        if (dirigenti && dirigenti.length > 0) {
            list.innerHTML = dirigenti.map(item => {
                const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.nome_cognome)}&background=random&color=fff`;
                const avatarUrl = item.foto_url || fallbackAvatar;

                return `
                <div class="bg-white rounded-lg shadow p-4 flex items-center space-x-4">
                    <img src="${avatarUrl}" alt="${item.nome_cognome}" class="w-16 h-16 rounded-full object-cover">
                    <div>
                        <h3 class="font-bold text-lg text-textDark">${item.nome_cognome}</h3>
                        <p class="text-sm text-primary font-semibold">${item.ruolo || ''}</p>
                        <a href="tel:${item.telefono}" class="text-sm text-gray-600 hover:underline">${item.telefono || ''}</a>
                    </div>
                </div>
            `}).join('');
        } else {
            list.innerHTML = '<p class="text-gray-500">La lista dei dirigenti non è disponibile.</p>';
        }
    } catch (error) {
        console.error("❌ Errore caricamento dirigenti:", error);
        list.innerHTML = `<p class="text-red-500">Impossibile caricare i dirigenti: ${error.message}</p>`;
    }
};

/** PAGINA TESSERA - CORRETTA CON DEBUG **/
const loadTesseraData = async () => {
    console.log("🎫 Inizializzazione pagina Tessera...");
    const session = await checkUserSession();
    if (!session) {
        console.error("❌ Nessuna sessione attiva per tessera");
        return;
    }

    try {
        console.log("🔍 Caricamento dati profilo per tessera...");
        // Caricamento dati profilo
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('nome, cognome')
            .eq('id', session.user.id)
            .single();

        if (profileError) {
            console.error("❌ Errore caricamento profilo:", profileError);
        } else {
            console.log("✅ Profilo caricato:", profile);
        }

        console.log("🔍 Caricamento dati tessera...");
        // Caricamento dati tessera
        const { data: tessera, error: tesseraError } = await supabase
            .from('tessere')
            .select('numero_tessera, data_scadenza')
            .eq('user_id', session.user.id)
            .single();

        if (tesseraError) {
            console.error("❌ Errore caricamento tessera:", tesseraError);
        } else {
            console.log("✅ Tessera caricata:", tessera);
        }

        // Aggiornamento elementi DOM
        const nomeElement = document.getElementById('tessera-nome');
        const numeroElement = document.getElementById('tessera-numero');
        const scadenzaElement = document.getElementById('tessera-scadenza');
        const qrcodeElement = document.getElementById('tessera-qrcode');

        if (nomeElement) {
            const nomeCompleto = `${profile?.nome || ''} ${profile?.cognome || ''}`.trim();
            nomeElement.textContent = nomeCompleto || 'Nome non disponibile';
        }

        if (numeroElement) {
            numeroElement.textContent = tessera?.numero_tessera || 'N/A';
        }

        if (scadenzaElement) {
            scadenzaElement.textContent = tessera?.data_scadenza 
                ? new Date(tessera.data_scadenza).toLocaleDateString('it-IT')
                : 'N/A';
        }

        if (qrcodeElement && tessera?.numero_tessera) {
            // FIX: Genera QR code con fallback multipli
            const qrData = encodeURIComponent(tessera.numero_tessera);
            const qrServices = [
                `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${qrData}`,
                `https://chart.googleapis.com/chart?chs=100x100&cht=qr&chl=${qrData}`,
                `https://qr.io/api?data=${qrData}&size=100`
            ];
            
            // Prova il primo servizio, con fallback automatico
            qrcodeElement.src = qrServices[0];
            qrcodeElement.alt = `QR Code tessera ${tessera.numero_tessera}`;
            
            // Gestione errore caricamento immagine con fallback
            qrcodeElement.onerror = function() {
                console.warn('⚠️ Primo servizio QR fallito, provo il fallback...');
                if (this.src !== qrServices[1]) {
                    this.src = qrServices[1];
                } else if (this.src !== qrServices[2]) {
                    this.src = qrServices[2];
                } else {
                    // Fallback finale: QR code SVG generato localmente
                    this.style.display = 'none';
                    this.parentNode.innerHTML += `
                        <div class="w-24 h-24 bg-gray-200 border-2 border-gray-400 flex items-center justify-center text-xs text-center">
                            <div>
                                <div class="font-bold">TESSERA</div>
                                <div>${tessera.numero_tessera}</div>
                            </div>
                        </div>
                    `;
                }
            };
        } else if (qrcodeElement) {
            // Fallback se non c'è numero tessera
            qrcodeElement.style.display = 'none';
            qrcodeElement.parentNode.innerHTML += `
                <div class="w-24 h-24 bg-gray-200 border-2 border-gray-400 flex items-center justify-center text-xs text-center">
                    <div>
                        <div class="font-bold">TESSERA</div>
                        <div>N/A</div>
                    </div>
                </div>
            `;
        }

        console.log("✅ Dati tessera aggiornati nell'interfaccia");

    } catch (error) {
        console.error("❌ Errore generale caricamento dati tessera:", error);
        const nomeElement = document.getElementById('tessera-nome');
        if (nomeElement) {
            nomeElement.textContent = 'Errore nel caricamento dei dati.';
        }
    }
};

/** PAGINA PROFILO **/
const loadProfileData = async () => {
    console.log("👤 Inizializzazione pagina Profilo...");
    const session = await checkUserSession();
    if (!session) return;
    const form = document.getElementById('profileForm');
    if (!form) return;

    try {
        console.log("🔍 Caricamento dati profilo...");
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (error) {
            console.error("❌ Errore caricamento profilo:", error);
            throw error;
        }
        console.log("✅ Profilo caricato:", profile);
        
        form.email.value = session.user.email;
        form.nome.value = profile?.nome || '';
        form.cognome.value = profile?.cognome || '';
        form.telefono.value = profile?.telefono || '';
    } catch (error) {
        console.error("❌ Errore caricamento dati profilo:", error);
        showFeedback('Impossibile caricare i dati del profilo.', 'error', 'profileFeedback');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvataggio...';
        const updates = { 
            id: session.user.id, 
            nome: form.nome.value, 
            cognome: form.cognome.value, 
            telefono: form.telefono.value, 
            updated_at: new Date() 
        };
        try {
            const { error: updateError } = await supabase.from('profiles').upsert(updates);
            if (updateError) throw updateError;
            showFeedback('Profilo aggiornato con successo!', 'success', 'profileFeedback');
        } catch (error) {
            showFeedback(`Errore aggiornamento: ${error.message}`, 'error', 'profileFeedback');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Salva Modifiche';
        }
    });
};

/** PAGINA DI LOGOUT **/
const initLogoutPage = async () => {
    console.log("🚪 Logout in corso...");
    try {
        await supabase.auth.signOut();
        console.log("✅ Logout completato");
    } catch (error) {
        console.error('❌ Errore durante il logout:', error);
    } finally {
        setTimeout(() => { window.location.replace('/public/login.html'); }, 1000);
    }
};

// --- 7. LOGICA DASHBOARD DIRIGENTE ---

function showDashboardFeedback(message, type = 'success') {
    const feedback = document.getElementById('dashboardFeedback');
    if (feedback) showFeedback(message, type, 'dashboardFeedback');
}

// --- Funzioni Helper per icone ---
function getPriorityIcon(priorita) {
    const icons = { 'normale': '📝', 'importante': '⚠️', 'urgente': '🚨' };
    return icons[priorita] || '📝';
}

function getCategoryIcon(categoria) {
    const icons = { 
        'assicurazioni': '🛡️', 
        'automotive': '🚗', 
        'tecnologia': '💻', 
        'viaggi': '✈️', 
        'wellness': '💆', 
        'shopping': '🛍️', 
        'servizi': '🔧', 
        'altro': '📦' 
    };
    return icons[categoria] || '📦';
}

// --- Funzioni Gestione Notizie ---
async function quickAddNotizia(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const submitButton = document.getElementById('notiziaSubmitButton');
    const notiziaId = formData.get('notizia_id');

    submitButton.disabled = true;
    submitButton.textContent = notiziaId ? 'Salvataggio...' : 'Pubblicando...';

    try {
        let imageUrl = null;
        const imageFile = form.querySelector('input[name="immagine_file"]').files[0];

        if (imageFile) {
            const filePath = `public/${Date.now()}_${imageFile.name}`;
            const { error: uploadError } = await supabase.storage.from('immagini_notizie').upload(filePath, imageFile);
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from('immagini_notizie').getPublicUrl(filePath);
            imageUrl = publicUrlData.publicUrl;
        }

        const notiziaData = {
            titolo: formData.get('titolo'),
            contenuto: formData.get('contenuto'),
            priorita: formData.get('priorita'),
            icona: formData.get('icona'),
            ...(imageUrl && { immagine_url: imageUrl }),
        };

        const { error } = notiziaId
            ? await supabase.from('notizie').update(notiziaData).eq('id', notiziaId)
            : await supabase.from('notizie').insert([notiziaData]);

        if (error) throw error;

        showDashboardFeedback(`✅ Notizia ${notiziaId ? 'aggiornata' : 'pubblicata'}!`);
        resetNotiziaForm();
        loadQuickNotizie();

    } catch (error) {
        showDashboardFeedback(`❌ Errore: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function loadQuickNotizie() {
    const list = document.getElementById('quickNotizieList');
    if (!list) return;
    try {
        const { data: notizie, error } = await supabase.from('notizie').select('*').order('data_pubblicazione', { ascending: false }).limit(5);
        if (error) throw error;

        if (notizie && notizie.length > 0) {
            list.innerHTML = notizie.map(notizia => `
                <div class="bg-white/10 p-3 rounded-lg flex justify-between items-center gap-2">
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-white truncate">${notizia.titolo}</p>
                        <p class="text-white/60 text-xs">${new Date(notizia.data_pubblicazione).toLocaleDateString('it-IT')}</p>
                    </div>
                    <div class="flex-shrink-0 flex gap-2">
                        <button onclick='editQuickNotizia(${JSON.stringify(notizia)})' class="p-2 bg-accent/50 hover:bg-accent rounded-full text-white transition-colors">✏️</button>
                        <button onclick="deleteQuickNotizia('${notizia.id}')" class="p-2 bg-danger/50 hover:bg-danger rounded-full text-white transition-colors">🗑️</button>
                    </div>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p class="text-white/70 text-sm text-center py-4">Nessuna notizia pubblicata.</p>';
        }
    } catch (error) {
        list.innerHTML = `<p class="text-red-300 text-xs">Errore caricamento: ${error.message}</p>`;
    }
}

function editQuickNotizia(notizia) {
    document.getElementById('notizia_id').value = notizia.id;
    document.querySelector('#quickNotiziaForm [name="titolo"]').value = notizia.titolo;
    document.querySelector('#quickNotiziaForm [name="contenuto"]').value = notizia.contenuto;
    document.querySelector('#quickNotiziaForm [name="priorita"]').value = notizia.priorita;
    document.querySelector('#quickNotiziaForm [name="icona"]').value = notizia.icona;

    document.getElementById('notiziaSubmitButton').textContent = '💾 Salva Modifiche';
    document.getElementById('cancelEditButton').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetNotiziaForm() {
    const form = document.getElementById('quickNotiziaForm');
    if(form) form.reset();
    document.getElementById('notizia_id').value = '';
    document.getElementById('notiziaSubmitButton').textContent = '📤 Pubblica Notizia';
    document.getElementById('cancelEditButton').classList.add('hidden');
}

async function deleteQuickNotizia(id) {
    if (!confirm('Sei sicuro di voler eliminare questa notizia?')) return;
    try {
        const { error } = await supabase.from('notizie').delete().eq('id', id);
        if (error) throw error;
        showDashboardFeedback('✅ Notizia eliminata.');
        loadQuickNotizie();
    } catch (error) {
        showDashboardFeedback(`❌ Errore eliminazione: ${error.message}`, 'error');
    }
}

// --- Funzioni Gestione Convenzioni ---
async function quickAddConvenzione(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    submitButton.textContent = 'Aggiungendo...';

    try {
        const convenzioneData = {
            nome_partner: formData.get('nome_partner'),
            descrizione: formData.get('descrizione') || '',
            categoria: formData.get('categoria') || 'altro',
            sconto_percentuale: formData.get('sconto_percentuale') ? parseInt(formData.get('sconto_percentuale')) : null,
            link_esterno: formData.get('link_esterno') || '',
            logo_url: formData.get('logo_url') || '',
            icona: getCategoryIcon(formData.get('categoria') || 'altro'),
        };

        const { error } = await supabase.from('convenzioni').insert([convenzioneData]);
        if (error) throw error;

        showDashboardFeedback('✅ Convenzione aggiunta con successo!');
        form.reset();
        loadQuickConvenzioni();
    } catch (error) {
        showDashboardFeedback(`❌ Errore: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '➕ Aggiungi Convenzione';
    }
}

async function loadQuickConvenzioni() {
    const list = document.getElementById('quickConvenzioniList');
    if (!list) return;
    try {
        const { data: convenzioni, error } = await supabase.from('convenzioni').select('*').order('created_at', { ascending: false }).limit(5);
        if (error) throw error;

        if (convenzioni && convenzioni.length > 0) {
            list.innerHTML = convenzioni.map(convenzione => `
                <div class="bg-white/10 p-3 rounded-lg flex justify-between items-center gap-2">
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-white truncate">${convenzione.nome_partner}</p>
                        <p class="text-white/60 text-xs">${convenzione.categoria}</p>
                    </div>
                    <div class="flex-shrink-0">
                        <button onclick="deleteQuickConvenzione('${convenzione.id}')" class="p-2 bg-danger/50 hover:bg-danger rounded-full text-white transition-colors">🗑️</button>
                    </div>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p class="text-white/70 text-sm text-center py-4">Nessuna convenzione aggiunta.</p>';
        }
    } catch (error) {
        list.innerHTML = `<p class="text-red-300 text-xs">Errore caricamento: ${error.message}</p>`;
    }
}

async function deleteQuickConvenzione(id) {
    if (!confirm('Sei sicuro di voler eliminare questa convenzione?')) return;
    try {
        const { error } = await supabase.from('convenzioni').delete().eq('id', id);
        if (error) throw error;
        showDashboardFeedback('✅ Convenzione eliminata.');
        loadQuickConvenzioni();
    } catch (error) {
        showDashboardFeedback(`❌ Errore eliminazione: ${error.message}`, 'error');
    }
}

/** Inizializza la pagina della dashboard del dirigente. */
const initDirigenteDashboardPage = () => {
    console.log("📊 Inizializzazione Dashboard Dirigente...");
    const notiziaForm = document.getElementById('quickNotiziaForm');
    if (notiziaForm) {
        notiziaForm.addEventListener('submit', quickAddNotizia);
        loadQuickNotizie();
    }

    const convenzioneForm = document.getElementById('quickConvenzioneForm');
    if (convenzioneForm) {
        convenzioneForm.addEventListener('submit', quickAddConvenzione);
        loadQuickConvenzioni();
    }
};

// --- 8. FUNZIONI DI DEBUG E TROUBLESHOOTING ---

// Funzione per testare la connessione a Supabase
const testSupabaseConnection = async () => {
    console.log("🔧 Test connessione Supabase...");
    try {
        // Test semplice connessione
        const { data, error } = await supabase.from('profiles').select('count').limit(1);
        if (error) {
            console.error("❌ Errore connessione Supabase:", error);
            return false;
        }
        console.log("✅ Connessione Supabase OK");
        return true;
    } catch (error) {
        console.error("❌ Errore test connessione:", error);
        return false;
    }
};

// Funzione per verificare le tabelle esistenti
const checkDatabaseTables = async () => {
    console.log("🔧 Verifica tabelle database...");
    const tables = ['profiles', 'tessere', 'notizie', 'convenzioni', 'organico_dirigentisindacali'];
    
    for (const table of tables) {
        try {
            const { data, error } = await supabase.from(table).select('*').limit(1);
            if (error) {
                console.error(`❌ Tabella '${table}' non accessibile:`, error);
            } else {
                console.log(`✅ Tabella '${table}' OK`);
            }
        } catch (error) {
            console.error(`❌ Errore accesso tabella '${table}':`, error);
        }
    }
};

// --- 9. ROUTER E INIZIALIZZAZIONE PRINCIPALE ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Inizializzazione applicazione...");
    
    // Test connessione se in modalità debug
    if (window.location.search.includes('debug=true')) {
        await testSupabaseConnection();
        await checkDatabaseTables();
    }
    
    await protectPage();

    const path = getCurrentPath();
    console.log('📍 Pagina corrente:', path);

    // Router delle pagine
    if (path.endsWith('/home.html') || path === '/app/' || path === '/') {
        await initHomePage();
    } else if (path.endsWith('/login.html')) {
        initLoginPage();
    } else if (path.endsWith('/register.html')) {
        initRegisterPage();
    } else if (path.endsWith('/logout.html')) {
        await initLogoutPage();
    } else if (path.endsWith('/dirigenti.html')) {
        await initDirigentiPage();
    } else if (path.endsWith('/tessera.html')) {
        await loadTesseraData();
    } else if (path.endsWith('/profilo.html')) {
        await loadProfileData();
    } else if (path.endsWith('/dirigente-dashboard.html')) {
        initDirigenteDashboardPage();
    }
    // Aggiungi qui altri "else if" per le pagine mancanti (admin, etc.)
    
    console.log("✅ Inizializzazione completata");
});

// --- 10. ESPORTAZIONI GLOBALI ---
window.editQuickNotizia = editQuickNotizia;
window.deleteQuickNotizia = deleteQuickNotizia;
window.resetNotiziaForm = resetNotiziaForm;
window.deleteQuickConvenzione = deleteQuickConvenzione;
window.testSupabaseConnection = testSupabaseConnection;
window.checkDatabaseTables = checkDatabaseTables;
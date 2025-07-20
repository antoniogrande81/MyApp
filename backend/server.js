require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch'); // Assicurati che sia importato
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!OPENAI_API_KEY) {
    console.error('Errore: La chiave API di OpenAI (OPENAI_API_KEY) non è configurata nel file .env.');
    process.exit(1);
}
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Errore: Le credenziali Supabase (SUPABASE_URL o SUPABASE_ANON_KEY) non sono configurate nel file .env.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
    }
});

app.use(cors());
app.use(express.json());

// --- DATABASE DI CONOSCENZA INTERNO STRUTTURATO ---
const KNOWLEDGE_BASE = {
    "licenze riposi permessi": {
        keywords: ["licenze", "riposi", "permessi", "ferie", "assenza"],
        answers: [
            "Per informazioni dettagliate su licenze, riposi e permessi, ti invitiamo a consultare la sezione 'Normative' all'interno della nostra app o a contattare direttamente i nostri uffici per una consulenza personalizzata.",
            "Hai bisogno di assistenza per la compilazione di moduli per licenze o permessi? Possiamo guidarti passo dopo passo."
        ]
    },
    "mensa": {
        keywords: ["mensa", "buoni pasto", "servizio mensa", "pasto"],
        answers: [
            "Per informazioni sul servizio mensa, inclusi orari, menù e modalità di accesso ai buoni pasto, puoi visitare la sezione 'Servizi' dell'app o contattare l'ufficio mensa al numero 06 98765432.",
            "Se hai domande specifiche su diete o allergie, ti preghiamo di rivolgerti al personale della mensa."
        ]
    },
    "bestbadge servizi legali": {
        keywords: ["bestbadge", "servizi legali", "consulenza legale", "avvocato", "tutela legale"],
        answers: [
            "BestBadge offre servizi di consulenza legale e tutela per i nostri iscritti. Per maggiori dettagli su come accedere a questi servizi e per fissare un appuntamento, visita la sezione 'BestBadge' nella nostra app.",
            "I nostri esperti legali sono a tua disposizione per questioni relative al diritto del lavoro e altre tematiche sindacali."
        ]
    },
    // Aggiungi qui altre categorie se necessario
};

// --- Contatti Dirigenti per Provincia (Estratti dall'Organigramma) ---
const DIRIGENTI_CONTATTI = {
    "veneto_generale": "Per la Regione Veneto, puoi contattare: Antonio Grande (Segretario Generale Regionale) – 335 147 0886 – antoniogrande81@gmail.com; Andrea Modolo (Segretario Generale Regionale Aggiunto) – 377 096 9168 – andreamodolo.85@gmail.com.",
    "veneto": "Per la Regione Veneto, puoi contattare: Antonio Grande (Segretario Generale Regionale) – 335 147 0886 – antoniogrande81@gmail.com; Andrea Modolo (Segretario Generale Regionale Aggiunto) – 377 096 9168 – andreamodolo.85@gmail.com.",
    "venezia": "Dirigente Venezia: Massimiliano Riccio (Segretario Generale Provinciale) – 331 364 7088 – max.riccio2015@tiscali.it; Massimo Salciccioli (Segretario Generale Provinciale Aggiunto) – 331 369 1024 – contemax1970@gmail.com.",
    "belluno": "Dirigente Belluno: Nicolò Perin (Segretario Generale Provinciale) – 340 541 2580 – perinnicolo7@gmail.com; Gaetano Montesarchio (Segretario Generale Provinciale Aggiunto) – 331 841 5986 – montesarchio.gaetano89@gmail.com.",
    "padova": "Dirigente Padova: Gianluca Sciuto (Segretario Generale Provinciale) – 340 817 3344 – gianluca.sciuto@live.it; Gabriele Onesto (Segretario Generale Provinciale Aggiunto) – 340 533 9739 – gabriele.onesto@gmail.com.",
    "rovigo": "Dirigente Rovigo: Antonio Corlianò (Segretario Generale Provinciale) – 331 366 2600 – antoniocorliano78@gmail.com; Pezzuto Vincenzo (Segretario Generale Provinciale Aggiunto) – 333 566 9145 – pezzuto.vincenzo@outlook.it.",
    "treviso": "Dirigente Treviso: Andrea Modolo (Segretario Generale Provinciale) – 377 096 9168 – andreamodolo.85@gmail.com; Aldo Capua (Segretario Provinciale) – 320 702 5658 – aldo.kr13@gmail.com.",
    "verona": "Dirigente Verona: Niccolò Foroni (Segretario Generale Provinciale) – 340 727 9855 – nforoni86@gmail.com; Antonio Grande (Segretario Generale Provinciale Aggiunto) – 335 147 0886 – antoniogrande81@gmail.com.",
    "vicenza": "Dirigente Vicenza: Errante Christian (Segretario Generale Provinciale) – 389 316 7040 – christian91m@hotmail.it; Balzana Danilo (Segretario Generale Aggiunto) – 377 549 4081 – danilo.balzana@gmail.com.",
};

// --- Funzione per la ricerca nella Knowledge Base ---
function searchKnowledgeBase(query) {
    const normalizedQuery = query.toLowerCase().trim();

    // Cerca corrispondenze per le categorie specifiche
    for (const category in KNOWLEDGE_BASE) {
        const keywords = KNOWLEDGE_BASE[category].keywords;
        for (const keyword of keywords) {
            if (normalizedQuery.includes(keyword)) {
                // Restituisce una risposta casuale dalla lista di risposte per quella categoria
                const answers = KNOWLEDGE_BASE[category].answers;
                return answers[Math.floor(Math.random() * answers.length)];
            }
        }
    }

    // Gestione specifica per i contatti dei dirigenti
    if (normalizedQuery.includes("parlare con un dirigente") || normalizedQuery.includes("contatto dirigente") || normalizedQuery.includes("dirigente di") || normalizedQuery.includes("contattare dirigente")) {
        // Estrai la provincia dalla query
        const provinceMatch = normalizedQuery.match(/(?:di|a|in|per)\s+([a-zàèéìòù\s]+)$/);
        let province = null;
        if (provinceMatch && provinceMatch[1]) {
            province = provinceMatch[1].trim();
        }

        // Tenta di trovare la provincia anche se non è introdotta da preposizione
        const foundProvince = Object.keys(DIRIGENTI_CONTATTI).find(key => normalizedQuery.includes(key));
        if (foundProvince) {
            province = foundProvince;
        }

        if (province && DIRIGENTI_CONTATTI[province]) {
            return `Certo! Ecco i dati di contatto per il dirigente della provincia di ${province.charAt(0).toUpperCase() + province.slice(1)}: ${DIRIGENTI_CONTATTI[province]}.`;
        } else {
            const availableProvinces = Object.keys(DIRIGENTI_CONTATTI).filter(p => p !== "veneto_generale" && p !== "veneto").map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(", ");
            return `Certo, con un dirigente! Di quale provincia hai bisogno dei contatti? Le province disponibili sono: ${availableProvinces}. Oppure puoi contattare la sede regionale per la Regione Veneto.`;
        }
    }

    return null; // Nessuna corrispondenza trovata nel database interno
}

// Middleware di Autenticazione Supabase
const authenticateSupabase = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('Accesso non autorizzato: Header Authorization mancante o malformato.');
        return res.status(401).json({ error: 'Accesso non autorizzato: token di autenticazione mancante o malformato.' });
    }

    const token = authHeader.split(' ')[1];
    console.log('Token estratto (prima parte):', token ? token.substring(0, 10) + '...' : 'nessun token');

    try {
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            console.error('Errore di autenticazione Supabase (supabase.auth.getUser):', error ? error.message : 'Utente non trovato.');
            if (error && error.message.includes('Invalid JWT signature')) {
                console.error('Potenziale errore: JWT Secret non corrispondente. Verifica le impostazioni JWT Secret del tuo progetto Supabase.');
            } else if (error && error.message.includes('expired')) {
                console.error('Potenziale errore: Token JWT scaduto. L\'utente potrebbe aver bisogno di effettuare nuovamente il login.');
            }
            return res.status(401).json({ error: 'Token non valido o scaduto.' });
        }

        console.log('Utente autenticato nel backend (ID):', user.id);
        req.user = user;
        next();
    } catch (error) {
        console.error('Eccezione durante la verifica del token Supabase nel backend:', error.message);
        return res.status(500).json({ error: 'Errore interno del server durante l\'autenticazione.' });
    }
};

// Rotta API per il Chatbot
app.post('/chat', authenticateSupabase, async (req, res) => {
    const userMessage = req.body.message;
    const userId = req.user.id;

    console.log(`[${new Date().toISOString()}] Richiesta chat dall'utente ${userId}: "${userMessage}"`);

    if (!userMessage) {
        return res.status(400).json({ error: 'Il messaggio è obbligatorio.' });
    }

    let botReply = null;

    // 1. Tenta la ricerca nel database di conoscenza interno
    botReply = searchKnowledgeBase(userMessage);

    if (botReply) {
        console.log('Risposta trovata nel database di conoscenza interno.');
        return res.json({ reply: botReply });
    }

    // 2. Se nessuna risposta trovata, invia a OpenAI con istruzioni specifiche
    try {
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [
                    {
                        role: "system",
                        content: `Sei Virgilio, il dirigente virtuale di MyApp, un'associazione sindacale.
                        Il tuo compito principale è fornire informazioni precise e mirate su argomenti specifici della nostra organizzazione, come licenze, riposi, permessi, mensa, e i servizi legali di BestBadge.
                        Non hai trovato una risposta diretta nel tuo database di conoscenza interno per la domanda dell'utente: "${userMessage}".
                        Ora devi cercare di rispondere alla domanda dell'utente basandoti sulle tue conoscenze generali, ma sempre mantenendo un tono professionale e pertinente al contesto di un'associazione sindacale.
                        Se la domanda riguarda informazioni molto specifiche della nostra organizzazione che non conosci, o se l'utente chiede di parlare con un dirigente senza specificare la provincia, suggerisci di contattare direttamente gli uffici o di consultare le sezioni pertinenti dell'app/sito web per maggiori dettagli.
                        Non inventare informazioni specifiche che non conosci. Rispondi in italiano.`
                    },
                    { role: "user", content: userMessage }
                ]
            })
        });

        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            console.error('Errore ricevuto da OpenAI:', errorData);
            return res.status(openaiResponse.status).json({ error: errorData.error.message || 'Errore nella comunicazione con OpenAI.' });
        }

        const data = await openaiResponse.json();
        botReply = data.choices[0].message.content;

        res.json({ reply: botReply });
    } catch (error) {
        console.error('Errore nel backend durante la chiamata a OpenAI:', error.message);
        res.status(500).json({ error: 'Si è verificato un errore interno al server durante l\'elaborazione della richiesta.' });
    }
});

app.listen(PORT, () => {
    console.log(`Server proxy per OpenAI avviato sulla porta ${PORT}`);
    console.log(`Accessibile all'indirizzo: http://localhost:${PORT}`);
});
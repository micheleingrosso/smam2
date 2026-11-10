
## Versione 1.2.2

- Scheda allievo in stile rilevazione con tutte le lavorazioni e controlli + / −.
- Salvataggio cumulativo delle quantità mantenendo per quanto possibile lo storico delle righe.
- Eliminazione delle lavorazioni dal Dettaglio lavorazioni.
- Colonna “Quota soggetta a ribasso (10%)” nel Tariffario.
- Filtri Spese per data, categoria e ricerca libera, con totali ricalcolati.
- Nessuna migrazione D1 aggiuntiva richiesta rispetto alla v1.0.0.

# SMAM2 · Gestione amministrativa sartoria MW SRL

Versione 1.2.2 del gestionale amministrativo ridotto, separato dal precedente sistema di tracciabilità.

## Infrastruttura

- Worker / repository GitHub: `smam2`
- D1: `smam2-db`
- Binding D1: `DB`
- Assets statici: `ASSETS`
- Secret obbligatorio: `ADMIN_PASSWORD`
- Nessun R2, nessuna stampa, nessuna email.

## Funzioni

- Dashboard economica
- Scheda allievo incrementale
- Anagrafica e importazione massiva allievi
- Dettaglio di tutte le lavorazioni
- Tariffario completo iniziale di 50 voci
- Ribasso contrattuale applicato solo al 10% del valore di ogni singola lavorazione
- Registro spese
- Dipendenti / sarte: ore giornaliere, paga fissa € 9,00/ora, pagamenti e saldo aperto
- Costo del personale incluso automaticamente nelle spese e nei margini
- Report per allievo e per lavorazione
- Export CSV lavorazioni e ore personale

## Regola economica del ribasso

Il ribasso percentuale configurato non viene applicato al 100% del prezzo unitario, ma solo alla quota del 10% della singola lavorazione.

Esempio con ribasso 5%:

- prezzo listino: € 10,00
- quota ribassabile: € 1,00 (10%)
- ribasso sulla quota: € 0,05 (5% di € 1,00)
- prezzo netto unitario: € 9,9500

Il prezzo unitario netto viene calcolato con precisione a 4 decimali e il totale della riga viene arrotondato ai centesimi.

## Dipendenti

La paga è fissata a € 9,00/ora.

- Le ore registrate generano il costo economico del personale.
- Il costo compare automaticamente nella sezione Spese e nella Dashboard.
- I pagamenti alla dipendente non costituiscono una seconda spesa: riducono il saldo aperto.
- Saldo dipendente = costo maturato - pagamenti registrati.

## Prima installazione

1. Crea il database D1 `smam2-db`.
2. Copia il relativo `database_id` dentro `wrangler.jsonc` al posto di `REPLACE_WITH_D1_DATABASE_ID`.
3. Installa le dipendenze:

```bash
npm install
```

4. Applica la migration:

```bash
npm run migrate:remote
```

5. Imposta la password amministrativa come secret Cloudflare:

```bash
npx wrangler secret put ADMIN_PASSWORD
```

6. Pubblica:

```bash
npm run deploy
```

## Sicurezza

L'intero Worker, compresi gli asset dell'interfaccia, passa attraverso il controllo di sessione. La password non viene salvata nel repository o nel database: viene letta esclusivamente dal secret `ADMIN_PASSWORD`. La sessione firmata dura 12 ore e viene invalidata automaticamente se la password viene cambiata.

## Importazione allievi

Nella sezione Allievi è possibile incollare righe copiate da Excel o testo delimitato da `;`/tab nel formato:

```text
ROSSI;MARIO;28°
BIANCHI;LUCA;28°
```

## Nota sul database

Questo progetto usa un database nuovo e indipendente dal precedente `smam`: non copiare le vecchie migration nel nuovo repository.

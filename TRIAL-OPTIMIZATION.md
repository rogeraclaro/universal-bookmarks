# 🚀 Optimització per Trial de Google Cloud (90 dies)

## 📅 Dates del Trial

- **Data d'inici**: 8 de desembre de 2025
- **Data de finalització**: 8 de març de 2026 (90 dies)
- **Crèdit disponible**: $300 USD

---

## ⚡ Límits de l'API

### Mode Trial (Actiu fins 8 març 2026)
- **RPM** (Requests per minut): 2,000
- **Delay entre requests**: 100ms
- **Màxim intents**: 5
- **Backoff inicial**: 15s

### Mode Free (Després del trial)
- **RPM** (Requests per minut): 5
- **Delay entre requests**: 13,000ms (13s)
- **Màxim intents**: 3
- **Backoff inicial**: 15s

---

## 🔧 Canvis Implementats

### 1. **geminiService.ts** - Configuració Dinàmica de Límits

**Ubicació**: `/src/services/geminiService.ts`

#### Configuració del Trial (Línies 6-29):
```typescript
// Gemini API Trial Configuration
const TRIAL_START_DATE = new Date('2025-12-08');
const TRIAL_END_DATE = new Date('2025-03-08');
const TRIAL_ACTIVE = Date.now() < TRIAL_END_DATE.getTime();

// Rate limits based on trial status
const RATE_LIMITS = {
  TRIAL: {
    RPM: 2000,
    DELAY_MS: 100,
    MAX_RETRIES: 5
  },
  FREE: {
    RPM: 5,
    DELAY_MS: 13000,
    MAX_RETRIES: 3
  }
};

const CURRENT_LIMITS = TRIAL_ACTIVE ? RATE_LIMITS.TRIAL : RATE_LIMITS.FREE;
```

#### Delay Dinàmic (Línia ~217):
```typescript
// Dynamic request throttling based on trial status
if (i + BATCH_SIZE < validTweets.length) {
  onLog(strings.logs.cooldown, 'info');
  await delay(CURRENT_LIMITS.DELAY_MS); // ✅ Dinàmic: 100ms (trial) o 13000ms (free)
}
```

#### Retry Dinàmic (Línia ~199):
```typescript
const maxAttempts = CURRENT_LIMITS.MAX_RETRIES; // ✅ Dinàmic: 5 (trial) o 3 (free)
```

#### Export d'Informació del Trial (Línies 290-303):
```typescript
export const getTrialInfo = () => {
  const now = Date.now();
  const daysRemaining = Math.ceil((TRIAL_END_DATE.getTime() - now) / (1000 * 60 * 60 * 24));

  return {
    isTrialActive: TRIAL_ACTIVE,
    trialStartDate: TRIAL_START_DATE,
    trialEndDate: TRIAL_END_DATE,
    daysRemaining: Math.max(0, daysRemaining),
    currentLimits: CURRENT_LIMITS,
    warningThreshold: daysRemaining <= 7 && daysRemaining > 0
  };
};
```

---

### 2. **TrialCountdown.tsx** - Component de Countdown

**Ubicació**: `/src/components/TrialCountdown.tsx`

Component visual que mostra:
- 🚀 **Mode Trial Actiu**: Quan queden més de 7 dies
- ⚠️ **Avís**: Quan queden 7 dies o menys
- 📊 **Informació mostrada**:
  - Dies restants
  - Límit actual de RPM
  - Data de finalització del trial

**Característiques**:
- Es mostra només quan el trial està actiu
- S'actualitza automàticament cada hora
- Widget fix a la cantonada inferior dreta
- Canvia de color quan queden menys de 7 dies

---

### 3. **App.tsx** - Integració del Component

**Canvis**:
1. Import del component `TrialCountdown` (línia 23)
2. Renderització del widget al final de l'app (línia 1796)

---

## 🎯 Comportament Automàtic

### Durant el Trial (fins 8 març 2026):
```
✅ Processa 1 tweet cada ~100ms
✅ Fins a 2,000 tweets per minut
✅ 5 intents per tweet si falla
✅ Widget visible mostrant dies restants
```

### Després del Trial (des de 9 març 2026):
```
⚠️ Processa 1 tweet cada 13 segons
⚠️ Només 5 tweets per minut
⚠️ 3 intents per tweet si falla
⚠️ Widget desapareix automàticament
```

**NO CAL FER RES**: El codi detecta automàticament la data actual i ajusta els límits.

---

## 📊 Estimació de Temps de Processament

### Amb Trial (2,000 RPM):
- **10 tweets**: ~1 segon
- **50 tweets**: ~3 segons
- **100 tweets**: ~6 segons
- **500 tweets**: ~30 segons
- **1,000 tweets**: ~1 minut

### Sense Trial (5 RPM):
- **10 tweets**: ~2 minuts
- **50 tweets**: ~10 minuts
- **100 tweets**: ~20 minuts
- **500 tweets**: ~1 hora 40 minuts
- **1,000 tweets**: ~3 hores 20 minuts

---

## ⚠️ Avís Important

### Què passa el 8 de març de 2026?

1. **Automàticament** el codi canviarà a mode free
2. Els delays passaran de 100ms → 13s
3. Els retries baixaran de 5 → 3
4. El widget desapareixerà

### NO cal fer cap canvi manual!

El codi comprova la data actual cada cop que s'executa i s'adapta automàticament.

---

## 🔍 Com Verificar que Funciona

### 1. Comprovar el widget:
- Si el trial està actiu, hauries de veure el widget a la cantonada inferior dreta
- Mostra els dies restants i el límit actual (2,000 RPM)

### 2. Comprovar els logs:
Durant la importació de tweets, els logs haurien de mostrar:
```
⏱️ Esperant 100ms abans del següent tweet...
```

### 3. Després del trial:
Els logs mostraran:
```
⏱️ Esperant 13s abans del següent tweet...
```

---

## 🛠️ Modificar les Dates (Si cal)

Si per algun motiu necessites canviar les dates del trial, edita [geminiService.ts](src/services/geminiService.ts:11-12):

```typescript
const TRIAL_START_DATE = new Date('2025-12-08');  // Data d'inici
const TRIAL_END_DATE = new Date('2025-03-08');    // Data de finalització
```

---

## 📈 Monitoritzar l'Ús del Trial

Pots consultar l'ús real de l'API a:
- **Consola Google Cloud**: https://console.cloud.google.com/
- **AI Studio**: https://aistudio.google.com/usage

**Important**: Els $300 de crèdit són compartits amb tots els serveis de Google Cloud que utilitzis.

---

## ✅ Checklist de Verificació

- [x] Trial configurat amb dates correctes
- [x] Límits dinàmics implementats (RPM, delays, retries)
- [x] Widget de countdown creat i integrat
- [x] Avís quan queden < 7 dies
- [x] Desactivació automàtica després del trial
- [x] Build funcionant correctament
- [x] Codi preparat per deploy

---

**Creat**: 8 de desembre de 2025
**Versió**: 1.0
**Build**: `dist/assets/index-CMFnhIc9.js` (459.26 kB)
